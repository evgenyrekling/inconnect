import OpenAI from "openai";
import type { BlogResearchResult, BlogResearchSource } from "@/lib/blog-research";
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
  content: string | null;
  created_at: string;
  generated_at: string | null;
  hero_image_prompt: string | null;
  research_summary: string | null;
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
  published_at: string | null;
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
const MIN_AIRPORT_WORD_COUNT = 280;
const MAX_AIRPORT_WORD_COUNT = 600;
const MAX_AIRPORT_RESEARCH_SOURCES = 5;
const MIN_AIRPORT_RESEARCH_SOURCES = 3;
const AIRPORT_RESEARCH_TIMEOUT_MS = 8000;

const AIRPORT_RESEARCH_QUERIES = [
  "airport automation news",
  "airport baggage handling automation",
  "smart airport technology",
  "airport biometrics passenger processing",
  "airport RFID baggage tracking",
  "airport robotics news",
  "airport AI operations",
  "airport security automation",
  "airport digital transformation",
  "baggage handling system project airport",
  "SITA airport technology news",
  "Vanderlande airport automation news",
  "BEUMER airport baggage handling news",
  "Amadeus airport passenger processing news",
  "Collins aerospace airport systems",
  "Daifuku airport baggage handling",
];

const AIRPORT_ALLOWED_KEYWORDS = [
  "airport",
  "airports",
  "aviation",
  "airline",
  "airlines",
  "terminal",
  "airside",
  "baggage",
  "passenger processing",
  "passenger flow",
  "biometric",
  "biometrics",
  "e-gate",
  "egate",
  "rfid",
  "automatic tag reading",
  "atr",
  "security automation",
  "smart airport",
  "airport robotics",
  "airport ai",
  "lidar",
  "vision systems",
  "airport sensors",
  "airport logistics",
  "sita",
  "vanderlande",
  "beumer",
  "daifuku",
  "materna",
  "assaia",
  "adb safegate",
  "amadeus",
  "collins aerospace",
];

const AIRPORT_FORBIDDEN_KEYWORDS = [
  "linkedin optimization",
  "linkedin headline",
  "linkedin headlines",
  "linkedin profile",
  "personal branding",
  "profile visibility",
  "b2b sales visibility",
  "career growth",
  "resume",
  "job search",
  "app store",
  "play store",
  "generic ai",
  "ai for professionals",
];

const AIRPORT_PREFERRED_DOMAINS = [
  "airport-technology.com",
  "futuretravelexperience.com",
  "passengerterminaltoday.com",
  "internationalairportreview.com",
  "aviationweek.com",
  "aci.aero",
  "iata.org",
  "sita.aero",
  "amadeus.com",
  "collinsaerospace.com",
  "vanderlande.com",
  "beumergroup.com",
  "daifuku.com",
  "materna-ips.com",
  "assaia.com",
  "adbsafegate.com",
];

