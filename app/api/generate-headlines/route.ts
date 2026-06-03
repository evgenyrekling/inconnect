import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  isUserProfileStorageError,
  upsertProfileFromHeadlineGenerator,
  upsertUserIdentity,
} from "@/lib/user-profile-store";

export const runtime = "nodejs";

type HeadlineGeneratorRequest = {
  name: string;
  email: string;
  roles: string[];
  industries: string[];
  expertise: string[];
  values: string[];
  perceptions: string[];
  profileConsent: boolean;
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
const MAX_SELECTIONS_PER_QUESTION = 10;

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

  if (!input.profileConsent) {
    return NextResponse.json(
      {
        error:
          "Consent is required before INConnect can store your profile information and headline results.",
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
    const supabase = getSupabaseAdminClient();
    const isAdminUser = getAdminEmails().includes(normalizeEmail(input.email));
    const { user, debug: identityProfileDebug } = await upsertUserIdentity(supabase, {
      email: input.email,
      isAdminUser,
      planType: isAdminUser ? "admin" : "free",
    });
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
            "Create headlines for the LinkedIn headline field only.",
            "Never include the user's name in any headline.",
            "Do not invent credentials, employers, degrees, awards, years of experience, client names, revenue numbers, or unverifiable claims.",
            "Keep every headline concise, senior, strategic, and under 220 characters.",
            "Use selected inputs to prioritize relevance, but do not try to include every input.",
            "Avoid keyword stuffing, awkward wording, repeated concepts, and overly long headlines.",
            "Avoid hype, emojis, hashtags, and vague buzzwords.",
            "Use concise, professional wording suitable for LinkedIn.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Generate 3-5 LinkedIn headline options for this professional.",
            "These are LinkedIn headline field options, not profile names, titles, or score-card headings.",
            "Do not include the person's name in any headline output.",
            "Generate 3-5 different headline styles with distinct positioning angles.",
            "Use the five requested styles when possible:",
            HEADLINE_STYLES.join(", "),
            "",
            `Profile name for internal personalization only, never for headline output: ${input.name}`,
            `Roles: ${input.roles.join(", ")}`,
            `Target industries: ${input.industries.join(", ")}`,
            `Expertise areas: ${input.expertise.join(", ")}`,
            `Business value or outcomes: ${input.values.join(", ")}`,
            `Desired perception: ${input.perceptions.join(", ")}`,
            "",
            "Required response:",
            "- headlines: 3 to 5 options.",
            "- style: one of the exact requested style labels.",
            "- headline: a LinkedIn-ready headline under 220 characters and without the user's name.",
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

    const normalizedResponse = normalizeHeadlineResponse(
      response.output_parsed as HeadlineGeneratorResponse,
      input.name,
    );
    const profileDebug = await upsertProfileFromHeadlineGenerator(supabase, {
      email: input.email,
      inputs: {
        roles: input.roles,
        industries: input.industries,
        expertise: input.expertise,
        values: input.values,
        perceptions: input.perceptions,
      },
      name: input.name,
      outputs: normalizedResponse,
      user,
    });
    const mergedProfileDebug = mergeProfileDebug(identityProfileDebug, profileDebug);

    console.info("INConnect headline profile save flow completed", {
      userFound: mergedProfileDebug.userFound,
      userCreated: mergedProfileDebug.userCreated,
      userKeyUpdated: mergedProfileDebug.userKeyUpdated,
      profileFound: mergedProfileDebug.profileFound,
      profileCreated: mergedProfileDebug.profileCreated,
      profileUpdated: mergedProfileDebug.profileUpdated,
      profileMergeCompleted: mergedProfileDebug.profileMergeCompleted,
      fieldsUpdated: mergedProfileDebug.fieldsUpdated,
      userKey: user.user_key,
      email: normalizeEmail(input.email),
    });

    return NextResponse.json({
      ...normalizedResponse,
      userKey: user.user_key,
      profileDebug:
        process.env.NODE_ENV === "development"
          ? mergedProfileDebug
          : undefined,
    });
  } catch (error) {
    if (isUserProfileStorageError(error)) {
      const isDevelopment = process.env.NODE_ENV === "development";
      console.error("Headline profile storage failed", {
        stage: error.stage,
        error: error.message,
        details: error.details,
      });
      return NextResponse.json(
        {
          error: isDevelopment
            ? error.message
            : "Headline profile could not be stored. Please try again.",
          userMessage: "Headline profile could not be stored. Please try again.",
          stage: error.stage,
          details: isDevelopment ? error.details : "",
        },
        { status: 500 },
      );
    }
    if (error instanceof Error && /supabase/i.test(error.message)) {
      const isDevelopment = process.env.NODE_ENV === "development";
      console.error("Headline profile storage configuration failed", error);
      return NextResponse.json(
        {
          error: isDevelopment
            ? error.message
            : "Headline profile could not be stored. Please try again.",
          userMessage: "Headline profile could not be stored. Please try again.",
          stage: "Supabase configuration",
          details: isDevelopment ? error.stack || error.message : "",
        },
        { status: 500 },
      );
    }
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
  const roles = getStringArray(record.roles).slice(0, MAX_SELECTIONS_PER_QUESTION);
  const industries = getStringArray(record.industries).slice(
    0,
    MAX_SELECTIONS_PER_QUESTION,
  );
  const expertise = getStringArray(record.expertise).slice(
    0,
    MAX_SELECTIONS_PER_QUESTION,
  );
  const values = getStringArray(record.values).slice(0, MAX_SELECTIONS_PER_QUESTION);
  const perceptions = getStringArray(record.perceptions).slice(
    0,
    MAX_SELECTIONS_PER_QUESTION,
  );
  const profileConsent = record.profileConsent === true;

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
    profileConsent,
  };
}

function normalizeHeadlineResponse(
  response: HeadlineGeneratorResponse,
  userName: string,
): HeadlineGeneratorResponse {
  const headlines = response.headlines
    .map((headline) => ({
      style: HEADLINE_STYLES.includes(
        headline.style as (typeof HEADLINE_STYLES)[number],
      )
        ? headline.style
        : "Clear Professional Style",
      headline: removeUserNameFromHeadline(headline.headline, userName).slice(0, 220),
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

function removeUserNameFromHeadline(headline: string, userName: string) {
  const nameParts = userName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
  const candidates = Array.from(new Set([userName.trim(), ...nameParts].filter(Boolean)));

  let cleaned = headline.trim();
  for (const candidate of candidates) {
    cleaned = cleaned.replace(
      new RegExp(`\\b${escapeRegExp(candidate)}\\b`, "gi"),
      "",
    );
  }

  return cleaned
    .replace(/\s*\|\s*\|/g, " | ")
    .replace(/\s*[-:;,]\s*([|])/g, " $1")
    .replace(/^\s*[|:;,-]+\s*/g, "")
    .replace(/\s*[|:;,-]+\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\|\s+/g, " | ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function mergeProfileDebug(
  identityDebug: {
    userFound: boolean;
    userCreated: boolean;
    userKeyUpdated: boolean;
    fieldsUpdated: string[];
  },
  profileDebug: {
    profileFound: boolean;
    profileCreated: boolean;
    profileUpdated: boolean;
    profileMergeCompleted: boolean;
    fieldsUpdated: string[];
  },
) {
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
