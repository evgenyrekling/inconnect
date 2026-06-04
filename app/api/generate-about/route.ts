import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  isUserProfileStorageError,
  upsertProfileFromAboutGenerator,
  upsertUserIdentity,
  type AboutProfileInputs,
  type AboutProfileOutputs,
} from "@/lib/user-profile-store";

export const runtime = "nodejs";

type AboutGeneratorRequest = AboutProfileInputs & {
  name: string;
  email: string;
  profileConsent: boolean;
};

const ABOUT_STYLES = [
  "Executive Version",
  "Authority Version",
  "Human Professional Version",
  "Commercial Version",
  "Thought Leadership Version",
] as const;
const MAX_SELECTIONS_PER_QUESTION = 10;

const aboutSchema = {
  type: "object",
  additionalProperties: false,
  required: ["recommendedIndex", "versions"],
  properties: {
    recommendedIndex: { type: "number" },
    versions: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "style",
          "aboutSection",
          "bestUseCase",
          "toneScore",
          "whyThisWorks",
        ],
        properties: {
          style: {
            type: "string",
            enum: ABOUT_STYLES,
          },
          aboutSection: { type: "string" },
          bestUseCase: { type: "string" },
          toneScore: { type: "number" },
          whyThisWorks: { type: "string" },
        },
      },
    },
  },
} as const;

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as unknown;
  const input = normalizeAboutRequest(payload);

  if (!input) {
    return NextResponse.json(
      {
        error:
          "Name, email, and all seven About Generator question answers are required.",
      },
      { status: 400 },
    );
  }

  if (!input.profileConsent) {
    return NextResponse.json(
      {
        error:
          "Consent is required before INConnect can store your profile information and About section results.",
      },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "About section generation is not configured yet." },
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
      temperature: 0.72,
      max_output_tokens: 2400,
      input: [
        {
          role: "system",
          content: [
            "You are INConnect, an AI LinkedIn Intelligence Platform.",
            "Generate premium LinkedIn About section options from user-provided positioning signals.",
            "Do not invent employers, credentials, awards, client names, metrics, revenue numbers, years of experience, or achievements.",
            "Use only the selected inputs and write in a LinkedIn-ready, professional style.",
            "Create clear structure, readable paragraphs, strong positioning, and an optional call to action.",
            "Avoid hype, emojis, hashtags, and fake proof.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Generate 3-5 LinkedIn About section options for this professional.",
            "Use these exact style labels when possible:",
            ABOUT_STYLES.join(", "),
            "",
            `Name for context only: ${input.name}`,
            `Professional roles: ${input.roles.join(", ")}`,
            `Industries: ${input.industries.join(", ")}`,
            `Expertise: ${input.expertise.join(", ")}`,
            `Business outcomes: ${input.values.join(", ")}`,
            `Desired professional identity: ${input.identities.join(", ")}`,
            `Writing style preferences: ${input.writingStyles.join(", ")}`,
            `Call to action preferences: ${input.callsToAction.join(", ")}`,
            "",
            "Required response:",
            "- versions: 3 to 5 complete LinkedIn About section options.",
            "- style: one of the exact requested style labels.",
            "- aboutSection: full LinkedIn About section with readable paragraphs.",
            "- bestUseCase: one short sentence.",
            "- toneScore: numeric score out of 10.",
            "- whyThisWorks: one short explanation of positioning strength.",
            "- recommendedIndex: zero-based index of the strongest option.",
          ].join("\n"),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "inconnect_linkedin_about_generator",
          strict: true,
          schema: aboutSchema,
        },
      },
    });

    if (!response.output_parsed) {
      return NextResponse.json(
        { error: "About section response format error." },
        { status: 502 },
      );
    }

    const normalizedResponse = normalizeAboutResponse(
      response.output_parsed as AboutProfileOutputs,
    );
    const inputs = getProfileInputs(input);

    const generationRecord = await createAboutGenerationRecord(supabase, {
      email: input.email,
      inputs,
      name: input.name,
      outputs: normalizedResponse,
      selectedVersion:
        normalizedResponse.versions[normalizedResponse.recommendedIndex]?.style ?? null,
      user,
    });

    const profileDebug = await upsertProfileFromAboutGenerator(supabase, {
      email: input.email,
      inputs,
      name: input.name,
      outputs: normalizedResponse,
      user,
    });
    const mergedProfileDebug = mergeProfileDebug(identityProfileDebug, profileDebug);

    console.info("INConnect about profile save flow completed", {
      userFound: mergedProfileDebug.userFound,
      userCreated: mergedProfileDebug.userCreated,
      userKeyUpdated: mergedProfileDebug.userKeyUpdated,
      profileFound: mergedProfileDebug.profileFound,
      profileCreated: mergedProfileDebug.profileCreated,
      profileUpdated: mergedProfileDebug.profileUpdated,
      profileMergeCompleted: mergedProfileDebug.profileMergeCompleted,
      fieldsUpdated: mergedProfileDebug.fieldsUpdated,
      generationId: generationRecord.id,
      userKey: user.user_key,
      email: normalizeEmail(input.email),
    });

    return NextResponse.json({
      ...normalizedResponse,
      generationId: generationRecord.id,
      userKey: user.user_key,
      profileDebug:
        process.env.NODE_ENV === "development" ? mergedProfileDebug : undefined,
    });
  } catch (error) {
    if (isUserProfileStorageError(error)) {
      const isDevelopment = process.env.NODE_ENV === "development";
      console.error("About profile storage failed", {
        stage: error.stage,
        error: error.message,
        details: error.details,
      });
      return NextResponse.json(
        {
          error: isDevelopment
            ? error.message
            : "About profile could not be stored. Please try again.",
          userMessage: "About profile could not be stored. Please try again.",
          stage: error.stage,
          details: isDevelopment ? error.details : "",
        },
        { status: 500 },
      );
    }
    if (error instanceof Error && /supabase/i.test(error.message)) {
      const isDevelopment = process.env.NODE_ENV === "development";
      console.error("About profile storage configuration failed", error);
      return NextResponse.json(
        {
          error: isDevelopment
            ? error.message
            : "About profile could not be stored. Please try again.",
          userMessage: "About profile could not be stored. Please try again.",
          stage: "Supabase configuration",
          details: isDevelopment ? error.stack || error.message : "",
        },
        { status: 500 },
      );
    }
    console.error("OpenAI about section generation failed", error);
    return NextResponse.json(
      { error: "About section generation failed. Please try again." },
      { status: 500 },
    );
  }
}