const AIRPORT_TITLE_KEYWORD_PATTERN =
  /\b(?:airport|airports|aviation|airline|terminal|airside|baggage|passenger|biometric|rfid|robot|robotics|gse|security|lidar|sensor|digital twin|smart airport)\b/i;

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

  let research: BlogResearchResult;
  try {
    research = await researchAirportAutomationTopic(existingBriefings);
    console.info("INConnect airport post topic selected", {
      selectedTopic: research.articleAngle,
      sourceUrl: research.researchSources[0]?.url ?? null,
      sourceCount: research.researchSources.length,
    });
  } catch (error) {
    console.error("INConnect airport briefing web research failure", {
      error: error instanceof Error ? error.message : String(error),
      rawError: error,
    });
    throw toAirportBriefingError("web_research", error);
  }

  let generatedBriefing: GeneratedAirportBriefing;
  try {
    generatedBriefing = await generateAirportBriefingWithTitleValidation(research);
    console.info("INConnect OpenAI airport briefing generation success", {
      sourceCount: research.researchSources.length,
      title: generatedBriefing.title,
    });
  } catch (error) {
    console.error("INConnect OpenAI airport briefing generation failure", {
      error: error instanceof Error ? error.message : String(error),
      rawError: error,
    });
    throw toAirportBriefingError("openai_generation", error);
  }

  const title = ensureUniqueTitle(
    cleanText(generatedBriefing.title || createDefaultAirportTitle(), 180),
    existingBriefings,
  );
  const slug = ensureUniqueSlug(generatedBriefing.slug || title, existingBriefings);
  const { content, initialWordCount, quality } = await prepareQualityCheckedAirportContent({
    generatedBriefing,
    research,
    title,
  });
  console.info("INConnect airport post final content ready", {
    finalWordCount: quality.wordCount,
    initialWordCount,
    selectedTopic: title,
    sourceUrl: research.researchSources[0]?.url ?? null,
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
    research_sources: research.researchSources,
    research_summary: research.researchSummary,
    seo_title: cleanText(generatedBriefing.seoTitle || title, 180),
    seo_description: cleanText(
      generatedBriefing.seoDescription || generatedBriefing.excerpt,
      320,
    ),
    published: true,
    published_at: now,
    generated_at: now,
    created_at: now,
  };

  console.info("INConnect airport_briefings insert payload", {
    ...payload,
    content: `${payload.content.slice(0, 220)}...`,
    quality,
  });

  const { data, error } = await insertAirportBriefingWithSchemaFallback(
    supabase,
    payload,
  );

  if (error) {
    console.error("INConnect Supabase airport_briefings insert failure", {
      error,
      exactError: error.message,
      slug,
      title,
    });
    throw new AirportBriefingGenerationError(
      "supabase_insert",
      error.message || "Airport briefing insert failed.",
    );
  }

  if (!data) {
    throw new AirportBriefingGenerationError(
      "supabase_insert",
      "Airport briefing insert did not return a stored briefing.",
    );
  }

  console.info("INConnect Supabase airport_briefings insert success", {
    finalWordCount: quality.wordCount,
    heroImageUrl: data.hero_image_url,
    id: data.id,
    publishedAt: data.published_at,
    published: data.published,
    publishStatus: "published",
    slug: data.slug,
    sourceUrl: research.researchSources[0]?.url ?? null,
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
    .select("slug, title, content, created_at, generated_at, hero_image_prompt")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<
      Omit<ExistingAirportBriefing, "research_summary">[]
    >();

  if (error) {
    console.error("AIRPORT_BRIEFINGS EXISTING LOOKUP ERROR", error);
    return [];
  }

  return (data ?? []).map((briefing) => ({
    ...briefing,
    research_summary: null,
  }));
}

async function insertAirportBriefingWithSchemaFallback(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  payload: Record<string, unknown>,
) {
  const insertResult = await supabase
    .from("airport_briefings")
    .insert(payload)
    .select("id, slug, title, published, generated_at, created_at, hero_image_url, published_at")
    .single<StoredAirportBriefing>();

  if (!isMissingColumnError(insertResult.error)) return insertResult;

  console.warn("INConnect airport_briefings insert retrying without new research columns", {
    error: insertResult.error,
  });

  const fallbackPayload = { ...payload };
  delete fallbackPayload.research_sources;
  delete fallbackPayload.research_summary;
  delete fallbackPayload.published_at;

  const fallbackResult = await supabase
    .from("airport_briefings")
    .insert(fallbackPayload)
    .select("id, slug, title, published, generated_at, created_at, hero_image_url")
    .single<Omit<StoredAirportBriefing, "published_at">>();

  return {
    data: fallbackResult.data
      ? {
          ...fallbackResult.data,
          published_at: null,
        }
      : null,
    error: fallbackResult.error,
  };
}

async function researchAirportAutomationTopic(
  existingBriefings: ExistingAirportBriefing[],
): Promise<BlogResearchResult> {
  console.info("INConnect airport automation web research started", {
    queryCount: AIRPORT_RESEARCH_QUERIES.length,
  });

  const currentYear = new Date().getUTCFullYear();
  const discoveredSources: BlogResearchSource[] = [];

  for (const baseQuery of AIRPORT_RESEARCH_QUERIES) {
    const query = `${baseQuery} ${currentYear}`;
    const sources = await searchAirportResearchSources(query).catch((error) => {
      console.warn("INConnect airport research query failed", {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      return [];
    });

    addUniqueAirportSources(discoveredSources, sources);
    if (discoveredSources.length >= MAX_AIRPORT_RESEARCH_SOURCES * 4) break;
  }

  const selectedSources = selectAirportResearchSources(
    discoveredSources,
    existingBriefings,
  );

  if (selectedSources.length < MIN_AIRPORT_RESEARCH_SOURCES) {
    throw new Error(
      `Airport web research found ${selectedSources.length} usable sources; at least ${MIN_AIRPORT_RESEARCH_SOURCES} are required.`,
    );
  }

  const articleAngle = chooseAirportBriefingAngle(selectedSources, existingBriefings);
  const researchSummary = createAirportResearchSummary(selectedSources, articleAngle);

  console.info("INConnect airport automation web research success", {
    angle: articleAngle,
    sourceCount: selectedSources.length,
    sources: selectedSources.map((source) => ({
      domain: source.domain,
      title: source.title,
      url: source.url,
    })),
  });

  return {
    articleAngle,
    researchSources: selectedSources,
    researchSummary,
  };
}

async function searchAirportResearchSources(query: string): Promise<BlogResearchSource[]> {
  const encodedQuery = encodeURIComponent(query);
  const urls = [
    `https://www.bing.com/news/search?q=${encodedQuery}&format=rss`,
    `https://www.bing.com/search?q=${encodedQuery}&format=rss`,
  ];
  const results: BlogResearchSource[] = [];

  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AIRPORT_RESEARCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "INConnectBot/1.0 airport automation research",
        },
        signal: controller.signal,
      });

      if (!response.ok) continue;

      const rss = await response.text();
      addUniqueAirportSources(results, parseAirportRssItems(rss));
    } finally {
      clearTimeout(timeout);
    }
  }

  return results.filter(isAirportRelevantSource);
}

