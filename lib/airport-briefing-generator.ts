import OpenAI from "openai";
import {
  researchBlogTopic,
  type BlogResearchExistingPost,
  type BlogResearchResult,
} from "@/lib/blog-research";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type GeneratedAirportBriefing = {
  content: string;
  excerpt: string;
  seoDescription: string;
  seoTitle: string;
  slug: string;
  title: string;
};

type ExistingAirportBriefing = {
  created_at: string;
  generated_at: string | null;
  hero_image_prompt: string | null;
  slug: string | null;
  title: string | null;
};

type StoredAirportBriefing = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  generated_at: string | null;
  created_at: string;
  hero_image_url: string | null;
};

type AirportHeroImageResult = {
  prompt: string;
  url: string;
};

type AirportBriefingQuality = {
  issues: string[];
  sectionCount: number;
  wordCount: number;
};

export class AirportBriefingGenerationError extends Error {
  constructor(
    public readonly stage: string,
    message: string,
  ) {
    super(message);
    this.name = "AirportBriefingGenerationError";
  }
}

const AIRPORT_IMAGE_BUCKET = "airport-briefing-images";
const DEFAULT_AIRPORT_HERO_IMAGE_URL = "/hero-professionals-collage.png";
const OPENAI_IMAGE_MODEL = "gpt-image-2";
const OPENAI_AIRPORT_IMAGE_SIZE = "1536x864";
const MIN_AIRPORT_WORD_COUNT = 1200;

const AIRPORT_BRIEFING_TOPIC = {
  category: "Airport Automation",
  topic:
    "airport automation, baggage handling systems, RFID baggage tracking, passenger processing, biometrics, airport security, AI, LiDAR, robotics, digital airports, smart airport infrastructure, and airport automation projects",
};

const airportBriefingSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "slug",
    "excerpt",
    "seoTitle",
    "seoDescription",
    "content",
  ],
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    excerpt: { type: "string" },
    seoTitle: { type: "string" },
    seoDescription: { type: "string" },
    content: { type: "string" },
  },
} as const;

const airportBriefingExpansionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["content"],
  properties: {
    content: { type: "string" },
  },
} as const;

export async function generateAndStoreAirportBriefing(options?: {
  source?: "admin-manual" | "cron";
}) {
  const source = options?.source ?? "cron";
  console.info("INConnect airport briefing generation started", { source });

  if (!process.env.OPENAI_API_KEY) {
    throw new AirportBriefingGenerationError(
      "configuration",
      "OpenAI is not configured for airport briefing generation.",
    );
  }

  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    throw toAirportBriefingError("supabase_configuration", error);
  }

  const existingBriefings = await getExistingAirportBriefings(supabase);
  const researchExistingPosts = existingBriefings.map((briefing) => ({
    article_angle: null,
    category: "Airport Automation",
    created_at: briefing.created_at,
    title: briefing.title,
  })) satisfies BlogResearchExistingPost[];

  let research: BlogResearchResult;
  try {
    research = await researchBlogTopic(AIRPORT_BRIEFING_TOPIC, researchExistingPosts);
  } catch (error) {
    console.error("INConnect airport briefing web research failure", error);
    throw toAirportBriefingError("web_research", error);
  }

  let generatedBriefing: GeneratedAirportBriefing;
  try {
    generatedBriefing = await generateAirportBriefing(research);
    console.info("INConnect OpenAI airport briefing generation success", {
      sourceCount: research.researchSources.length,
      title: generatedBriefing.title,
    });
  } catch (error) {
    console.error("INConnect OpenAI airport briefing generation failure", error);
    throw toAirportBriefingError("openai_generation", error);
  }

  const title = ensureUniqueTitle(
    cleanText(generatedBriefing.title || createDefaultAirportTitle(), 180),
    existingBriefings,
  );
  const slug = ensureUniqueSlug(generatedBriefing.slug || title, existingBriefings);
  const { content, quality } = await prepareQualityCheckedAirportContent({
    generatedBriefing,
    research,
    title,
  });
  const heroImage = await generateAndUploadAirportHeroImage({
    recentBriefings: existingBriefings.slice(0, 10),
    slug,
    supabase,
    title,
  });
  const now = new Date().toISOString();
  const payload = {
    slug,
    title,
    excerpt: cleanText(generatedBriefing.excerpt, 360),
    content,
    hero_image_url: heroImage.url,
    hero_image_prompt: heroImage.prompt,
    seo_title: cleanText(generatedBriefing.seoTitle || title, 180),
    seo_description: cleanText(
      generatedBriefing.seoDescription || generatedBriefing.excerpt,
      320,
    ),
    published: true,
    generated_at: now,
    created_at: now,
  };

  console.info("INConnect airport_briefings insert payload", {
    ...payload,
    content: `${payload.content.slice(0, 220)}...`,
    quality,
  });

  const { data, error } = await supabase
    .from("airport_briefings")
    .insert(payload)
    .select("id, slug, title, published, generated_at, created_at, hero_image_url")
    .single<StoredAirportBriefing>();

  if (error) {
    console.error("INConnect Supabase airport_briefings insert failure", {
      error,
      slug,
      title,
    });
    throw new AirportBriefingGenerationError(
      "supabase_insert",
      error.message || "Airport briefing insert failed.",
    );
  }

  console.info("INConnect Supabase airport_briefings insert success", {
    heroImageUrl: data.hero_image_url,
    id: data.id,
    published: data.published,
    slug: data.slug,
  });

  return {
    briefing: data,
    published: true,
  };
}

