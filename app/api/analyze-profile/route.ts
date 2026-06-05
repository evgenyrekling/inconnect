import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import {
  hydrateStoredProfileAssessment,
  normalizeProfileAssessment,
  type ProfileIntelligenceAssessment,
} from "@/lib/authority-analysis";
import {
  createLegacyLinkedInScopedUserKey,
  createUserKey,
  normalizeEmail,
} from "@/lib/identity";
import { extractPdfTextFromBuffer } from "@/lib/pdf-extraction";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  findUserByEmailOrKey,
  isUserProfileStorageError,
  upsertProfileFromAssessment,
  upsertUserIdentity,
  type UserProfileDebug,
} from "@/lib/user-profile-store";
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
  profile?: UserProfileDebug;
  storageDiagnostic?: StorageDiagnostic;
};

type StorageDiagnostic = {
  stage: string;
  error: string;
  details: string;
};

class StorageDiagnosticError extends Error {
  diagnostic: StorageDiagnostic;

  constructor(diagnostic: StorageDiagnostic) {
    super(diagnostic.error);
    this.name = "StorageDiagnosticError";
    this.diagnostic = diagnostic;
  }
}

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
    "scoreLevel",
    "scoreExplanation",
    "scoreBreakdown",
    "positioningGap",
    "assessmentConfidence",
    "confidenceReason",
    "corePositioning",
    "professionalArchetype",
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
    scoreLevel: { type: "string" },
    scoreExplanation: { type: "string" },
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
    professionalArchetype: {
      type: "object",
      additionalProperties: false,
      required: ["animal", "label", "explanation", "reasoning"],
      properties: {
        animal: {
          type: "string",
          enum: ["Falcon", "Bear", "Wolf", "Lion", "Owl", "Dolphin", "Bull", "Dragon"],
        },
        label: { type: "string" },
        explanation: { type: "string" },
        reasoning: { type: "string" },
      },
    },
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
  const hasProfileConsent = getFormBoolean(formData, "profileConsent");
  const pdfFile = formData.get("profilePdf");

  if (!linkedinUrl || !email || !(pdfFile instanceof File)) {
    return assessmentError(
      "Assessment Generation",
      "LinkedIn profile URL, email, and LinkedIn Profile PDF are required.",
      400,
      debug,
    );
  }

  if (!hasProfileConsent) {
    return assessmentError(
      "Assessment Generation",
      "Consent is required before INConnect can store your profile information and assessment result.",
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
  const userKey = createUserKey(email, "");
  const linkedinScopedUserKey = createLegacyLinkedInScopedUserKey(email, linkedinUrl);
  // Temporary founder/admin testing logic. ADMIN_EMAILS is server-only and must
  // never be exposed to the frontend.
  const isAdminUser = getAdminEmails().includes(normalizedEmail);
  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return assessmentError(
      "Supabase configuration",
      "Assessment could not be stored.",
      500,
      debug,
      error,
    );
  }
  const { periodStart, periodEnd } = getCurrentWeeklyUsagePeriod();

  try {
    debug.supabaseInsert = "PENDING";
    const existingUser = await findUserByEmailOrKey(supabase, {
      email: normalizedEmail,
      userKey,
    });
    const userKeyCandidates = Array.from(
      new Set(
        [userKey, linkedinScopedUserKey, existingUser?.user_key].filter(Boolean) as string[],
      ),
    );
    const planType = isAdminUser ? "admin" : existingUser?.plan_type ?? "free";

    if (!isAdminUser && planType !== "pro") {
      const usage = await getUsageCountForKeys(
        supabase,
        userKeyCandidates,
        periodStart,
        periodEnd,
      );
      if (usage >= 1) {
        const latestAssessment = await getLatestStoredAssessmentForKeys(
          supabase,
          userKeyCandidates,
        );
        const nextFreeAssessmentDate = getNextFreeAssessmentDate(periodEnd);
        return NextResponse.json(
          {
            error:
              `You already used your free weekly assessment. Your next free assessment will be available on ${formatReadableDate(nextFreeAssessmentDate)}.`,
            stage: "Assessment Generation",
            limitExceeded: true,
            latestAssessment,
            nextFreeAssessmentDate,
            debug: process.env.NODE_ENV === "development" ? debug : undefined,
          },
          { status: 429 },
        );
      }
    }

    const { user, debug: identityProfileDebug } = await upsertUserIdentity(supabase, {
      email,
      linkedinUrl,
      isAdminUser,
      planType,
      userKey,
    });
    const resolvedUserKey = user.user_key;
    debug.profile = identityProfileDebug;

    const assessmentRecord = await createAssessmentRecord(supabase, {
      userId: user.id,
      userKey: resolvedUserKey,
      fileName: pdfFile.name,
      fileSize: pdfFile.size,
    });
    const assessmentId = assessmentRecord.id as string;
    debug.supabaseInsert = "SUCCESS";
    const storageObjectPath = `${resolvedUserKey}/${assessmentId}.pdf`;
    const pdfStoragePath = `profile-pdfs/${storageObjectPath}`;
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    debug.pdfUpload = "PENDING";
    await ensureStorageBucketReachable(supabase, "profile-pdfs");
    await uploadProfilePdf(supabase, storageObjectPath, pdfBuffer);
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
      userKey: resolvedUserKey,
      diagnostics,
      assessmentId,
    }).catch((error) => {
      debug.openAIRequest = "FAILED";
      console.error("OpenAI profile analysis failed", error);
      throw error;
    });
    debug.openAIRequest = "SUCCESS";
    const storedAssessment = {
      ...assessment,
      assessmentDate: new Date().toISOString(),
    };

    await updateAssessmentRecord(supabase, assessmentId, {
      authority_score: storedAssessment.totalScore,
      assessment_confidence: storedAssessment.assessmentConfidence,
      market_position: storedAssessment.marketPosition,
      core_positioning: storedAssessment.corePositioning,
      professional_archetype: storedAssessment.professionalArchetype,
      positioning_snapshot: storedAssessment.positioningSnapshot,
      what_makes_unique: storedAssessment.whatMakesYouUnique,
      score_breakdown: storedAssessment.scoreBreakdown,
      positioning_gap: storedAssessment.positioningGap,
      top_competencies: storedAssessment.topCompetencies,
      expertise_domains: storedAssessment.keyExpertiseDomains,
      authority_growth_areas: storedAssessment.authorityGrowthAreas,
      profile_improvements: storedAssessment.profileImprovementRecommendations,
      visibility_gaps: storedAssessment.visibilityGaps,
      share_text: storedAssessment.shareText,
      ai_response: storedAssessment,
    });

    const profileDebug = await upsertProfileFromAssessment(supabase, {
      assessment: storedAssessment,
      assessmentDate: storedAssessment.assessmentDate,
      assessmentId,
      email,
      linkedinUrl,
      user,
    });
    debug.profile = mergeProfileDebug(identityProfileDebug, profileDebug);

    if (!isAdminUser && planType !== "pro") {
      await incrementUsage(supabase, {
        userKey: resolvedUserKey,
        periodStart,
        periodEnd,
        planType,
      });
    }

    return NextResponse.json({
      ...storedAssessment,
      profileDebug: process.env.NODE_ENV === "development" ? debug.profile : undefined,
    });
  } catch (error) {
    console.error("INConnect assessment storage flow failed", error);
    if (isUserProfileStorageError(error)) {
      return assessmentError(
        error.stage,
        "Assessment could not be stored.",
        500,
        debug,
        error,
      );
    }
    if (error instanceof StorageDiagnosticError) {
      return assessmentError(
        error.diagnostic.stage,
        "Assessment could not be stored.",
        500,
        debug,
        error,
      );
    }
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
        "Supabase storage",
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
      max_output_tokens: 1600,
      input: [
        {
          role: "system",
          content: [
            "You are INConnect, an AI LinkedIn Profile Intelligence Platform.",
            "Analyze only the uploaded LinkedIn Profile PDF text provided by the user.",
            "Do not scrape LinkedIn, use LinkedIn APIs, or infer facts not present in the PDF.",
            "The first result should answer: How does the market see me?",
            "Authority Score measures professional authority potential and market positioning, not follower count, engagement, or posting frequency.",
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
            "- LinkedIn Authority Score calibrated to this scale: 0-20 Incomplete Profile, 20-40 Early Career Professional, 40-60 Experienced Specialist, 60-75 Strong Industry Professional, 75-85 Recognized Industry Authority, 85-95 Established Thought Leader, 95-100 Exceptional Global Authority.",
            "- Scoring must increase for years of experience, leadership responsibility, specialization depth, industry authority signals, commercial impact, international scope, certifications, speaking activities, and thought leadership indicators.",
            "- Senior professionals with 20+ years of experience, global responsibility, deep specialization, leadership experience, and commercial impact should normally score at least 75 unless the PDF lacks evidence.",
            "- Do not penalize primarily for follower count, engagement, or posting frequency.",
            "- Include scoreLevel and scoreExplanation so the user understands why they received the score.",
            "- Professional Archetype: choose exactly one animal from Falcon, Bear, Wolf, Lion, Owl, Dolphin, Bull, Dragon. Include animal, short label, 1-2 sentence explanation, and concise reasoning.",
            "- Archetype logic: Falcon means strategic positioning, trend awareness, innovation, market foresight. Bear means long experience, stability, trusted industry authority, operational strength. Wolf means networking, partnerships, ecosystem building, sales leadership. Lion means executive leadership, public authority, strong influence. Owl means deep technical expertise, analytical thinking, specialist knowledge. Dolphin means communication, relationship building, customer orientation. Bull means commercial growth, sales drive, business development. Dragon means rare combination of seniority, innovation, influence, and authority.",
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

async function ensureStorageBucketReachable(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  bucketName: string,
) {
  try {
    const { error } = await supabase.storage.getBucket(bucketName);
    if (error) {
      throwStorageDiagnostic("storage bucket", error);
    }
  } catch (error) {
    if (error instanceof StorageDiagnosticError) throw error;
    throwStorageDiagnostic("storage bucket", error);
  }
}

async function uploadProfilePdf(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  storageObjectPath: string,
  pdfBuffer: Buffer,
) {
  try {
    const { error } = await supabase.storage
      .from("profile-pdfs")
      .upload(storageObjectPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (error) {
      throwStorageDiagnostic("PDF upload", error);
    }
  } catch (error) {
    if (error instanceof StorageDiagnosticError) throw error;
    throwStorageDiagnostic("PDF upload", error);
  }
}

async function getUsageCount(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userKey: string,
  periodStart: string,
  periodEnd: string,
) {
  try {
    const { data, error } = await supabase
      .from("usage_limits")
      .select("assessment_count")
      .eq("user_key", userKey)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (error) {
      throwStorageDiagnostic("usage_limits lookup", error);
    }
    return Number(data?.assessment_count ?? 0);
  } catch (error) {
    if (error instanceof StorageDiagnosticError) throw error;
    throwStorageDiagnostic("usage_limits lookup", error);
  }
}

async function getUsageCountForKeys(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userKeys: string[],
  periodStart: string,
  periodEnd: string,
) {
  const keys = Array.from(new Set(userKeys.filter(Boolean)));
  const counts = await Promise.all(
    keys.map((key) => getUsageCount(supabase, key, periodStart, periodEnd)),
  );
  return Math.max(0, ...counts);
}

async function getLatestStoredAssessment(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userKey: string,
) {
  let data:
    | {
        id: unknown;
        ai_response: unknown;
      }
    | null = null;

  try {
    const result = await supabase
      .from("assessments")
      .select("id, ai_response")
      .eq("user_key", userKey)
      .not("ai_response", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) {
      console.error("Supabase latest assessment lookup failed", createStorageDiagnostic("assessments lookup", result.error));
      return null;
    }

    data = result.data;
  } catch (error) {
    console.error("Supabase latest assessment lookup failed", createStorageDiagnostic("assessments lookup", error));
    return null;
  }

  if (!data?.ai_response || typeof data.ai_response !== "object") return null;

  return hydrateStoredProfileAssessment({
    ...(data.ai_response as ProfileIntelligenceAssessment),
    assessmentId: data.id as string,
    userKey,
  });
}

async function getLatestStoredAssessmentForKeys(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userKeys: string[],
) {
  const keys = Array.from(new Set(userKeys.filter(Boolean)));
  for (const key of keys) {
    const assessment = await getLatestStoredAssessment(supabase, key);
    if (assessment) return assessment;
  }
  return null;
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
  try {
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
      throwStorageDiagnostic("assessments insert", error);
    }
    return data;
  } catch (error) {
    if (error instanceof StorageDiagnosticError) throw error;
    throwStorageDiagnostic("assessments insert", error);
  }
}

async function updateAssessmentRecord(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  assessmentId: string,
  values: Record<string, unknown>,
) {
  try {
    const { error } = await supabase.from("assessments").update(values).eq("id", assessmentId);
    if (error) {
      throwStorageDiagnostic("assessments update", error);
    }
  } catch (error) {
    if (error instanceof StorageDiagnosticError) throw error;
    throwStorageDiagnostic("assessments update", error);
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
  try {
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
      throwStorageDiagnostic("usage_limits insert/update", error);
    }
  } catch (error) {
    if (error instanceof StorageDiagnosticError) throw error;
    throwStorageDiagnostic("usage_limits insert/update", error);
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

function mergeProfileDebug(
  identityDebug: UserProfileDebug,
  profileDebug: UserProfileDebug,
): UserProfileDebug {
  return {
    userFound: identityDebug.userFound,
    userCreated: identityDebug.userCreated,
    userKeyUpdated: identityDebug.userKeyUpdated,
    profileFound: profileDebug.profileFound,
    profileCreated: profileDebug.profileCreated,
    profileUpdated: profileDebug.profileUpdated,
    profileMergeCompleted: profileDebug.profileMergeCompleted,
    fieldsUpdated: Array.from(
      new Set([...identityDebug.fieldsUpdated, ...profileDebug.fieldsUpdated]),
    ),
  };
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function assessmentError(
  stage: string,
  message: string,
  status: number,
  debug: AssessmentDebug,
  error?: unknown,
) {
  const storageDiagnostic =
    error instanceof StorageDiagnosticError
      ? error.diagnostic
      : isSupabaseDiagnosticStage(stage)
        ? createStorageDiagnostic(stage, error)
        : undefined;
  const responseStage = storageDiagnostic?.stage ?? stage;
  const diagnosticError = storageDiagnostic?.error ?? getErrorSummary(error);
  const actualError = storageDiagnostic?.details ?? getErrorMessage(error);
  const nextDebug: AssessmentDebug = {
    ...debug,
    failedStage: responseStage,
    actualError,
    storageDiagnostic,
  };

  if (responseStage === "PDF upload" || responseStage === "storage bucket") {
    nextDebug.pdfUpload = "FAILED";
  }
  if (responseStage === "PDF Extraction") nextDebug.pdfExtraction = "FAILED";
  if (responseStage === "OpenAI Analysis") nextDebug.openAIRequest = "FAILED";
  if (isSupabaseDiagnosticStage(responseStage)) nextDebug.supabaseInsert = "FAILED";

  console.error("INConnect assessment pipeline error", {
    stage: responseStage,
    message,
    status,
    debug: nextDebug,
    error,
  });

  const isDevelopment = process.env.NODE_ENV === "development";

  return NextResponse.json(
    {
      stage: responseStage,
      error: message,
      userMessage: message,
      details: isDevelopment ? actualError : "",
      diagnosticError: isDevelopment ? diagnosticError : undefined,
      debug: isDevelopment ? nextDebug : undefined,
    },
    { status },
  );
}

function throwStorageDiagnostic(stage: string, error: unknown): never {
  const diagnostic = createStorageDiagnostic(stage, error);
  console.error("INConnect Supabase storage diagnostic", diagnostic);
  throw new StorageDiagnosticError(diagnostic);
}

function createStorageDiagnostic(stage: string, error: unknown): StorageDiagnostic {
  return {
    stage,
    error: getErrorSummary(error) || "Unknown Supabase error",
    details: getErrorDetails(error),
  };
}

function isSupabaseDiagnosticStage(stage: string) {
  return [
    "users lookup",
    "users insert",
    "users insert/update",
    "assessments lookup",
    "assessments insert",
    "assessments update",
    "user_profiles lookup",
    "user_profiles insert/update",
    "usage_limits lookup",
    "usage_limits insert/update",
    "storage bucket",
    "PDF upload",
    "Supabase configuration",
    "Supabase storage",
  ].includes(stage);
}

function getErrorSummary(error: unknown) {
  if (!error) return "";
  if (error instanceof StorageDiagnosticError) return error.diagnostic.error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : JSON.stringify(message);
  }
  return String(error);
}

function getErrorMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof StorageDiagnosticError) return error.diagnostic.details;
  if (error instanceof Error) return error.stack || error.message;
  return getErrorDetails(error);
}

function getErrorDetails(error: unknown) {
  if (!error) return "";
  if (error instanceof StorageDiagnosticError) return error.diagnostic.details;
  if (error instanceof Error) return error.stack || error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getNextFreeAssessmentDate(periodEnd: string) {
  const nextDate = new Date(`${periodEnd}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString().slice(0, 10);
}

function formatReadableDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getFormBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "true" || value === "on" || value === "1";
}

function isPdfUpload(file: File) {
  return (
    file.type === "application/pdf" ||
    file.type === "application/octet-stream" ||
    file.name.toLowerCase().endsWith(".pdf") ||
    !file.type
  );
}