function parseAirportRssItems(rss: string): BlogResearchSource[] {
  const itemMatches = rss.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return itemMatches.flatMap((item) => {
      const title = decodeXml(extractXmlValue(item, "title"));
      const link = decodeXml(extractXmlValue(item, "link"));
      const description = decodeXml(extractXmlValue(item, "description"));
      const publishedAt = decodeXml(extractXmlValue(item, "pubDate"));
      const url = normalizeAirportSourceUrl(link);
      if (!title || !url) return [];

      return {
        domain: getDomain(url),
        excerpt: cleanText(stripHtml(description), 320),
        publishedAt: publishedAt || undefined,
        title: cleanText(stripHtml(title), 220),
        url,
      } satisfies BlogResearchSource;
    });
}

function selectAirportResearchSources(
  sources: BlogResearchSource[],
  existingBriefings: ExistingAirportBriefing[],
) {
  const recentText = existingBriefings
    .slice(0, 20)
    .map((briefing) => `${briefing.title ?? ""} ${briefing.content ?? ""}`)
    .join(" ")
    .toLowerCase();

  return sources
    .filter(isAirportRelevantSource)
    .sort(
      (a, b) =>
        getAirportSourceScore(b, recentText) -
        getAirportSourceScore(a, recentText),
    )
    .slice(0, MAX_AIRPORT_RESEARCH_SOURCES);
}

function isAirportRelevantSource(source: BlogResearchSource) {
  const haystack = `${source.title} ${source.excerpt} ${source.domain} ${source.url}`
    .toLowerCase()
    .replace(/[-_]+/g, " ");
  const hasAirportSignal = AIRPORT_ALLOWED_KEYWORDS.some((keyword) =>
    haystack.includes(keyword),
  );
  const hasForbiddenSignal = AIRPORT_FORBIDDEN_KEYWORDS.some((keyword) =>
    haystack.includes(keyword),
  );
  const isLinkedInNoise =
    source.domain.includes("linkedin.com") ||
    source.url.includes("/login") ||
    source.url.includes("/signup");

  return hasAirportSignal && !hasForbiddenSignal && !isLinkedInNoise;
}