async function getExistingAirportBriefings(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { data, error } = await supabase
    .from("airport_briefings")
    .select("slug, title, created_at, generated_at, hero_image_prompt")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<ExistingAirportBriefing[]>();

  if (error) {
    console.error("AIRPORT_BRIEFINGS EXISTING LOOKUP ERROR", error);
    return [];
  }

  return data ?? [];
}

async function generateAirportBriefing(research: BlogResearchResult) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const briefingDate = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date());

  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    temperature: 0.65,
    max_output_tokens: 6500,
    input: [
      {
        role: "system",
        content: [
          "You are INConnect Airport Automation Daily, a professional intelligence briefing for airport automation, aviation technology, and smart airport infrastructure.",
          "Generate original analysis based only on the provided source context.",
          "Do not invent airport projects, contracts, pilots, deployments, acquisitions, passenger statistics, financial figures, or company claims.",
          "If the source context does not support a specific claim, write at the category or trend level instead of naming a project.",
          "Do not copy source wording or structure.",
          "Do not include external source lists, further reading sections, raw URLs, or external Markdown links.",
          "Write for professionals in airports, airlines, BHS, RFID, passenger processing, biometrics, airport security, AI, LiDAR, robotics, and digital airport operations.",
          "Use clean Markdown only. Do not repeat the title as a leading # heading.",
          "Use ## section headings exactly for: Date, Executive Summary, Top Developments, Industry Impact, Technology Trends, Business Opportunities, Companies Mentioned, Recommended LinkedIn Post.",
          "Business Opportunities, Industry Impact, Technology Trends, and Recommended LinkedIn Post should be useful but should not overclaim.",
          "Minimum 1,200 words. Target 1,200 to 1,800 words. Avoid generic filler.",
          "Use short paragraphs and practical bullet lists.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Briefing date: ${briefingDate}`,
          `Research angle: ${research.articleAngle}`,
          "",
          "Research summary:",
          research.researchSummary,
          "",
          "Source references to use as context only:",
          ...research.researchSources.map(
            (source, index) =>
              `${index + 1}. ${source.title} | ${source.domain} | ${source.url} | ${source.excerpt}`,
          ),
          "",
          "Return structured JSON only.",
          "The content field must include these sections in this order:",
          "## Date",
          "## Executive Summary",
          "## Top Developments",
          "## Industry Impact",
          "## Technology Trends",
          "## Business Opportunities",
          "## Companies Mentioned",
          "## Recommended LinkedIn Post",
          "",
          "If company names are not clearly supported by the sources, say that no company-specific claims are included in today's briefing rather than inventing names.",
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "inconnect_airport_automation_briefing",
        strict: true,
        schema: airportBriefingSchema,
      },
    },
  });

  if (!response.output_parsed) {
    throw new Error("Airport briefing response format error.");
  }

  const parsed = response.output_parsed as GeneratedAirportBriefing;
  if (!parsed.title || !parsed.content || parsed.content.trim().length < 500) {
    throw new Error("Generated airport briefing was empty or incomplete.");
  }

  return parsed;
}

