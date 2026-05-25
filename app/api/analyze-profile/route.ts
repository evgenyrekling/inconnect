import { NextRequest, NextResponse } from "next/server";
import {
  calculateWeightedScore,
  clampScore,
  createDemoFallbackAnalysis,
  type AuthorityAnalysisResponse,
  type ScoreBreakdown,
} from "@/lib/authority-analysis";
import { createShareText } from "@/lib/mock-intelligence";
import { analysisToProfile } from "@/lib/authority-analysis";

type AnalyzeProfileRequest = {
  linkedinUrl?: string;
  email?: string;
  profileText?: string;
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "totalScore",
    "scoreBreakdown",
    "detectedProfessionalAreas",
    "topStrengths",
    "visibilityPotential",
    "visibilityOpportunities",
    "trendAngles",
    "personalizedTopicIdea",
    "shareText",
  ],
  properties: {
    totalScore: { type: "integer" },
    scoreBreakdown: {
      type: "object",
      additionalProperties: false,
      required: [
        "profileClarity",
        "professionalPositioning",
        "authoritySignals",
        "contentPotential",
        "networkRelevance",
        "growthOpportunity",
      ],
      properties: Object.fromEntries(
        [
          "profileClarity",
          "professionalPositioning",
          "authoritySignals",
          "contentPotential",
          "networkRelevance",
          "growthOpportunity",
        ].map((category) => [
          category,
          {
            type: "object",
            additionalProperties: false,
            required: ["score", "explanation", "improvementHint"],
            properties: {
              score: { type: "integer" },
              explanation: { type: "string" },
              improvementHint: { type: "string" },
            },
          },
        ]),
      ),
    },
    detectedProfessionalAreas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "confidence"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          confidence: { type: "integer" },
        },
      },
    },
    topStrengths: {
      type: "array",
      items: { type: "string" },
    },
    visibilityPotential: {
      type: "array",
      items: { type: "string" },
    },
    visibilityOpportunities: {
      type: "array",
      items: { type: "string" },
    },
    trendAngles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "momentum", "summary"],
        properties: {
          title: { type: "string" },
          momentum: {
            type: "string",
            enum: ["Emerging", "Accelerating", "High signal", "Executive priority"],
          },
          summary: { type: "string" },
        },
      },
    },
    personalizedTopicIdea: {
      type: "object",
      additionalProperties: false,
      required: ["title", "hook", "whyNow", "cta", "hashtags"],
      properties: {
        title: { type: "string" },
        hook: { type: "string" },
        whyNow: { type: "string" },
        cta: { type: "string" },
        hashtags: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    shareText: { type: "string" },
  },
} as const;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as AnalyzeProfileRequest | null;
  const linkedinUrl = body?.linkedinUrl?.trim() ?? "";
  const email = body?.email?.trim() ?? "";
  const profileText = body?.profileText?.trim() ?? "";

  if (!linkedinUrl || !email) {
    return NextResponse.json(
      { error: "LinkedIn profile URL and email are required." },
      { status: 400 },
    );
  }

  if (!profileText) {
    return NextResponse.json(createDemoFallbackAnalysis(linkedinUrl));
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  try {
    const analysis = await analyzeProfileWithOpenAI({
      linkedinUrl,
      email,
      profileText,
    });

    // Supabase storage will be added here later, using email + LinkedIn URL as
    // the unique user identifier and storing the normalized analysis payload.

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("OpenAI profile analysis failed", error);
    return NextResponse.json(
      { error: "Could not analyze the LinkedIn profile text." },
      { status: 502 },
    );
  }
}

async function analyzeProfileWithOpenAI({
  linkedinUrl,
  email,
  profileText,
}: {
  linkedinUrl: string;
  email: string;
  profileText: string;
}): Promise<AuthorityAnalysisResponse> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are INConnect's LinkedIn Authority Scoring Engine. Analyze only the user-provided LinkedIn text. Do not claim to access LinkedIn, scrape websites, or use hidden data. Return professional, positive, executive-level JSON.",
        },
        {
          role: "user",
          content: [
            "Analyze this LinkedIn profile input for professional authority.",
            `LinkedIn URL: ${linkedinUrl}`,
            `Email: ${email}`,
            "",
            "Scoring weights:",
            "- Profile Clarity: 20%",
            "- Professional Positioning: 20%",
            "- Authority Signals: 20%",
            "- Content Potential: 15%",
            "- Network Relevance: 15%",
            "- Growth Opportunity: 10%",
            "",
            "Profile text:",
            profileText.slice(0, 12000),
          ].join("\n"),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "inconnect_authority_analysis",
          strict: true,
          schema: responseSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(extractOutputText(data)) as Omit<
    AuthorityAnalysisResponse,
    "analysisMode"
  >;

  const normalized: AuthorityAnalysisResponse = {
    ...parsed,
    scoreBreakdown: normalizeScoreBreakdown(parsed.scoreBreakdown),
    detectedProfessionalAreas: parsed.detectedProfessionalAreas.map((area) => ({
      ...area,
      id: area.id || slugify(area.name),
      confidence: clampScore(area.confidence),
    })),
    totalScore: 0,
    analysisMode: "ai",
  };

  normalized.totalScore = calculateWeightedScore(normalized.scoreBreakdown);
  normalized.shareText = createShareText(
    normalized.totalScore,
    normalized.detectedProfessionalAreas,
    analysisToProfile(normalized),
  );

  return normalized;
}

function normalizeScoreBreakdown(scoreBreakdown: ScoreBreakdown): ScoreBreakdown {
  return Object.fromEntries(
    Object.entries(scoreBreakdown).map(([key, value]) => [
      key,
      { ...value, score: clampScore(value.score) },
    ]),
  ) as ScoreBreakdown;
}

function extractOutputText(data: unknown): string {
  if (
    data &&
    typeof data === "object" &&
    "output_text" in data &&
    typeof data.output_text === "string"
  ) {
    return data.output_text;
  }

  const output = (data as { output?: Array<{ content?: Array<unknown> }> })?.output;
  const text = output
    ?.flatMap((item) => item.content ?? [])
    .find(
      (content): content is { type: string; text: string } =>
        typeof content === "object" &&
        content !== null &&
        "type" in content &&
        content.type === "output_text" &&
        "text" in content &&
        typeof content.text === "string",
    )?.text;

  if (!text) {
    throw new Error("OpenAI response did not include output_text.");
  }

  return text;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