function getAirportSourceScore(source: BlogResearchSource, recentText: string) {
  const haystack = `${source.title} ${source.excerpt} ${source.domain}`.toLowerCase();
  let score = 0;

  if (AIRPORT_PREFERRED_DOMAINS.some((domain) => source.domain.endsWith(domain))) {
    score += 20;
  }

  for (const keyword of AIRPORT_ALLOWED_KEYWORDS) {
    if (haystack.includes(keyword)) score += 2;
  }

  if (/press release|project|deploy|implementation|automation|biometric|baggage|rfid/i.test(haystack)) {
    score += 4;
  }

  if (source.publishedAt && !Number.isNaN(Date.parse(source.publishedAt))) {
    const ageMs = Date.now() - new Date(source.publishedAt).getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    if (ageDays <= 7) score += 10;
    else if (ageDays <= 30) score += 6;
    else if (ageDays <= 90) score += 2;
  }

  const titleWords = source.title
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 5);
  const repeatedSignals = titleWords.filter((word) => recentText.includes(word)).length;
  score -= repeatedSignals * 3;

  return score;
}

function chooseAirportBriefingAngle(
  sources: BlogResearchSource[],
  existingBriefings: ExistingAirportBriefing[],
) {
  const recentText = existingBriefings
    .slice(0, 30)
    .map((briefing) => `${briefing.title ?? ""} ${briefing.research_summary ?? ""}`)
    .join(" ")
    .toLowerCase();
  const sourceText = sources
    .map((source) => `${source.title} ${source.excerpt}`)
    .join(" ")
    .toLowerCase();
  const candidateAngles = [
    {
      angle:
        "How airports are combining passenger processing, biometric identity, and operational data to improve terminal flow.",
      signals: ["biometric", "passenger", "terminal", "processing", "egate"],
    },
    {
      angle:
        "Why baggage visibility, BHS modernization, RFID, and automatic tag reading are becoming core operational priorities.",
      signals: ["baggage", "rfid", "tag", "atr", "handling"],
    },
    {
      angle:
        "Where airport AI, sensors, LiDAR, computer vision, and control-room analytics are moving from pilots into daily operations.",
      signals: ["ai", "sensor", "lidar", "vision", "analytics", "operations"],
    },
    {
      angle:
        "How smart airport infrastructure and supplier ecosystems are shaping automation opportunities for operators and integrators.",
      signals: ["smart airport", "infrastructure", "supplier", "project", "digital"],
    },
    {
      angle:
        "What airport robotics, security automation, and passenger-service automation signal about the next phase of airport operations.",
      signals: ["robotics", "security", "automation", "service", "operations"],
    },
  ];

  return (
    candidateAngles
      .map((candidate) => ({
        ...candidate,
        score:
          candidate.signals.filter((signal) => sourceText.includes(signal)).length * 4 -
          (recentText.includes(candidate.angle.toLowerCase().slice(0, 60)) ? 8 : 0),
      }))
      .sort((a, b) => b.score - a.score)[0]?.angle ??
    "Airport automation signals across baggage, passenger processing, security, sensors, AI, and smart airport infrastructure."
  );
}

function createAirportResearchSummary(
  sources: BlogResearchSource[],
  articleAngle: string,
) {
  return [
    `Airport-only research angle: ${articleAngle}`,
    "Use sources as context only. Do not invent contracts, pilots, airport deployments, supplier claims, statistics, or commercial relationships not supported by the source snippets.",
    "If sources are broad or weak, write a trend-based briefing and clearly frame it as broader airport industry signals.",
    "Source context:",
    ...sources.map(
      (source, index) =>
        `${index + 1}. ${source.title} (${source.domain}) - ${source.excerpt}`,
    ),
  ].join("\n");
}

function addUniqueAirportSources(
  target: BlogResearchSource[],
  sources: BlogResearchSource[],
) {
  const existingUrls = new Set(target.map((source) => source.url));

  for (const source of sources) {
    if (existingUrls.has(source.url)) continue;
    target.push(source);
    existingUrls.add(source.url);
  }
}