async function prepareQualityCheckedAirportContent({
  generatedBriefing,
  research,
  title,
}: {
  generatedBriefing: GeneratedAirportBriefing;
  research: BlogResearchResult;
  title: string;
}) {
  let content = stripLeadingTitleHeading(generatedBriefing.content, generatedBriefing.title);
  let quality = getAirportBriefingQuality(content, research);

  console.info("INConnect airport briefing initial quality check", {
    issues: quality.issues,
    sectionCount: quality.sectionCount,
    title,
    wordCount: quality.wordCount,
  });

  for (
    let expansionAttempt = 1;
    quality.wordCount < MIN_AIRPORT_WORD_COUNT && expansionAttempt <= 2;
    expansionAttempt += 1
  ) {
    console.info("INConnect airport briefing expansion started", {
      expansionAttempt,
      title,
      wordCount: quality.wordCount,
    });
    content = await expandAirportBriefing({
      content,
      expansionAttempt,
      research,
      title,
    });
    quality = getAirportBriefingQuality(content, research);
    console.info("INConnect airport briefing expansion quality check", {
      expansionAttempt,
      issues: quality.issues,
      sectionCount: quality.sectionCount,
      title,
      wordCount: quality.wordCount,
    });
  }

  console.info("INConnect airport briefing final quality check result", {
    issues: quality.issues,
    passed: quality.issues.length === 0,
    sectionCount: quality.sectionCount,
    title,
    wordCount: quality.wordCount,
  });

  if (quality.issues.length > 0) {
    throw new AirportBriefingGenerationError(
      "quality_check",
      `Airport briefing failed quality checks: ${quality.issues.join(" ")}`,
    );
  }

  return { content, quality };
}

async function expandAirportBriefing({
  content,
  expansionAttempt,
  research,
  title,
}: {
  content: string;
  expansionAttempt: number;
  research: BlogResearchResult;
  title: string;
}) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    temperature: 0.55,
    max_output_tokens: 5000,
    input: [
      {
        role: "system",
        content: [
          "You are expanding an Airport Automation Daily briefing that was too short.",
          "Preserve the existing section order and factual caution.",
          "Expand to 1,300-1,700 words with more airport-specific context, practical examples, and actionable analysis.",
          "Do not invent airport projects, contracts, deployments, or company claims.",
          "Use only the provided research context.",
          "Do not add external links, source lists, or generic filler.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Title: ${title}`,
          `Expansion attempt: ${expansionAttempt}`,
          "",
          "Research summary:",
          research.researchSummary,
          "",
          "Current briefing markdown:",
          content,
          "",
          "Return structured JSON only with the expanded markdown in the content field.",
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "inconnect_airport_briefing_expansion",
        strict: true,
        schema: airportBriefingExpansionSchema,
      },
    },
  });

  if (!response.output_parsed) {
    throw new Error("Expanded airport briefing response format error.");
  }

  const parsed = response.output_parsed as { content: string };
  if (!parsed.content || parsed.content.trim().length < 500) {
    throw new Error("Expanded airport briefing was empty or incomplete.");
  }

  return parsed.content.trim();
}