async function createAboutGenerationRecord(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  values: {
    email: string;
    inputs: AboutProfileInputs;
    name: string;
    outputs: AboutProfileOutputs;
    selectedVersion: string | null;
    user: {
      id: string;
      user_key: string;
    };
  },
) {
  const payload = {
    user_id: values.user.id,
    user_key: values.user.user_key,
    email: normalizeEmail(values.email),
    name: values.name.trim(),
    inputs: values.inputs,
    outputs: values.outputs,
    selected_version: values.selectedVersion,
  };

  console.info("INConnect Supabase about_generations insert payload", payload);

  const { data, error } = await supabase
    .from("about_generations")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();

  if (error) {
    console.error("INConnect Supabase about_generations insert error", {
      payload,
      error,
    });
    throw error;
  }

  return data;
}

function normalizeAboutRequest(value: unknown): AboutGeneratorRequest | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const input: AboutGeneratorRequest = {
    name: getString(record.name),
    email: getString(record.email),
    roles: getStringArray(record.roles).slice(0, MAX_SELECTIONS_PER_QUESTION),
    industries: getStringArray(record.industries).slice(0, MAX_SELECTIONS_PER_QUESTION),
    expertise: getStringArray(record.expertise).slice(0, MAX_SELECTIONS_PER_QUESTION),
    values: getStringArray(record.values).slice(0, MAX_SELECTIONS_PER_QUESTION),
    identities: getStringArray(record.identities).slice(0, MAX_SELECTIONS_PER_QUESTION),
    writingStyles: getStringArray(record.writingStyles).slice(
      0,
      MAX_SELECTIONS_PER_QUESTION,
    ),
    callsToAction: getStringArray(record.callsToAction).slice(
      0,
      MAX_SELECTIONS_PER_QUESTION,
    ),
    profileConsent: record.profileConsent === true,
  };

  if (
    input.name.length < 2 ||
    !isValidEmail(input.email) ||
    input.roles.length === 0 ||
    input.industries.length === 0 ||
    input.expertise.length === 0 ||
    input.values.length === 0 ||
    input.identities.length === 0 ||
    input.writingStyles.length === 0 ||
    input.callsToAction.length === 0
  ) {
    return null;
  }

  return input;
}

function normalizeAboutResponse(response: AboutProfileOutputs): AboutProfileOutputs {
  const versions = response.versions
    .map((version) => ({
      style: ABOUT_STYLES.includes(version.style as (typeof ABOUT_STYLES)[number])
        ? version.style
        : "Professional Version",
      aboutSection: version.aboutSection.trim().slice(0, 3200),
      bestUseCase: version.bestUseCase.trim(),
      toneScore: Math.min(10, Math.max(0, Number(version.toneScore) || 0)),
      whyThisWorks: version.whyThisWorks.trim(),
    }))
    .filter(
      (version) =>
        version.aboutSection && version.bestUseCase && version.whyThisWorks,
    )
    .slice(0, 5);

  if (versions.length === 0) {
    throw new Error("About section response did not include usable options.");
  }

  return {
    recommendedIndex: Math.min(
      Math.max(Math.round(response.recommendedIndex), 0),
      versions.length - 1,
    ),
    versions,
  };
}

function getProfileInputs(input: AboutGeneratorRequest): AboutProfileInputs {
  return {
    roles: input.roles,
    industries: input.industries,
    expertise: input.expertise,
    values: input.values,
    identities: input.identities,
    writingStyles: input.writingStyles,
    callsToAction: input.callsToAction,
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
        .map((item) => item.trim().slice(0, 160))
        .filter(Boolean),
    ),
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
