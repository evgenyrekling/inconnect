import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type HeadlineGeneratorRequest = {
  currentRole: string;
  targetAudience: string;
  expertiseAreas: string[];
  businessValue: string[];
  desiredPerception: string[];
  stylePreferences: string[];
  proofPoints: string;
  customInstructions: string;
};

type HeadlineGeneratorResponse = {
  positioningSummary: string;
  recommendedIndex: number;
  headlines: Array<{
    style: string;
    headline: string;
    rationale: string;
  }>;
};

const headlineSchema = {
  type: "object",
  additionalProperties: false,
  required: ["positioningSummary", "recommendedIndex", "headlines"],
  properties: {
    positioningSummary: { type: "string" },
    recommendedIndex: { type: "number" },
    headlines: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["style", "headline", "rationale"],
        properties: {
          style: {
            type: "string",
            enum: [
              "Executive",
              "Founder",
              "Consultant",
              "Technical Expert",
              "Sales Leader",
              "Creator",
              "Strategic",
              "Commercial",
            ],
          },
          headline: { type: "string" },
          rationale: { type: "string" },
        },
      },
    },
  },
} as const;

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as unknown;
  const input = normalizeHeadlineRequest(payload);

  if (!input) {
    return NextResponse.json(
      {
        error:
          "Role, target audience, expertise areas, and business value are required.",
      },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Headline generation is not configured yet." },
      { status: 500 },
    );
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.parse({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.8,
      max_output_tokens: 1200,
      input: [
        {
          role: "system",
          content: [
            "You are INConnect, an AI LinkedIn Intelligence Platform.",
            "Create premium LinkedIn headlines that communicate positioning, authority, and business value.",
            "Do not invent credentials, employers, degrees, awards, revenue numbers, client names, or years of experience unless provided.",
            "Headlines must be professional, specific, and suitable for LinkedIn.",
            "Keep each headline under 220 characters.",
            "Avoid hype, emojis, hashtags, and generic buzzwords.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Generate 3-5 LinkedIn headline options and choose one recommended headline.",
            "",
            `Current role: ${input.currentRole}`,
            `Target audience: ${input.targetAudience}`,
            `Expertise areas: ${input.expertiseAreas.join(", ")}`,
            `Business value: ${input.businessValue.join(", ")}`,
            `Desired market perception: ${input.desiredPerception.join(", ") || "Not specified"}`,
            `Preferred styles: ${input.stylePreferences.join(", ") || "Executive, Strategic"}`,
            `Proof points: ${input.proofPoints || "Not specified"}`,
            `Custom direction: ${input.customInstructions || "Not specified"}`,
            "",
            "Required response:",
            "- positioningSummary: one concise sentence describing the user's strongest positioning angle.",
            "- headlines: 3 to 5 options across different styles.",
            "- recommendedIndex: zero-based index of the strongest headline.",
            "- rationale: one short explanation for why each headline works.",
          ].join("\n"),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "inconnect_linkedin_headline_generator",
          strict: true,
          schema: headlineSchema,
        },
      },
    });

    if (!response.output_parsed) {
      return NextResponse.json(
        { error: "Headline response format error." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      normalizeHeadlineResponse(response.output_parsed as HeadlineGeneratorResponse),
    );
  } catch (error) {
    console.error("OpenAI headline generation failed", error);
    return NextResponse.json(
      { error: "Headline generation failed. Please try again." },
      { status: 500 },
    );
  }
}

function normalizeHeadlineRequest(value: unknown): HeadlineGeneratorRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const currentRole = getString(record.currentRole);
  const targetAudience = getString(record.targetAudience);
  const expertiseAreas = getStringArray(record.expertiseAreas).slice(0, 12);
  const businessValue = getStringArray(record.businessValue).slice(0, 12);
  const desiredPerception = getStringArray(record.desiredPerception).slice(0, 12);
  const stylePreferences = getStringArray(record.stylePreferences).slice(0, 6);

  if (
    !currentRole ||
    !targetAudience ||
    expertiseAreas.length === 0 ||
    businessValue.length === 0
  ) {
    return null;
  }

  return {
    currentRole,
    targetAudience,
    expertiseAreas,
    businessValue,
    desiredPerception,
    stylePreferences,
    proofPoints: getString(record.proofPoints),
    customInstructions: getString(record.customInstructions),
  };
}

function normalizeHeadlineResponse(
  response: HeadlineGeneratorResponse,
): HeadlineGeneratorResponse {
  const headlines = response.headlines
    .map((headline) => ({
      style: headline.style.trim() || "Strategic",
      headline: headline.headline.trim().slice(0, 220),
      rationale: headline.rationale.trim(),
    }))
    .filter((headline) => headline.headline && headline.rationale)
    .slice(0, 5);

  if (headlines.length === 0) {
    throw new Error("Headline response did not include usable options.");
  }

  return {
    positioningSummary: response.positioningSummary.trim(),
    recommendedIndex: Math.min(
      Math.max(Math.round(response.recommendedIndex), 0),
      headlines.length - 1,
    ),
    headlines,
  };
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}
