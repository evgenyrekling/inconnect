import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import {
  normalizeProfileAssessment,
  type ProfileIntelligenceAssessment,
} from "@/lib/authority-analysis";
import { createUserKey, normalizeEmail, normalizeLinkedInUrl } from "@/lib/identity";
import { extractPdfTextFromBuffer } from "@/lib/pdf-extraction";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentWeeklyUsagePeriod } from "@/lib/usage-period";

export const runtime = "nodejs";

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;
const PDF_EXTRACTION_ERROR =
  "We could not extract readable text from this PDF. Please make sure it is the LinkedIn Profile PDF export, not a screenshot or scanned file.";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "userKey",
    "profileSnapshot",
    "marketPosition",
    "positioningSnapshot",
    "whatMakesYouUnique",
    "totalScore",
    "scoreBreakdown",
    "positioningGap",
    "assessmentConfidence",
    "confidenceReason",
    "corePositioning",
    "topCompetencies",
    "keyExpertiseDomains",
    "authorityGrowthAreas",
    "profileImprovementRecommendations",
    "visibilityGaps",
    "positiveHighlights",
    "shareText",
  ],
  properties: {
    userKey: { type: "string" },
    profileSnapshot: {
      type: "object",
      additionalProperties: false,
      required: [
        "name",
        "currentRole",
        "currentCompany",
        "location",
        "estimatedYearsOfExperience",
        "topSkills",
        "topIndustries",
      ],
      properties: {
        name: { type: "string" },
        currentRole: { type: "string" },
        currentCompany: { type: "string" },
        location: { type: "string" },
        estimatedYearsOfExperience: { type: "string" },
        topSkills: { type: "array", items: { type: "string" } },
        topIndustries: { type: "array", items: { type: "string" } },
      },
    },
    marketPosition: { type: "string" },
    positioningSnapshot: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "percentage"],
        properties: {
          label: { type: "string" },
          percentage: { type: "number" },
        },
      },
    },
    whatMakesYouUnique: { type: "string" },
    totalScore: { type: "number" },
    scoreBreakdown: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "weight", "score", "explanation", "improvementHint"],
        properties: {
          category: {
            type: "string",
            enum: [
              "Positioning Clarity",
              "Career Progression",
              "Industry Specialization",
              "Leadership Signals",
              "Commercial Impact",
              "Authority Potential",
            ],
          },
          weight: { type: "number" },
          score: { type: "number" },
          explanation: { type: "string" },
          improvementHint: { type: "string" },
        },
      },
    },
    positioningGap: {
      type: "object",
      additionalProperties: false,
      required: ["currentPosition", "potentialPosition", "gapExplanation"],
      properties: {
        currentPosition: { type: "string" },
        potentialPosition: { type: "string" },
        gapExplanation: { type: "string" },
      },
    },
    assessmentConfidence: { type: "string", enum: ["HIGH", "MEDIUM"] },
    confidenceReason: { type: "string" },
    corePositioning: { type: "string" },
    topCompetencies: { type: "array", items: { type: "string" } },
    keyExpertiseDomains: { type: "array", items: { type: "string" } },
    authorityGrowthAreas: { type: "array", items: { type: "string" } },
    profileImprovementRecommendations: {
      type: "object",
      additionalProperties: false,
      required: [
        "headlineImprovement",
        "aboutSectionImprovement",
        "keywordsToAdd",
        "authoritySignalsToStrengthen",
        "missingProfessionalThemes",
        "suggestedPositioningAngle",
      ],
      properties: {
        headlineImprovement: { type: "string" },
        aboutSectionImprovement: { type: "string" },
        keywordsToAdd: { type: "array", items: { type: "string" } },
        authoritySignalsToStrengthen: { type: "array", items: { type: "string" } },
        missingProfessionalThemes: { type: "array", items: { type: "string" } },
        suggestedPositioningAngle: { type: "string" },
      },
    },
    visibilityGaps: { type: "array", items: { type: "string" } },
    positiveHighlights: { type: "array", items: { type: "string" } },
    shareText: { type: "string" },
  },
} as const;

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid assessment submission." }, { status: 400 });
  }

  const linkedinUrl = getFormString(formData, "linkedinUrl");
  const email = getFormString(formData, "email");
  const pdfFile = formData.get("profilePdf");

  if (!linkedinUrl || !email || !(pdfFile instanceof File)) {
    return NextResponse.json(
      { error: "LinkedIn profile URL, email, and LinkedIn Profile PDF are required." },
      { status: 400 },
    );
  }

  if (!isPdfUpload(pdfFile)) {
    return NextResponse.json({ error: "Please upload your LinkedIn Profile PDF." }, { status: 400 });
  }

  if (pdfFile.size > MAX_PDF_SIZE_BYTES) {
    return NextResponse.json(
      { error: "PDF file size must be 5 MB or less." },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedLinkedInUrl = normalizeLinkedInUrl(linkedinUrl);
  const userKey = createUserKey(email, linkedinUrl);
  const supabase = getSupabaseAdminClient();
  const { periodStart, periodEnd } = getCurrentWeeklyUsagePeriod();

  try {
    const existingUser = await getExistingUserPlan(supabase, userKey);
    const planType = existingUser?.plan_type ?? "free";

    if (planType !== "pro") {
      const usage = await getUsageCount(supabase, userKey, periodStart, periodEnd);
      if (usage >= 1) {
        return NextResponse.json(
          {
            error:
              "Usage limit exceeded. Your free plan includes one comprehensive profile assessment per week. Upgrade to Pro for unlimited assessments.",
          },
          { status: 429 },
        );
      }
    }

    const user = await upsertUser(supabase, {
      email,
      linkedinUrl,
      normalizedEmail,
      normalizedLinkedInUrl,
      planType,
      userKey,
    });

    const assessmentRecord = await createAssessmentRecord(supabase, {
      userId: user.id,
      userKey,
      fileName: pdfFile.name,
      fileSize: pdfFile.size,
    });
    const assessmentId = assessmentRecord.id as string;
    const storageObjectPath = `${userKey}/${assessmentId}.pdf`;
    const pdfStoragePath = `profile-pdfs/${storageObjectPath}`;
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    const uploadResult = await supabase.storage
      .from("profile-pdfs")
      .upload(storageObjectPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadResult.error) {
      console.error("Supabase PDF upload failed", uploadResult.error);
      return NextResponse.json({ error: "PDF upload failed." }, { status: 502 });
    }

    await updateAssessmentRecord(supabase, assessmentId, {
      pdf_storage_path: pdfStoragePath,
    });

    const extraction = await extractPdfTextFromBuffer(pdfBuffer).catch((error) => {
      console.error("PDF extraction failed", error);
      return null;
    });

    if (!extraction || extraction.characterCount < 500) {
      return NextResponse.json({ error: PDF_EXTRACTION_ERROR }, { status: 400 });
    }

    const extractionStatus = {
      message: "LinkedIn Profile PDF text extracted successfully.",
      warning:
        extraction.characterCount < 1500
          ? "Limited profile text detected. Assessment quality may be reduced."
          : undefined,
    };
    const diagnostics = {
      fileName: pdfFile.name,
      fileSize: pdfFile.size,
      pageCount: extraction.pageCount,
      characterCount: extraction.characterCount,
      first1000Characters: extraction.first1000Characters,
    };

    await updateAssessmentRecord(supabase, assessmentId, {
      extracted_text: extraction.fullText,
      extracted_character_count: extraction.characterCount,
    });

    const assessment = await analyzeProfilePdf({
      email,
      extractionStatus,
      linkedinUrl,
      pdfText: extraction.fullText,
      userKey,
      diagnostics,
      assessmentId,
    }).catch((error) => {
      console.error("OpenAI profile analysis failed", error);
      return null;
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "AI analysis could not be completed. Please try again shortly." },
        { status: 502 },
      );
    }

    await updateAssessmentRecord(supabase, assessmentId, {
      authority_score: assessment.totalScore,
      assessment_confidence: assessment.assessmentConfidence,
      market_position: assessment.marketPosition,
      core_positioning: assessment.corePositioning,
      positioning_snapshot: assessment.positioningSnapshot,
      what_makes_unique: assessment.whatMakesYouUnique,
      score_breakdown: assessment.scoreBreakdown,
      positioning_gap: assessment.positioningGap,
      top_competencies: assessment.topCompetencies,
      expertise_domains: assessment.keyExpertiseDomains,
      authority_growth_areas: assessment.authorityGrowthAreas,
      profile_improvements: assessment.profileImprovementRecommendations,
      visibility_gaps: assessment.visibilityGaps,
      share_text: assessment.shareText,
      ai_response: assessment,
    });

    if (planType !== "pro") {
      await incrementUsage(supabase, {
        userKey,
        periodStart,
        periodEnd,
        planType,
      });
    }

    return NextResponse.json(assessment);
  } catch (error) {
    console.error("INConnect assessment storage flow failed", error);
    const message =
      error instanceof Error && error.message.includes("Supabase")
        ? "Supabase insert failed."
        : "Profile assessment failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function analyzeProfilePdf({
  assessmentId,
  diagnostics,
  email,
  extractionStatus,
  linkedinUrl,
  pdfText,
  userKey,
}: {
  assessmentId: string;
  diagnostics: {
    fileName: string;
    fileSize: number;
    pageCount: number;
    characterCount: number;
    first1000Characters: string;
  };
  email: string;
  extractionStatus: {
    message: string;
    warning?: string;
  };
  linkedinUrl: string;
  pdfText: string;
  userKey: string;
}) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.parse({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.7,
    max_output_tokens: 1200,
    input: [
      {
        role: "system",
        content: [
          "You are INConnect, an AI LinkedIn Profile Intelligence Platform.",
          "Analyze only the uploaded LinkedIn Profile PDF text provided by the user.",
          "Do not scrape LinkedIn, use LinkedIn APIs, or infer facts not present in the PDF.",
          "The first result should answer: How does the market see me?",
          "Be constructive, premium, professional, and specific.",
          "Use visibility opportunity, growth opportunity, and positioning opportunity language.",
          "Avoid words such as weak, bad, poor, weaknesses, or criticism.",
          "The share card and share text must remain positive and never include gaps or recommendations.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Generate a Phase 1 LinkedIn Profile Intelligence Assessment.",
          "",
          "User metadata:",
          `userKey: ${userKey}`,
          `LinkedIn URL: ${linkedinUrl}`,
          `Email: ${email}`,
          "",
          "Analyze these PDF sections when present. LinkedIn PDF labels vary, so do not require exact names:",
          "- Headline",
          "- Summary / About",
          "- Contact",
          "- Experience",
          "- Top Skills / Skills",
          "- Certifications",
          "- Education",
          "- Projects",
          "- Keywords",
          "- Positioning language",
          "",
          "Required output:",
          "- Profile Snapshot: name, current role, current company, location, estimated years of experience, top 5 skills, top 3 industries.",
          "- Market Position: one executive-level sentence describing how the market sees this person.",
          "- Positioning Snapshot: 5 association percentages that add up to 100.",
          "- What Makes You Unique: explain the rare combination of expertise, experience, industries, commercial impact, and technical depth.",
          "- LinkedIn Authority Score.",
          "- Authority Score Breakdown using exactly these weighted categories: Positioning Clarity 20, Career Progression 15, Industry Specialization 20, Leadership Signals 15, Commercial Impact 15, Authority Potential 15. Each category needs score, explanation, improvementHint.",
          "- Positioning Gap with currentPosition, potentialPosition, gapExplanation.",
          "- Profile Improvement Recommendations: headlineImprovement, aboutSectionImprovement, keywordsToAdd, authoritySignalsToStrengthen, missingProfessionalThemes, suggestedPositioningAngle.",
          "- Visibility Gaps using constructive language only.",
          "- Shareable positive highlights and share text only.",
          "",
          "PDF text:",
          pdfText.slice(0, 24000),
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "inconnect_phase_one_profile_intelligence",
        strict: true,
        schema: responseSchema,
      },
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI response did not include parsed JSON.");
  }

  return normalizeProfileAssessment(
    response.output_parsed as ProfileIntelligenceAssessment,
    userKey,
    {
      assessmentId,
      diagnostics: process.env.NODE_ENV === "development" ? diagnostics : undefined,
      extractionStatus,
    },
  );
}

async function getExistingUserPlan(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userKey: string,
) {
  const { data, error } = await supabase
    .from("users")
    .select("id, plan_type")
    .eq("user_key", userKey)
    .maybeSingle();

  if (error) throw new Error(`Supabase user lookup failed: ${error.message}`);
  return data;
}

async function getUsageCount(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userKey: string,
  periodStart: string,
  periodEnd: string,
) {
  const { data, error } = await supabase
    .from("usage_limits")
    .select("assessment_count")
    .eq("user_key", userKey)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  if (error) throw new Error(`Supabase usage lookup failed: ${error.message}`);
  return Number(data?.assessment_count ?? 0);
}

async function upsertUser(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  values: {
    email: string;
    linkedinUrl: string;
    normalizedEmail: string;
    normalizedLinkedInUrl: string;
    planType: string;
    userKey: string;
  },
) {
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        user_key: values.userKey,
        email: values.email,
        linkedin_url: values.linkedinUrl,
        normalized_email: values.normalizedEmail,
        normalized_linkedin_url: values.normalizedLinkedInUrl,
        plan_type: values.planType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_key" },
    )
    .select("id, plan_type")
    .single();

  if (error) throw new Error(`Supabase user upsert failed: ${error.message}`);
  return data;
}

async function createAssessmentRecord(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  values: {
    userId: string;
    userKey: string;
    fileName: string;
    fileSize: number;
  },
) {
  const { data, error } = await supabase
    .from("assessments")
    .insert({
      user_id: values.userId,
      user_key: values.userKey,
      pdf_file_name: values.fileName,
      pdf_file_size: values.fileSize,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Supabase assessment insert failed: ${error.message}`);
  return data;
}

async function updateAssessmentRecord(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  assessmentId: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase.from("assessments").update(values).eq("id", assessmentId);
  if (error) throw new Error(`Supabase assessment update failed: ${error.message}`);
}

async function incrementUsage(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  values: {
    userKey: string;
    periodStart: string;
    periodEnd: string;
    planType: string;
  },
) {
  const existingCount = await getUsageCount(
    supabase,
    values.userKey,
    values.periodStart,
    values.periodEnd,
  );
  const { error } = await supabase.from("usage_limits").upsert(
    {
      user_key: values.userKey,
      period_start: values.periodStart,
      period_end: values.periodEnd,
      assessment_count: existingCount + 1,
      plan_type: values.planType,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_key,period_start,period_end" },
  );

  if (error) throw new Error(`Supabase usage update failed: ${error.message}`);
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isPdfUpload(file: File) {
  return (
    file.type === "application/pdf" ||
    file.type === "application/octet-stream" ||
    file.name.toLowerCase().endsWith(".pdf") ||
    !file.type
  );
}