function getAirportBriefingQuality(
  content: string,
  research: BlogResearchResult,
): AirportBriefingQuality {
  const issues: string[] = [];
  const wordCount = countWords(stripMarkdown(content));
  const requiredSections = [
    "Date",
    "Executive Summary",
    "Top Developments",
    "Industry Impact",
    "Technology Trends",
    "Business Opportunities",
    "Companies Mentioned",
    "Recommended LinkedIn Post",
  ];
  const sectionCount = requiredSections.filter((section) =>
    new RegExp(`##\\s+${escapeRegExp(section)}`, "i").test(content),
  ).length;

  if (wordCount < MIN_AIRPORT_WORD_COUNT) {
    issues.push(`Briefing has ${wordCount} words; minimum is ${MIN_AIRPORT_WORD_COUNT}.`);
  }

  if (sectionCount < requiredSections.length) {
    issues.push(
      `Briefing includes ${sectionCount} required sections; minimum is ${requiredSections.length}.`,
    );
  }

  if (research.researchSources.length < 3) {
    issues.push(
      `Briefing has ${research.researchSources.length} research sources; minimum is 3.`,
    );
  }

  if (/https?:\/\//i.test(content)) {
    issues.push("Briefing includes a raw URL.");
  }

  if (/\[[^\]]+\]\((?!\/)[^)]+\)/i.test(content)) {
    issues.push("Briefing includes an external Markdown link.");
  }

  if (/further reading/i.test(content)) {
    issues.push("Briefing includes a Further Reading section.");
  }

  return { issues, sectionCount, wordCount };
}

async function generateAndUploadAirportHeroImage({
  recentBriefings,
  slug,
  supabase,
  title,
}: {
  recentBriefings: ExistingAirportBriefing[];
  slug: string;
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  title: string;
}): Promise<AirportHeroImageResult> {
  const prompt = createAirportHeroImagePrompt({ recentBriefings, slug, title });

  try {
    console.info("INConnect airport hero image generation started", { slug, title });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const imagesResponse = await openai.images.generate({
      model: OPENAI_IMAGE_MODEL,
      n: 1,
      output_format: "webp",
      prompt,
      quality: "medium",
      size: OPENAI_AIRPORT_IMAGE_SIZE,
      stream: false,
    });
    const imageBase64 = imagesResponse.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("OpenAI image response did not include base64 image data.");
    }

    await ensureAirportImagesBucket(supabase);
    const objectPath = createAirportImageObjectPath(slug);
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const { error: uploadError } = await supabase.storage
      .from(AIRPORT_IMAGE_BUCKET)
      .upload(objectPath, imageBuffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) {
      console.error("INConnect airport hero image upload failure", {
        error: uploadError,
        objectPath,
        slug,
      });
      throw new Error(uploadError.message || "Airport hero image upload failed.");
    }

    const { data } = supabase.storage.from(AIRPORT_IMAGE_BUCKET).getPublicUrl(objectPath);
    console.info("INConnect airport hero image upload success", {
      slug,
      url: data.publicUrl,
    });

    return {
      prompt,
      url: data.publicUrl || DEFAULT_AIRPORT_HERO_IMAGE_URL,
    };
  } catch (error) {
    console.error("INConnect airport hero image fallback used", {
      error: error instanceof Error ? error.message : String(error),
      slug,
    });
    return {
      prompt,
      url: DEFAULT_AIRPORT_HERO_IMAGE_URL,
    };
  }
}

async function ensureAirportImagesBucket(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { error: getBucketError } = await supabase.storage.getBucket(AIRPORT_IMAGE_BUCKET);
  if (!getBucketError) return;

  const { error: createBucketError } = await supabase.storage.createBucket(
    AIRPORT_IMAGE_BUCKET,
    {
      allowedMimeTypes: ["image/webp"],
      fileSizeLimit: 10 * 1024 * 1024,
      public: true,
    },
  );

  if (createBucketError) {
    throw new Error(
      createBucketError.message || "Airport briefing images bucket could not be created.",
    );
  }
}

