import crypto from "node:crypto";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import {
  normalizeProfileAssessment,
  type ProfileIntelligenceAssessment,
} from "@/lib/authority-analysis";

export const runtime = "nodejs";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "userKey",
    "totalScore",
    "assessmentConfidence",
    "confidenceReason",
    "corePositioning",
    "profileClarity",
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
    totalScore: { type: "number" },
    assessmentConfidence: { type: "string", enum: ["HIGH"] },
    confidenceReason: { type: "string" },
    corePositioning: { type: "string" },
    profileClarity: {
      type: "object",
      additionalProperties: false,
      required: [
        "externalReaderView",
        "professionalImage",
        "positioningClarity",
        "positioningFocus",
      ],
      properties: {
        externalReaderView: { type: "string" },
        professionalImage: { type: "string" },
        positioningClarity: { type: "string" },
        positioningFocus: { type: "string" },
      },
    },
    topCompetencies: { type: "array", items: { type: "string" } },
    keyExpertiseDomains: { type: "array", items: { type: "string" } },
    authorityGrowthAreas: { type: "array", items: { type: "string" } },
    profileImprovementRecommendations: {
      type: "object",
      additionalProperties: false,
      required: [
        "currentHeadline",
        "suggestedHeadline",
        "currentPositioning",
        "recommendedPositioning",
        "headlineImprovements",
        "aboutSectionImprovements",
        "positioningImprovements",
        "missingAuthoritySignals",
        "missingKeywords",
        "missingIndustryThemes",
      ],
      properties: {
        currentHeadline: { type: "string" },
        suggestedHeadline: { type: "string" },
        currentPositioning: { type: "string" },
        recommendedPositioning: { type: "string" },
        headlineImprovements: { type: "array", items: { type: "string" } },
        aboutSectionImprovements: { type: "array", items: { type: "string" } },
        positioningImprovements: { type: "array", items: { type: "string" } },
        missingAuthoritySignals: { type: "array", items: { type: "string" } },
        missingKeywords: { type: "array", items: { type: "string" } },
        missingIndustryThemes: { type: "array", items: { type: "string" } },
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

  if (pdfFile.type && pdfFile.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Please upload your LinkedIn Profile PDF." },
      { status: 400 },
    );
  }

  const userKey = createUserKey(email, linkedinUrl);
  const extraction = await extractPdfText(pdfFile).catch((error) => {
    console.error("PDF extraction failed", error);
    return {
      text: "",
      pageCount: 0,
    };
  });
  const extractedCharacterCount = extraction.text.trim().length;
  const diagnostics = {
    fileName: pdfFile.name,
    fileSize: pdfFile.size,
    extractedCharacterCount,
    detectedPageCount: extraction.pageCount,
  };

  if (process.env.NODE_ENV === "development") {
    console.info("INConnect PDF extraction diagnostics", diagnostics);
  }

  if (extractedCharacterCount < 500) {
    return NextResponse.json(
      {
        error:
          "We could not extract readable text from this PDF. Please make sure it is the LinkedIn Profile PDF export, not a screenshot or scanned file.",
        diagnostics:
          process.env.NODE_ENV === "development" ? diagnostics : undefined,
      },
      { status: 400 },
    );
  }

  const extractionStatus = {
    message: "LinkedIn Profile PDF detected. Profile text extracted successfully.",
    warning:
      extractedCharacterCount < 1500
        ? "Limited profile text detected. Assessment quality may be reduced."
        : undefined,
  };

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  try {
    const assessment = await analyzeProfilePdf({
      diagnostics,
      email,
      extractionStatus,
      linkedinUrl,
      pdfText: extraction.text,
      userKey,
    });

    // Supabase storage will be added here later. Use userKey for weekly limits,
    // assessment history, and Pro account matching.

    return NextResponse.json(assessment);
  } catch (error) {
    console.error("OpenAI PDF profile analysis failed", error);
    return NextResponse.json(
      { error: "AI analysis could not be completed. Please try again." },
      { status: 502 },
    );
  }
}

async function analyzeProfilePdf({
  diagnostics,
  email,
  extractionStatus,
  linkedinUrl,
  pdfText,
  userKey,
}: {
  diagnostics: {
    fileName: string;
    fileSize: number;
    extractedCharacterCount: number;
    detectedPageCount: number;
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
    input: [
      {
        role: "system",
        content: [
          "You are INConnect, an AI LinkedIn Profile Intelligence Platform.",
          "Analyze only the uploaded LinkedIn Profile PDF text provided by the user.",
          "Do not scrape LinkedIn, use LinkedIn APIs, or infer facts not present in the PDF.",
          "Be constructive, premium, professional, and specific.",
          "The share card and share text must remain positive and never include weaknesses or gaps.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Generate a comprehensive LinkedIn Profile Intelligence Assessment.",
          "",
          "User metadata:",
          `userKey: ${userKey}`,
          `LinkedIn URL: ${linkedinUrl}`,
          `Email: ${email}`,
          "",
          "Analyze these PDF sections when present:",
          "- Headline",
          "- About",
          "- Experience",
          "- Skills",
          "- Certifications",
          "- Education",
          "- Projects",
          "- Keywords",
          "- Positioning language",
          "",
          "Required analysis:",
          "- LinkedIn Authority Score, realistic 0-100.",
          "- Assessment Confidence must be HIGH with reason: Based on comprehensive LinkedIn Profile PDF analysis.",
          "- Core Positioning Statement.",
          "- How Your Profile Is Currently Positioned: external reader view, professional image, positioning clarity, positioning focus.",
          "- Top Competencies.",
          "- Key Expertise Domains.",
          "- Authority Growth Areas that are different from expertise domains.",
          "- How To Improve Your Profile: headline improvements, About improvements, positioning improvements, missing authority signals, missing keywords, missing industry themes, current headline, suggested headline, current positioning, recommended positioning.",
          "- What Is Missing: constructive visibility gaps only.",
          "- Positive highlights for shareable results.",
          "- Positive LinkedIn share text only.",
          "",
          "PDF text:",
          pdfText.slice(0, 24000),
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "inconnect_profile_intelligence",
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
      diagnostics: process.env.NODE_ENV === "development" ? diagnostics : undefined,
      extractionStatus,
    },
  );
}

async function extractPdfText(file: File) {
  const { PDFParse } = await import("pdf-parse");
  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText({
      lineThreshold: 1,
      cellThreshold: 1,
    });

    return {
      text: result.text,
      pageCount: result.total || result.pages?.length || 0,
    };
  } finally {
    await parser.destroy();
  }
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function createUserKey(email: string, linkedinUrl: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedLinkedInUrl = normalizeLinkedInUrl(linkedinUrl);

  return crypto
    .createHash("sha256")
    .update(`${normalizedEmail}|${normalizedLinkedInUrl}`)
    .digest("hex");
}

function normalizeLinkedInUrl(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}
