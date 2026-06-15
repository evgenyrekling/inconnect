import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  isUserProfileStorageError,
  upsertProfileFromArticleGenerator,
  getOrCreateUserByEmail,
  UserProfileStorageError,
  type ArticleProfileInputs,
  type ArticleProfileOutputs,
} from "@/lib/user-profile-store";

export const runtime = "nodejs";

type ArticleGeneratorRequest = ArticleProfileInputs & {
  email: string;
};

const ARTICLE_TONES = [
  "Professional",
  "Thought leadership",
  "Technical",
  "Executive",
  "Educational",
  "Provocative",
  "Story-driven",
] as const;

const INCONNECT_ATTRIBUTION =
  "Prepared with support from INConnect.app, an AI LinkedIn intelligence platform for professionals and companies.";

const articleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "subtitle", "article", "announcementPost", "hashtags"],
  properties: {
    headline: { type: "string" },
    subtitle: { type: "string" },
    article: { type: "string" },
    announcementPost: { type: "string" },
    hashtags: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: { type: "string" },
    },
  },
} as const;

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as unknown;
  const input = normalizeArticleRequest(payload);

  if (!input) {
    return NextResponse.json(
      {
        error:
          "Email, article topic, industry, audience, tone, and key points are required.",
      },
      { status: 400 },
    );
  }

  if (!getAdminEmails().includes(normalizeEmail(input.email))) {
    return NextResponse.json(
      {
        error: "LinkedIn Article Generator is coming soon in Pro.",
        isLocked: true,
      },
      { status: 403 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Article generation is not configured yet." },
      { status: 500 },
    );
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { user, debug: identityProfileDebug } = await getOrCreateUserByEmail(supabase, {
      email: input.email,
      isAdminUser: true,
      planType: "admin",
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.parse({
      model: "gpt-4o-mini",
      temperature: 0.72,
      max_output_tokens: 4200,
      input: [
        {
          role: "system",
          content: [
            "You are INConnect, an AI LinkedIn Intelligence Platform.",
            "Generate LinkedIn-style long-form articles for professional and company positioning.",
            "Write for LinkedIn articles, not a short post, blog SEO page, or press release.",
            "Use a clear headline, concise subtitle, structured article body, short announcement post, and relevant hashtags.",
            "Do not invent client names, awards, revenue, credentials, or unverifiable facts.",
            "Avoid emojis, hype, spammy calls to action, and keyword stuffing.",
            "Keep the article professional, useful, and ready for human review before publishing.",
            input.addInconnectMention
              ? `Include this exact soft attribution once near the end: "${INCONNECT_ATTRIBUTION}"`
              : "Do not mention INConnect unless it is directly useful to the article.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Generate a LinkedIn long-form article package.",
            "",
            `Article topic: ${input.topic}`,
            `Industry: ${input.industry}`,
            `Audience: ${input.targetAudience}`,
            `Tone: ${input.tone}`,
            `Key points to include: ${input.keyPoints.join("; ")}`,
            input.sourceNotes ? `Optional sources: ${input.sourceNotes}` : "",
            input.cta ? `CTA: ${input.cta}` : "",
            `Soft INConnect mention enabled: ${input.addInconnectMention ? "yes" : "no"}`,
            "",
            "Required response:",
            "- headline: one strong LinkedIn article headline.",
            "- subtitle: one concise subtitle.",
            "- article: a complete LinkedIn article with short sections, readable paragraphs, and practical insight.",
            "- announcementPost: a short LinkedIn post to announce the article.",
            "- hashtags: 3 to 8 relevant hashtags.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "inconnect_linkedin_article_generator",
          strict: true,
          schema: articleSchema,
        },
      },
    });

    if (!response.output_parsed) {
      return NextResponse.json(
        { error: "Article response format error." },
        { status: 502 },
      );
    }

    const outputs = normalizeArticleResponse(
      response.output_parsed as ArticleProfileOutputs,
      input.addInconnectMention,
    );
    const generationRecord = await createArticleGenerationRecord(supabase, {
      email: input.email,
      inputs: input,
      outputs,
      user,
    });
    const profileDebug = await upsertProfileFromArticleGenerator(supabase, {
      email: input.email,
      inputs: input,
      outputs,
      user,
    });
    const mergedProfileDebug = mergeProfileDebug(identityProfileDebug, profileDebug);

    console.info("INConnect article generation save flow completed", {
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
      ...outputs,
      generationId: generationRecord.id,
      userKey: user.user_key,
      profileDebug:
        process.env.NODE_ENV === "development" ? mergedProfileDebug : undefined,
    });
  } catch (error) {
    if (isUserProfileStorageError(error)) {
      const isDevelopment = process.env.NODE_ENV === "development";
      console.error("Article profile storage failed", {
        stage: error.stage,
        error: error.message,
        details: error.details,
        supabaseMessage: error.supabaseMessage,
        supabaseDetails: error.supabaseDetails,
        supabaseHint: error.supabaseHint,
        supabaseCode: error.supabaseCode,
      });
      return NextResponse.json(
        {
          error: isDevelopment
            ? error.message
            : "Article profile could not be stored. Please try again.",
          userMessage: "Article profile could not be stored. Please try again.",
          stage: error.stage,
          details: isDevelopment ? error.details : "",
        },
        { status: 500 },
      );
    }
    if (error instanceof Error && /supabase/i.test(error.message)) {
      const isDevelopment = process.env.NODE_ENV === "development";
      console.error("Article profile storage configuration failed", error);
      return NextResponse.json(
        {
          error: isDevelopment
            ? error.message
            : "Article profile could not be stored. Please try again.",
          userMessage: "Article profile could not be stored. Please try again.",
          stage: "Supabase configuration",
          details: isDevelopment ? error.stack || error.message : "",
        },
        { status: 500 },
      );
    }
    console.error("OpenAI article generation failed", error);
    return NextResponse.json(
      { error: "Article generation failed. Please try again." },
      { status: 500 },
    );
  }
}

async function createArticleGenerationRecord(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  values: {
    email: string;
    inputs: ArticleProfileInputs;
    outputs: ArticleProfileOutputs;
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
    topic: values.inputs.topic,
    inputs: values.inputs,
    outputs: values.outputs,
    created_at: new Date().toISOString(),
  };

  console.info("INConnect Supabase article_generations insert payload", payload);

  const { data, error } = await supabase
    .from("article_generations")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();

  if (error) {
    console.error("INConnect Supabase article_generations insert error", {
      payload,
      error,
    });
    throw new UserProfileStorageError("article_generations insert", error);
  }

  return data;
}

function normalizeArticleRequest(value: unknown): ArticleGeneratorRequest | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const email = getString(record.email);
  const tone = getString(record.tone);
  const input: ArticleGeneratorRequest = {
    addInconnectMention: record.addInconnectMention === true,
    cta: getString(record.cta),
    email,
    industry: getString(record.industry),
    keyPoints: getStringArray(record.keyPoints).slice(0, 12),
    sourceNotes: getString(record.sourceNotes).slice(0, 5000),
    targetAudience: getString(record.targetAudience),
    tone: ARTICLE_TONES.includes(tone as (typeof ARTICLE_TONES)[number])
      ? tone
      : "Professional",
    topic: getString(record.topic),
  };

  if (
    !isValidEmail(input.email) ||
    input.topic.length < 4 ||
    input.targetAudience.length < 3 ||
    input.industry.length < 2 ||
    input.keyPoints.length === 0
  ) {
    return null;
  }

  return input;
}

function normalizeArticleResponse(
  response: ArticleProfileOutputs,
  shouldAddInconnectMention: boolean,
): ArticleProfileOutputs {
  const article = ensureSoftAttribution(
    cleanText(response.article, 9000),
    shouldAddInconnectMention,
  );
  return {
    announcementPost: cleanText(response.announcementPost, 1600),
    article,
    hashtags: normalizeHashtags(response.hashtags),
    headline: cleanText(response.headline, 180),
    subtitle: cleanText(response.subtitle, 260),
  };
}

function ensureSoftAttribution(article: string, shouldAddInconnectMention: boolean) {
  if (!shouldAddInconnectMention || article.includes("INConnect.app")) return article;
  return `${article}\n\n${INCONNECT_ATTRIBUTION}`;
}

function normalizeHashtags(value: unknown) {
  const hashtags = Array.isArray(value) ? value : [];
  return hashtags
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/^#+/, "").replace(/\s+/g, ""))
    .filter(Boolean)
    .slice(0, 8)
    .map((item) => `#${item}`);
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
        .map((item) => item.trim().slice(0, 260))
        .filter(Boolean),
    ),
  );
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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