function createAirportHeroImagePrompt({
  recentBriefings,
  slug,
  title,
}: {
  recentBriefings: ExistingAirportBriefing[];
  slug: string;
  title: string;
}) {
  const visual = chooseAirportVisual(slug);
  const recentPatternSummary = recentBriefings
    .map((briefing) => briefing.hero_image_prompt)
    .filter((prompt): prompt is string => Boolean(prompt))
    .slice(0, 6)
    .map((prompt) => prompt.slice(0, 120))
    .join(" | ");

  return [
    `Create a ${OPENAI_AIRPORT_IMAGE_SIZE} professional editorial banner image for "${title}".`,
    `Visual concept: ${visual}.`,
    `Uniqueness key: ${slug}. Use it only to vary the scene; do not render it as text.`,
    recentPatternSummary
      ? `Avoid repeating these recent image patterns: ${recentPatternSummary}.`
      : "Avoid generic blue office imagery; make the scene specific to airport operations.",
    "Realistic premium business-magazine photography, modern airport environment, diverse professionals, operational technology, blue INConnect accents balanced with neutral airport materials.",
    "No text, no letters, no logos, no watermarks, no cartoon style, no mascot style, no exaggerated sci-fi effects.",
  ].join(" ");
}

function chooseAirportVisual(slug: string) {
  const visuals = [
    "smart airport control room with operations managers reviewing baggage flow analytics on a large wall display",
    "automated baggage handling hall with RFID tracking gates, conveyors, and airport engineers inspecting system performance",
    "airport passenger processing zone with biometric kiosks, self-service bag drop, and calm professional supervision",
    "airport robotics scene with a service robot near terminal operations staff, realistic lighting and passenger-flow context",
    "airside digital infrastructure scene with LiDAR sensor visualization, runway operations screens, and aviation technology specialists",
    "airport security operations center with analysts reviewing sensor data and passenger-flow alerts on modern dashboards",
  ];
  return visuals[hashString(slug) % visuals.length];
}

function createAirportImageObjectPath(slug: string) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${slug}.webp`;
}

function ensureUniqueSlug(value: string, existingBriefings: ExistingAirportBriefing[]) {
  const existingSlugs = new Set(
    existingBriefings
      .map((briefing) => briefing.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );
  const baseSlug = slugify(value) || `airport-automation-daily-${getUtcDateSuffix()}`;

  if (!existingSlugs.has(baseSlug)) return baseSlug;

  const datedSlug = `${baseSlug}-${getUtcDateSuffix()}`;
  if (!existingSlugs.has(datedSlug)) return datedSlug;

  let suffix = 2;
  while (existingSlugs.has(`${datedSlug}-${suffix}`)) {
    suffix += 1;
  }
  return `${datedSlug}-${suffix}`;
}

function ensureUniqueTitle(value: string, existingBriefings: ExistingAirportBriefing[]) {
  const existingTitles = new Set(
    existingBriefings
      .map((briefing) => briefing.title?.trim().toLowerCase())
      .filter((title): title is string => Boolean(title)),
  );
  if (!existingTitles.has(value.trim().toLowerCase())) return value;
  return `${value} (${getUtcDateSuffix()})`;
}

function createDefaultAirportTitle() {
  return `Airport Automation Daily - ${getUtcDateSuffix()}`;
}

function stripLeadingTitleHeading(content: string, title: string) {
  const trimmedContent = content.trim();
  const lines = trimmedContent.split(/\r?\n/);
  const firstLine = lines[0]?.trim() ?? "";

  if (!firstLine.startsWith("# ")) return trimmedContent;

  const heading = firstLine.replace(/^#\s+/, "").trim().toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();
  if (heading === normalizedTitle || normalizedTitle.includes(heading)) {
    return lines.slice(1).join("\n").trim();
  }

  return trimmedContent;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 86)
    .replace(/-+$/g, "");
}

function cleanText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/[#>*_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getUtcDateSuffix() {
  return new Date().toISOString().slice(0, 10);
}

function toAirportBriefingError(stage: string, error: unknown) {
  if (error instanceof AirportBriefingGenerationError) return error;
  return new AirportBriefingGenerationError(
    stage,
    error instanceof Error ? error.message : String(error),
  );
}
