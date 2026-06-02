import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type HeadlineGeneratorRequest = {
  name: string;
  email: string;
  roles: string[];
  industries: string[];
  expertise: string[];
  values: string[];
  perceptions: string[];
};

type HeadlineOption = {
  style: string;
  headline: string;
  score: number;
  reason: string;
  bestFor: string;
};

type HeadlineGeneratorResponse = {
  recommendedIndex: number;
  headlines: HeadlineOption[];
};

const HEADLINE_STYLES = [
  "Authority Style",
  "Executive Style",
  "Commercial Style",
  "Thought Leadership Style",
  "Clear Professional Style",
] as const;

const headlineSchema = {
  type: "object",
  additionalProperties: false,
  required: ["recommendedIndex", "headlines"],
  properties: {
    recommendedIndex: { type: "number" },
    headlines: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["style", "headline", "score", "reason", "bestFor"],
        properties: {
          style: {
            type: "string",
            enum: HEADLINE_STYLES,
          },
          headline: { type: "string" },
          score: { type: "number" },
          reason: { type: "string" },
          bestFor: { type: "string" },
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
          "Name, email, and all five positioning question answers are required.",
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
      model: "gpt-4o-mini",
      temperature: 0.75,
      max_output_tokens: 1300,
      input: [
        {
          role: "system",
          content: [
            "You are INConnect, an AI LinkedIn Intelligence Platform.",
            "Generate premium LinkedIn headline options from positioning signals.",
            "Do not invent credentials, employers, degrees, awards, years of experience, client names, revenue numbers, or unverifiable claims.",
            "Keep every headline under 220 characters.",
            "Avoid hype, emojis, hashtags, and vague buzzwords.",
            "Use concise, professional wording suitable for LinkedIn.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Generate 3-5 LinkedIn headline options for this professional.",
            "Use the five requested styles when possible:",
            HEADLINE_STYLES.join(", "),
            "",
            `Name: ${input.name}`,
            `Roles: ${input.roles.join(", ")}`,
            `Target industries: ${input.industries.join(", ")}`,
            `Expertise areas: ${input.expertise.join(", ")}`,
            `Business value or outcomes: ${input.values.join(", ")}`,
            `Desired perception: ${input.perceptions.join(", ")}`,
            "",
            "Required response:",
            "- headlines: 3 to 5 options.",
            "- style: one of the exact requested style labels.",
            "- headline: a LinkedIn-ready headline under 220 characters.",
            "- score: numeric quality score out of 10.",
            "- reason: one short explanation for why the headline works.",
            "- bestFor: one short description of the best use case.",
            "- recommendedIndex: zero-based index of the strongest headline.",
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
  const name = getString(record.name);
  const email = getString(record.email);
  const roles = getStringArray(record.roles).slice(0, 3);
  const industries = getStringArray(record.industries).slice(0, 5);
  const expertise = getStringArray(record.expertise).slice(0, 5);
  const values = getStringArray(record.values).slice(0, 5);
  const perceptions = getStringArray(record.perceptions).slice(0, 3);

  if (
    name.length < 2 ||
    !isValidEmail(email) ||
    roles.length === 0 ||
    industries.length === 0 ||
    expertise.length === 0 ||
    values.length === 0 ||
    perceptions.length === 0
  ) {
    return null;
  }

  return {
    name,
    email,
    roles,
    industries,
    expertise,
    values,
    perceptions,
  };
}

function normalizeHeadlineResponse(
  response: HeadlineGeneratorResponse,
): HeadlineGeneratorResponse {
  const headlines = response.headlines
    .map((headline) => ({
      style: HEADLINE_STYLES.includes(
        headline.style as (typeof HEADLINE_STYLES)[number],
      )
        ? headline.style
        : "Clear Professional Style",
      headline: headline.headline.trim().slice(0, 220),
      score: Math.min(10, Math.max(0, Number(headline.score) || 0)),
      reason: headline.reason.trim(),
      bestFor: headline.bestFor.trim(),
    }))
    .filter((headline) => headline.headline && headline.reason && headline.bestFor)
    .slice(0, 5);

  if (headlines.length === 0) {
    throw new Error("Headline response did not include usable options.");
  }

  return {
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
        .map((item) => item.trim().slice(0, 120))
        .filter(Boolean),
    ),
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
