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

type PipelineStatus = "PENDING" | "SUCCESS" | "FAILED";
type AssessmentDebug = {
  failedStage?: string;
  pdfUpload: PipelineStatus;
  pdfExtraction: PipelineStatus;
  extractedCharacters?: number;
  openAIRequest: PipelineStatus;
  supabaseInsert: PipelineStatus;
  actualError?: string;
};

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
  const debug = createAssessmentDebug();
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return assessmentError("Assessment Generation", "Invalid assessment submission.", 400, debug);
  }

  const linkedinUrl = getFormString(formData, "linkedinUrl");
  const email = getFormString(formData, "email");
  const pdfFile = formData.get("profilePdf");

  if (!linkedinUrl || !email || !(pdfFile instanceof File)) {
    return assessmentError(
      "Assessment Generation",
      "LinkedIn profile URL, email, and LinkedIn Profile PDF are required.",
      400,
      debug,
    );
  }

  if (!isPdfUpload(pdfFile)) {
    return assessmentError(
      "Assessment Generation",
      "Please upload your LinkedIn Profile PDF.",
      400,
      debug,
    );
  }

  if (pdfFile.size > MAX_PDF_SIZE_BYTES) {
    return assessmentError(
      "Assessment Generation",
      "PDF file size must be 5 MB or less.",
      400,
      debug,
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return assessmentError(
      "OpenAI Analysis",
      "AI analysis could not be completed.",
      500,
      debug,
      new Error("OPENAI_API_KEY is not configured."),
    );
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedLinkedInUrl = normalizeLinkedInUrl(linkedinUrl);
  const userKey = createUserKey(email, linkedinUrl);
  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return assessmentError(
      "Supabase Storage",
      "Assessment could not be stored.",
      500,
      debug,
      error,
    );
  }
  const { periodStart, periodEnd } = getCurrentWeeklyUsagePeriod();

  try {
    debug.supabaseInsert = "PENDING";
    const existingUser = await getExistingUserPlan(supabase, userKey);
    const planType = existingUser?.plan_type ?? "free";

    if (planType !== "pro") {
      const usage = await getUsageCount(supabase, userKey, periodStart, periodEnd);
      if (usage >= 1) {
        return assessmentError(
          "Assessment Generation",
          "Usage limit exceeded. Your free plan includes one comprehensive profile assessment per week. Upgrade to Pro for unlimited assessments.",
          429,
          debug,
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
    debug.supabaseInsert = "SUCCESS";
    const storageObjectPath = `${userKey}/${assessmentId}.pdf`;
    const pdfStoragePath = `profile-pdfs/${storageObjectPath}`;
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    debug.pdfUpload = "PENDING";
    const uploadResult = await supabase.storage
      .from("profile-pdfs")
      .upload(storageObjectPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadResult.error) {
      console.error("Supabase PDF upload failed", uploadResult.error);
      debug.pdfUpload = "FAILED";
      return assessmentError(
        "PDF Upload",
        "PDF upload failed.",
        502,
        debug,
        uploadResult.error,
      );
    }
    debug.pdfUpload = "SUCCESS";

    await updateAssessmentRecord(supabase, assessmentId, {
      pdf_storage_path: pdfStoragePath,
    });

    debug.pdfExtraction = "PENDING";
    const extraction = await extractPdfTextFromBuffer(pdfBuffer).catch((error) => {
      console.error("PDF extraction failed", error);
      return null;
    });

    if (!extraction || extraction.characterCount < 500) {
      debug.pdfExtraction = "FAILED";
      debug.extractedCharacters = extraction?.characterCount ?? 0;
      return assessmentError(
        "PDF Extraction",
        PDF_EXTRACTION_ERROR,
        400,
        debug,
        extraction
          ? new Error(`Extracted text under 500 characters: ${extraction.characterCount}`)
          : new Error("PDF extraction returned no readable text."),
      );
    }
    debug.pdfExtraction = "SUCCESS";
    debug.extractedCharacters = extraction.characterCount;

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

    debug.openAIRequest = "PENDING";
    const assessment = await analyzeProfilePdf({
      email,
      extractionStatus,
      linkedinUrl,
      pdfText: extraction.fullText,
      userKey,
      diagnostics,
      assessmentId,
    }).catch((error) => {
      debug.openAIRequest = "FAILED";
      console.error("OpenAI profile analysis failed", error);
      throw error;
    });
    debug.openAIRequest = "SUCCESS";

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
    if (error instanceof Error && error.message.includes("response format")) {
      return assessmentError(
        "Assessment Generation",
        "Assessment response format error.",
        502,
        debug,
        error,
      );
    }
    if (debug.openAIRequest === "FAILED" || (error instanceof Error && error.message.includes("OpenAI"))) {
      return assessmentError(
        "OpenAI Analysis",
        "AI analysis could not be completed.",
        502,
        debug,
        error,
      );
    }
    if (debug.supabaseInsert === "PENDING" || (error instanceof Error && error.message.includes("Supabase"))) {
      return assessmentError(
        "Supabase Storage",
        "Assessment could not be stored.",
        500,
        debug,
        error,
      );
    }
    return assessmentError(
      "Assessment Generation",
      "Assessment generation failed.",
      500,
      debug,
      error,
    );
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
  let response: Awaited<ReturnType<typeof openai.responses.parse>>;
  try {
    response = await openai.responses.parse({
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
  } catch (error) {
    console.error("OpenAI errors", error);
    const message = getErrorMessage(error);
    if (/json|parse|schema|format|structured/i.test(message)) {
      throw new Error(`Assessment response format error: ${message}`);
    }
    throw new Error(`OpenAI analysis failed: ${message}`);
  }

  console.info("OpenAI profile analysis response", {
    id: response.id,
    model: response.model,
    status: response.status,
    outputTextLength: response.output_text?.length ?? 0,
  });

  if (!response.output_parsed) {
    console.error("OpenAI JSON parsing error", {
      responseId: response.id,
      outputText: response.output_text,
    });
    throw new Error("Assessment response format error: OpenAI response did not include parsed JSON.");
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

  if (error) {
    console.error("Supabase user lookup failed", error);
    throw new Error(`Supabase user lookup failed: ${error.message}`);
  }
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

  if (error) {
    console.error("Supabase usage lookup failed", error);
    throw new Error(`Supabase usage lookup failed: ${error.message}`);
  }
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

  if (error) {
    console.error("Supabase user upsert failed", error);
    throw new Error(`Supabase user upsert failed: ${error.message}`);
  }
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

  if (error) {
    console.error("Supabase assessment insert failed", error);
    throw new Error(`Supabase assessment insert failed: ${error.message}`);
  }
  return data;
}

async function updateAssessmentRecord(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  assessmentId: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase.from("assessments").update(values).eq("id", assessmentId);
  if (error) {
    console.error("Supabase assessment update failed", error);
    throw new Error(`Supabase assessment update failed: ${error.message}`);
  }
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

  if (error) {
    console.error("Supabase usage update failed", error);
    throw new Error(`Supabase usage update failed: ${error.message}`);
  }
}

function createAssessmentDebug(): AssessmentDebug {
  return {
    pdfUpload: "PENDING",
    pdfExtraction: "PENDING",
    openAIRequest: "PENDING",
    supabaseInsert: "PENDING",
  };
}

function assessmentError(
  stage: string,
  message: string,
  status: number,
  debug: AssessmentDebug,
  error?: unknown,
) {
  const actualError = getErrorMessage(error);
  const nextDebug: AssessmentDebug = {
    ...debug,
    failedStage: stage,
    actualError,
  };

  if (stage === "PDF Upload") nextDebug.pdfUpload = "FAILED";
  if (stage === "PDF Extraction") nextDebug.pdfExtraction = "FAILED";
  if (stage === "OpenAI Analysis") nextDebug.openAIRequest = "FAILED";
  if (stage === "Supabase Storage") nextDebug.supabaseInsert = "FAILED";

  console.error("INConnect assessment pipeline error", {
    stage,
    message,
    status,
    debug: nextDebug,
    error,
  });

  return NextResponse.json(
    {
      error: message,
      stage,
      debug: process.env.NODE_ENV === "development" ? nextDebug : undefined,
    },
    { status },
  );
}

function getErrorMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.stack || error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
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