async function generateAirportBriefingWithTitleValidation(
  research: BlogResearchResult,
) {
  let generatedBriefing: GeneratedAirportBriefing | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    generatedBriefing = await generateAirportBriefing(research, attempt);
    if (isValidAirportTitle(generatedBriefing.title)) return generatedBriefing;

    console.warn("INConnect airport briefing title rejected", {
      attempt,
      title: generatedBriefing.title,
    });
  }

  throw new AirportBriefingGenerationError(
    "title_validation",
    `Generated airport briefing title is outside the airport automation boundary: ${generatedBriefing?.title ?? "missing title"}`,
  );
}

async function generateAirportBriefing(research: BlogResearchResult, attempt = 1) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const briefingDate = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date());
  const requiredTitleFormat =
    "[Keyword airport automation topic] - " + briefingDate;
  const slugDate = getUtcDateSuffix();

  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    temperature: 0.65,
    max_output_tokens: 6500,
    input: [
      {
        role: "system",
        content: [
          "You are INConnect Airport Automation Daily, a professional intelligence post for airport automation, aviation technology, and smart airport infrastructure.",
          "Build the output as an INConnect perspective post, not a blog article, newsletter, report, source summary, or LinkedIn status update.",
          "Hard boundary: write only about airports, baggage handling systems, baggage tracking, RFID in airports, automatic tag reading, passenger processing, biometrics, e-gates, smart airports, airport robotics, airport AI, airport security automation, airport operations, airport digital infrastructure, airport sensors, airport LiDAR, airport vision systems, airport logistics, airport expansion projects, and airport technology suppliers.",
          "Forbidden topics: LinkedIn optimization, LinkedIn headlines, personal branding, profile visibility, B2B sales visibility, career growth, generic AI for professionals, and any non-airport professional advice.",
          "Generate original analysis based only on the provided source context.",
          "Do not invent airport projects, contracts, pilots, deployments, acquisitions, passenger statistics, financial figures, or company claims.",
          "If the source context does not support a specific claim, write at the category or trend level instead of naming a project.",
          "Do not copy source wording or structure.",
          "Do not include source attribution, outbound links, external source lists, further reading sections, or external Markdown links.",
          "Write for professionals in airports, airlines, BHS, RFID, passenger processing, biometrics, airport security, AI, LiDAR, robotics, and digital airport operations.",
          "Use clean Markdown only. Do not repeat the title as a leading # heading.",
          "The content must cover one primary topic only.",
          "Examples of good topics: Humanoid Robots at Airports, RFID Expansion, Autonomous GSE, Passenger Flow AI, Digital Twin Airports, Baggage Automation, Airport Cybersecurity, Self-Service Technologies.",
          "Total post body length must be 350-500 words. Minimum acceptable full post length is 280 words; maximum is 600 words.",
          "Prioritize freshness over length.",
          "Do not include Source, Read original story, Discussion Question, Executive Summary, Why It Matters, INConnect View, Suggested LinkedIn Post, Top Developments, Technology Trends, Business Opportunities, numbered lists, newsletter formatting, long-form article sections, or report-style commentary.",
          "Do not use numbered Markdown lists.",
          "Do not use Markdown section headings.",
          "The first sentence must start exactly with: Today, INConnect looks at",
          "Write 3-4 concise paragraphs.",
          "Tone must be professional, insightful, opinionated, and airport industry focused.",
          "The entire post must represent the INConnect interpretation of the source context, not the original article.",
          "Use a keyword-based slug with the UTC date suffix, for example humanoid-robots-airport-baggage-operations-2026-06-11. Do not use only the date or only inconnect-1-minute-daily-digest.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Briefing date: ${briefingDate}`,
          `Required title format: ${requiredTitleFormat}`,
          `Required slug date suffix: ${slugDate}`,
          `Generation attempt: ${attempt}`,
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
          "Set title to a concise keyword-rich airport topic title.",
          `Use this title format: ${requiredTitleFormat}`,
          `Set slug to a concise keyword phrase ending in ${slugDate}.`,
          "The content field must contain only the post body.",
          "Open exactly with: Today, INConnect looks at...",
          "Write 3-4 concise paragraphs, 350-500 words target, never below 280 words and never above 600 words.",
          "Do not include source links, source labels, discussion questions, headings, bullets, or numbered lists.",
          "",
          "If sources are weak, choose the strongest airport automation signal and avoid unsupported company/project claims.",
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
  if (!parsed.title || !parsed.content || parsed.content.trim().length < 300) {
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
  const initialWordCount = quality.wordCount;

  console.info("INConnect airport briefing initial quality check", {
    issues: quality.issues,
    initialWordCount,
    sectionCount: quality.sectionCount,
    title,
    wordCount: quality.wordCount,
  });

  for (let revisionAttempt = 1; quality.issues.length > 0 && revisionAttempt <= 2; revisionAttempt += 1) {
    console.info("INConnect airport digest revision started", {
      issues: quality.issues,
      revisionAttempt,
      title,
      wordCount: quality.wordCount,
    });
    content = await reviseAirportDigest({
      content,
      issues: quality.issues,
      research,
      revisionAttempt,
      title,
    });
    quality = getAirportBriefingQuality(content, research);
    console.info("INConnect airport digest revision quality check", {
      issues: quality.issues,
      revisionAttempt,
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
    console.error("INConnect airport post quality check failed", {
      exactError: quality.issues.join(" "),
      finalWordCount: quality.wordCount,
      initialWordCount,
      title,
    });
    throw new AirportBriefingGenerationError(
      "quality_check",
      `Airport briefing failed quality checks: ${quality.issues.join(" ")}`,
    );
  }

  return { content, initialWordCount, quality };
}

async function reviseAirportDigest({
  content,
  issues,
  research,
  revisionAttempt,
  title,
}: {
  content: string;
  issues: string[];
  research: BlogResearchResult;
  revisionAttempt: number;
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
          "You are revising an INConnect 1-Minute Daily Digest for airport professionals.",
          "Fix the listed quality issues exactly.",
          "Return one primary topic only and keep the full logged-in post body between 350 and 500 words, with an allowed range of 280-600 words.",
          "Do not use Markdown section headings.",
          "Return only the post body. Do not include title, source links, discussion questions, headings, bullets, or numbered lists.",
          "The first sentence must start exactly with: Today, INConnect looks at",
          "The post body must have 3-4 concise paragraphs.",
          "If the current post is below 280 words, expand once with more airport-specific context and INConnect perspective without adding filler.",
          "If the current post is above 600 words, shorten it automatically.",
          "Do not invent airport projects, contracts, deployments, or company claims.",
          "Do not add LinkedIn optimization, personal branding, B2B sales visibility, career growth, or generic AI-for-professionals content.",
          "Use only the provided research context.",
          "Do not add Source, Read original story, Discussion Question, Executive Summary, Why It Matters, INConnect View, Suggested LinkedIn Post, Top Developments, Technology Trends, Business Opportunities, numbered lists, newsletter formatting, long-form article sections, external source lists, outbound links, or generic filler.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Title: ${title}`,
          `Revision attempt: ${revisionAttempt}`,
          "",
          "Quality issues to fix:",
          ...issues.map((issue) => `- ${issue}`),
          "",
          "Research summary:",
          research.researchSummary,
          "",
          "Current digest markdown:",
          content,
          "",
          "Return structured JSON only with the revised digest markdown in the content field.",
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
    throw new Error("Revised airport digest response format error.");
  }

  const parsed = response.output_parsed as { content: string };
  if (!parsed.content || parsed.content.trim().length < 300) {
    throw new Error("Revised airport digest was empty or incomplete.");
  }

  return parsed.content.trim();
}

function getAirportBriefingQuality(
  content: string,
  research: BlogResearchResult,
): AirportBriefingQuality {
  const issues: string[] = [];
  const wordCount = countWords(stripMarkdown(content));
  const paragraphs = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const sectionCount = paragraphs.length;

  if (wordCount < MIN_AIRPORT_WORD_COUNT) {
    issues.push(`Briefing has ${wordCount} words; minimum is ${MIN_AIRPORT_WORD_COUNT}.`);
  }

  if (wordCount > MAX_AIRPORT_WORD_COUNT) {
    issues.push(`Briefing has ${wordCount} words; maximum is ${MAX_AIRPORT_WORD_COUNT}.`);
  }

  if (!/^Today, INConnect looks at\b/i.test(content.trim())) {
    issues.push("Post must open with 'Today, INConnect looks at'.");
  }

  if (sectionCount < 3 || sectionCount > 4) {
    issues.push("Post body must have 3-4 concise paragraphs.");
  }

  if (research.researchSources.length < 3) {
    issues.push(
      `Briefing has ${research.researchSources.length} research sources; minimum is 3.`,
    );
  }

  if (/https?:\/\/|\[[^\]]+\]\([^)]+\)/i.test(content)) {
    issues.push("Post must not include outbound links or Markdown links.");
  }

  if (/^##\s+/m.test(content)) {
    issues.push("Post must not use Markdown section headings.");
  }

  if (/source:|read original story|discussion question|further reading|suggested linkedin post|technology signals|business opportunities|companies to watch|executive summary|top developments|technology trends|inconnect view|why it matters|development a|development b|development c/i.test(content)) {
    issues.push("Post includes article, newsletter, or report-style sections.");
  }

  if (/^\s*\d+\./m.test(content)) {
    issues.push("Digest includes a numbered list.");
  }

  if (containsForbiddenAirportTopic(content)) {
    issues.push("Briefing includes non-airport LinkedIn, branding, career, or B2B sales content.");
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
    "No LinkedIn screens, no social media profile imagery, no generic professional branding scenes, no office-only scenes.",
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
  const dateSuffix = getUtcDateSuffix();
  let baseSlug = slugify(value) || `airport-automation-daily-${dateSuffix}`;

  if (/^inconnect-1-minute-daily-digest(?:-\d{4}-\d{2}-\d{2})?$/.test(baseSlug)) {
    baseSlug = `airport-automation-daily-${dateSuffix}`;
  }

  if (!baseSlug.endsWith(dateSuffix)) {
    baseSlug = `${baseSlug}-${dateSuffix}`;
  }

  if (!existingSlugs.has(baseSlug)) return baseSlug;

  const datedSlug = `${baseSlug}-${new Date()
    .toISOString()
    .slice(11, 16)
    .replace(":", "")}`;
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

function isValidAirportTitle(title: string) {
  return AIRPORT_TITLE_KEYWORD_PATTERN.test(title);
}

function containsForbiddenAirportTopic(value: string) {
  const normalizedValue = value.toLowerCase().replace(/[-_]+/g, " ");
  return AIRPORT_FORBIDDEN_KEYWORDS.some((keyword) => normalizedValue.includes(keyword));
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

function extractSectionContent(content: string, section: string) {
  const match = content.match(
    new RegExp(
      `##\\s+${escapeRegExp(section)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|\\s*$)`,
      "i",
    ),
  );
  return match?.[1]?.trim() ?? "";
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

function extractXmlValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeAirportSourceUrl(value: string) {
  const cleanedValue = value.trim();
  if (!cleanedValue) return "";

  try {
    const parsedUrl = new URL(cleanedValue);
    const redirectedUrl =
      parsedUrl.searchParams.get("url") ||
      parsedUrl.searchParams.get("u") ||
      parsedUrl.searchParams.get("r");

    if (redirectedUrl?.startsWith("http")) return redirectedUrl;

    parsedUrl.hash = "";
    return parsedUrl.toString();
  } catch {
    return "";
  }
}

function getDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
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

function isMissingColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "42703"
  );
}

function toAirportBriefingError(stage: string, error: unknown) {
  if (error instanceof AirportBriefingGenerationError) return error;
  return new AirportBriefingGenerationError(
    stage,
    error instanceof Error ? error.message : String(error),
  );
}
