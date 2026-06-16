import OpenAI from "openai";
import type { BlogResearchResult, BlogResearchSource } from "@/lib/blog-research";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type GeneratedAirportBriefing = {
  airportName: string;
  category: string;
  content: string;
  excerpt: string;
  keywords: string[];
  seoDescription: string;
  seoTitle: string;
  slug: string;
  title: string;
};

type ExistingAirportBriefing = {
  airport_name: string | null;
  category: string | null;
  content: string | null;
  created_at: string;
  generated_at: string | null;
  hero_image_prompt: string | null;
  keywords: string[] | null;
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
  paragraphCount: number;
  wordCount: number;
};

type AirportTopicHistoryRow = {
  airport_name?: string | null;
  category: string | null;
  keywords?: string[] | null;
  published_at: string | null;
  title: string | null;
  topic: string | null;
};

type AirportTopicSelection = {
  angle: string;
  category: string;
  noveltyScore: number;
  rejectedCategories: string[];
  topic: string;
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
const MIN_AIRPORT_WORD_COUNT = 120;
const MAX_AIRPORT_WORD_COUNT = 350;
const MAX_AIRPORT_RESEARCH_SOURCES = 5;
const MIN_AIRPORT_RESEARCH_SOURCES = 3;
const AIRPORT_RESEARCH_TIMEOUT_MS = 8000;

const AIRPORT_RESEARCH_QUERIES = [
  "latest airport automation project airport deployment",
  "airport technology deployment airport operator supplier",
  "airport modernization project automation airport operator",
  "airport baggage handling automation project airport supplier",
  "airport biometrics passenger processing deployment airport",
  "airport RFID baggage tracking project airport airline",
  "airport robotics pilot airport operations",
  "airport AI operations deployment airport",
  "airport security automation project airport",
  "smart airport project technology supplier airport",
  "baggage handling system project airport supplier",
  "airport self service kiosk biometric e-gate deployment",
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

const AIRPORT_PROJECT_SIGNALS = [
  "announced",
  "award",
  "awarded",
  "began",
  "commissioned",
  "contract",
  "deploy",
  "deployed",
  "deployment",
  "expanded",
  "implementation",
  "introduced",
  "installed",
  "launch",
  "launched",
  "modernization",
  "pilot",
  "project",
  "rollout",
  "selected",
  "testing",
  "trial",
  "upgrade",
  "upgraded",
];

const AIRPORT_PLAYER_SIGNALS = [
  "airport",
  "airports",
  "airline",
  "airlines",
  "authority",
  "operator",
  "group",
  "sita",
  "vanderlande",
  "beumer",
  "daifuku",
  "materna",
  "assaia",
  "adb safegate",
  "amadeus",
  "collins aerospace",
  "tsa",
  "smiths detection",
  "idemia",
  "thales",
  "nec",
];

const AIRPORT_OFFICIAL_SITE_HINTS = [
  "SITA: https://www.sita.aero",
  "Vanderlande: https://www.vanderlande.com",
  "BEUMER Group: https://www.beumergroup.com",
  "Daifuku: https://www.daifuku.com",
  "Materna IPS: https://www.materna-ips.com",
  "Amadeus: https://amadeus.com",
  "Collins Aerospace: https://www.collinsaerospace.com",
  "Assaia: https://www.assaia.com",
  "ADB SAFEGATE: https://adbsafegate.com",
  "TSA: https://www.tsa.gov",
  "IDEMIA: https://www.idemia.com",
  "Thales: https://www.thalesgroup.com",
  "NEC: https://www.nec.com",
  "Smiths Detection: https://www.smithsdetection.com",
];

const AIRPORT_TOPIC_CANDIDATES = [
  {
    angle:
      "How airports are improving passenger processing through biometrics, self-service, identity orchestration, and terminal-flow intelligence.",
    category: "Passenger Processing",
    signals: ["biometric", "passenger", "terminal", "processing", "egate", "self service"],
    topic: "Passenger processing and identity automation",
  },
  {
    angle:
      "How biometrics are moving from isolated checkpoint verification into wider passenger identity orchestration across the terminal.",
    category: "Biometrics",
    signals: ["biometric", "facial recognition", "identity", "egate", "boarding"],
    topic: "Biometric identity orchestration",
  },
  {
    angle:
      "Where self-service systems are changing bag drop, check-in, boarding, and passenger exception handling in airport terminals.",
    category: "Self Service",
    signals: ["self service", "kiosk", "bag drop", "boarding", "check in"],
    topic: "Self-service passenger processing",
  },
  {
    angle:
      "Why baggage handling modernization is becoming a core airport automation priority as airports pursue more reliable flow and fewer disruptions.",
    category: "Baggage Handling",
    signals: ["baggage", "bag drop", "handling", "sortation", "conveyor", "bhs"],
    topic: "Baggage handling modernization",
  },
  {
    angle:
      "Where RFID and automatic tag reading are creating stronger baggage visibility, exception handling, and operational accountability across airports.",
    category: "RFID",
    signals: ["rfid", "tag", "atr", "tracking", "baggage visibility"],
    topic: "RFID baggage visibility",
  },
  {
    angle:
      "How asset tracking is improving control over airport equipment, baggage assets, ULDs, tools, and service-critical operational resources.",
    category: "Asset Tracking",
    signals: ["asset tracking", "tracking", "rfid", "uld", "equipment", "visibility"],
    topic: "Airport asset tracking",
  },
  {
    angle:
      "How autonomous vehicles are beginning to reshape airside logistics, apron movement, baggage transport, and airport service operations.",
    category: "Autonomous Vehicles",
    signals: ["autonomous", "vehicle", "driverless", "shuttle", "apron", "airside"],
    topic: "Autonomous vehicles in airport operations",
  },
  {
    angle:
      "How autonomous baggage transport is beginning to change the movement of bags, containers, and support equipment between terminal and apron processes.",
    category: "Autonomous Vehicles",
    signals: ["autonomous baggage", "autonomous tug", "baggage transport", "driverless", "container"],
    topic: "Autonomous baggage transport",
  },
  {
    angle:
      "How airside automation is changing apron coordination, aircraft turnaround, service sequencing, and operational visibility around aircraft stands.",
    category: "Airside Automation",
    signals: ["airside", "apron", "aircraft turnaround", "stand", "ramp", "turnaround"],
    topic: "Airside operations automation",
  },
  {
    angle:
      "How apron safety systems are using sensors, computer vision, and operational alerts to reduce collision risk around aircraft stands.",
    category: "Apron Safety",
    signals: ["apron safety", "stand", "collision", "aircraft turnaround", "computer vision"],
    topic: "Computer vision for apron safety",
  },
  {
    angle:
      "How turnaround optimization is improving aircraft stand coordination, service sequencing, and visibility across ground handling tasks.",
    category: "Turnaround Optimization",
    signals: ["turnaround", "stand", "ground handling", "sequencing", "ramp"],
    topic: "Aircraft turnaround optimization",
  },
  {
    angle:
      "Why ground handling automation is becoming more important as airports and handlers look for safer, more reliable, and more coordinated turnaround processes.",
    category: "Turnaround Optimization",
    signals: ["ground handling", "ramp handling", "turnaround", "airside", "handler"],
    topic: "Ground handling automation",
  },
  {
    angle:
      "What airport robotics signals about labor pressure, repetitive operational tasks, passenger service, baggage support, and terminal resilience.",
    category: "Robotics",
    signals: ["robot", "robotics", "humanoid", "service robot", "automation"],
    topic: "Robotics in airport environments",
  },
  {
    angle:
      "Where LiDAR is being used to understand passenger flow, object movement, queue conditions, and airport operational safety.",
    category: "LiDAR",
    signals: ["lidar", "sensor", "flow", "queue", "detection"],
    topic: "LiDAR for airport flow intelligence",
  },
  {
    angle:
      "How computer vision is being applied to passenger flow, baggage exceptions, apron safety, security monitoring, and operational awareness.",
    category: "Computer Vision",
    signals: ["computer vision", "vision", "camera", "detection", "analytics"],
    topic: "Computer vision for airport operations",
  },
  {
    angle:
      "How AI, sensors, analytics, computer vision, and LiDAR are moving airport teams toward predictive operations and better situational awareness.",
    category: "AI Operations",
    signals: ["ai", "analytics", "sensor", "lidar", "vision", "predictive", "data"],
    topic: "AI and analytics for airport operations",
  },
  {
    angle:
      "How terminal analytics are helping airport teams understand passenger movement, queue pressure, dwell time, and operational bottlenecks.",
    category: "Terminal Analytics",
    signals: ["terminal analytics", "queue", "passenger flow", "dwell", "bottleneck"],
    topic: "Terminal analytics for passenger flow",
  },
  {
    angle:
      "Where airport security automation is changing screening, surveillance, identity checks, queue management, and operational risk detection.",
    category: "Security Screening",
    signals: ["security", "screening", "surveillance", "checkpoint", "identity", "risk"],
    topic: "Airport security automation",
  },
  {
    angle:
      "How cargo automation is becoming more important as airports connect air freight, warehouse processes, tracking, and ground logistics.",
    category: "Cargo Automation",
    signals: ["cargo", "freight", "warehouse", "logistics", "ULD", "air freight"],
    topic: "Cargo automation and air freight operations",
  },
  {
    angle:
      "Why ground support equipment is becoming a practical automation frontier for turnaround reliability, safety, electrification, and airside efficiency.",
    category: "Airside Automation",
    signals: ["gse", "ground support", "turnaround", "tug", "airside", "ramp"],
    topic: "Ground support equipment automation",
  },
  {
    angle:
      "How digital twins are helping airports model capacity, test operational changes, coordinate stakeholders, and improve infrastructure planning.",
    category: "Digital Twin",
    signals: ["digital twin", "simulation", "model", "capacity", "planning"],
    topic: "Digital twins for airport operations",
  },
  {
    angle:
      "Where sustainability and automation overlap in airports through electrification, energy efficiency, smarter resource use, and lower-emission operations.",
    category: "Sustainability",
    signals: ["sustainability", "electric", "emissions", "energy", "carbon", "efficiency"],
    topic: "Sustainable airport automation",
  },
  {
    angle:
      "How airport infrastructure modernization is creating the foundation for more connected, data-rich, and automated airport operations.",
    category: "Airport Operations",
    signals: ["infrastructure", "terminal", "project", "expansion", "modernization", "smart airport"],
    topic: "Airport infrastructure modernization",
  },
];

const AIRPORT_CATEGORY_ROTATION: Record<number, string> = {
  0: "Sustainability",
  1: "Passenger Processing",
  2: "Baggage Handling",
  3: "Computer Vision",
  4: "LiDAR",
  5: "Airside Automation",
  6: "Cargo Automation",
};

const AIRPORT_CATEGORY_ALIASES: Record<string, string> = {
  "AI & Analytics": "AI Operations",
  "Airport Security": "Security Screening",
  "Digital Twins": "Digital Twin",
  "Ground Handling": "Turnaround Optimization",
  "Ground Support Equipment": "Airside Automation",
  Infrastructure: "Airport Operations",
  "Airside Operations": "Airside Automation",
  Cargo: "Cargo Automation",
  "Vision & AI": "Computer Vision",
};

const AIRPORT_TITLE_KEYWORDS = [
  "airport",
  "terminal",
  "baggage",
  "passenger processing",
  "biometric",
  "rfid",
  "bhs",
  "atr",
  "airside",
  "apron",
  "ground support",
  "gse",
  "ground handling",
  "aircraft turnaround",
  "cargo",
  "security screening",
  "e-gate",
  "egate",
  "self-service",
  "self service",
  "kiosk",
  "boarding",
  "gate automation",
  "airport robotics",
  "autonomous vehicle",
  "autonomous gse",
  "airport ai",
  "airport sensor",
  "airport operations",
  "smart airport",
  "digital airport",
  "airport infrastructure",
];

const AIRPORT_TITLE_CATEGORY_PATTERNS = [
  { category: "Passenger Processing", pattern: /\b(passenger processing|biometric|e-?gate|self[-\s]?service|kiosk|boarding|gate automation)\b/i },
  { category: "Baggage Handling", pattern: /\b(baggage|bhs|bag drop|sortation|conveyor)\b/i },
  { category: "RFID", pattern: /\b(rfid|atr|automatic tag reading)\b/i },
  { category: "Airside Automation", pattern: /\b(ground support equipment|ground support|gse|autonomous gse|airside|apron|aircraft turnaround)\b/i },
  { category: "Turnaround Optimization", pattern: /\b(ground handling|ramp handling|turnaround)\b/i },
  { category: "Autonomous Vehicles", pattern: /\b(autonomous vehicle|autonomous vehicles|driverless|autonomous shuttle)\b/i },
  { category: "Robotics", pattern: /\b(robotics|robot|humanoid)\b/i },
  { category: "AI & Analytics", pattern: /\b(airport ai|ai|analytics|sensor|sensors|lidar|computer vision)\b/i },
  { category: "Airport Security", pattern: /\b(security screening|security automation|checkpoint|screening)\b/i },
  { category: "Cargo Automation", pattern: /\b(cargo|freight|air freight|warehouse automation)\b/i },
  { category: "Digital Twins", pattern: /\b(digital twin|simulation|airport model)\b/i },
  { category: "Sustainability", pattern: /\b(sustainability|electric|emissions|energy efficiency|carbon)\b/i },
  { category: "Airport Operations", pattern: /\b(infrastructure|smart airport|digital airport|terminal modernization|airport infrastructure)\b/i },
];

const airportBriefingSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "slug",
    "category",
    "airportName",
    "keywords",
    "excerpt",
    "seoTitle",
    "seoDescription",
    "content",
  ],
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    category: { type: "string" },
    airportName: { type: "string" },
    keywords: {
      type: "array",
      items: { type: "string" },
    },
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
  const topicHistory = await getAirportTopicHistory(supabase);

  let research: BlogResearchResult;
  try {
    research = await researchAirportAutomationTopic(existingBriefings, topicHistory);
    const topicSelection = getAirportTopicSelection(research);
    console.info("INConnect airport post topic selected", {
      noveltyScore: topicSelection.noveltyScore,
      rejectedCategories: topicSelection.rejectedCategories,
      selectedCategory: topicSelection.category,
      selectedTopic: topicSelection.topic,
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
    normalizeAirportBriefingTitle(
      cleanText(generatedBriefing.title || createDefaultAirportTitle(), 180),
    ),
    existingBriefings,
  );
  const slug = ensureUniqueSlug(generatedBriefing.slug || title, existingBriefings);
  const { content, initialWordCount, quality } = await prepareQualityCheckedAirportContent({
    generatedBriefing,
    research,
    title,
  });
    console.info("INConnect airport post final content ready", {
    category: generatedBriefing.category,
    finalWordCount: quality.wordCount,
    initialWordCount,
    keywords: generatedBriefing.keywords,
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
    airport_name: cleanText(generatedBriefing.airportName || "", 160) || null,
    category: normalizeAirportCategory(generatedBriefing.category),
    excerpt: cleanText(generatedBriefing.excerpt, 360),
    content,
    hero_image_url: heroImage.url,
    hero_image_prompt: heroImage.prompt,
    keywords: normalizeAirportKeywords(generatedBriefing.keywords),
    research_sources: research.researchSources,
    research_summary: research.researchSummary,
    reading_time: "1 Minute Read",
    seo_title: cleanText(`${title} | Airport Automation Daily`, 180),
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

  await saveAirportTopicHistory(supabase, {
    airportName: generatedBriefing.airportName,
    category: generatedBriefing.category,
    keywords: generatedBriefing.keywords,
    publishedAt: data.published_at ?? data.generated_at ?? data.created_at,
    research,
    title,
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
    .select("slug, title, category, keywords, airport_name, content, created_at, generated_at, hero_image_prompt")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<Omit<ExistingAirportBriefing, "research_summary">[]>();

  if (error) {
    if (isMissingColumnError(error)) {
      return getExistingAirportBriefingsLegacy(supabase);
    }
    console.error("AIRPORT_BRIEFINGS EXISTING LOOKUP ERROR", error);
    return [];
  }

  return (data ?? []).map((briefing) => ({
    ...briefing,
    research_summary: null,
  }));
}

async function getExistingAirportBriefingsLegacy(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { data, error } = await supabase
    .from("airport_briefings")
    .select("slug, title, content, created_at, generated_at, hero_image_prompt")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<
      Omit<
        ExistingAirportBriefing,
        "airport_name" | "category" | "keywords" | "research_summary"
      >[]
    >();

  if (error) {
    console.error("AIRPORT_BRIEFINGS LEGACY EXISTING LOOKUP ERROR", error);
    return [];
  }

  return (data ?? []).map((briefing) => ({
    ...briefing,
    airport_name: null,
    category: null,
    keywords: null,
    research_summary: null,
  }));
}

async function getAirportTopicHistory(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { data, error } = await supabase
    .from("airport_topic_history")
    .select("title, topic, category, keywords, airport_name, published_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(30)
    .returns<AirportTopicHistoryRow[]>();

  if (error) {
    if (isMissingColumnError(error)) {
      return getAirportTopicHistoryLegacy(supabase);
    }
    console.warn("INConnect airport_topic_history lookup skipped", {
      error,
    });
    return [];
  }

  return data ?? [];
}

async function getAirportTopicHistoryLegacy(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { data, error } = await supabase
    .from("airport_topic_history")
    .select("title, topic, category, published_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(30)
    .returns<AirportTopicHistoryRow[]>();

  if (error) {
    console.warn("INConnect airport_topic_history legacy lookup skipped", { error });
    return [];
  }

  return data ?? [];
}

async function saveAirportTopicHistory(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  {
    airportName,
    category,
    keywords,
    publishedAt,
    research,
    title,
  }: {
    airportName?: string;
    category?: string;
    keywords?: string[];
    publishedAt: string | null;
    research: BlogResearchResult;
    title: string;
  },
) {
  const topicSelection = getAirportTopicSelection(research);
  const { error } = await supabase.from("airport_topic_history").insert({
    airport_name: cleanText(airportName || "", 160) || null,
    category: normalizeAirportCategory(category || topicSelection.category),
    keywords: normalizeAirportKeywords(keywords),
    published_at: publishedAt || new Date().toISOString(),
    title,
    topic: topicSelection.topic,
  });

  if (error) {
    if (isMissingColumnError(error)) {
      await saveAirportTopicHistoryLegacy(supabase, {
        category: normalizeAirportCategory(category || topicSelection.category),
        publishedAt,
        title,
        topic: topicSelection.topic,
      });
      return;
    }
    console.warn("INConnect airport_topic_history insert skipped", {
      error,
      selectedCategory: topicSelection.category,
      selectedTopic: topicSelection.topic,
    });
    return;
  }

  console.info("INConnect airport_topic_history insert success", {
    publishedAt,
    selectedCategory: topicSelection.category,
    selectedTopic: topicSelection.topic,
  });
}

async function saveAirportTopicHistoryLegacy(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  {
    category,
    publishedAt,
    title,
    topic,
  }: {
    category: string;
    publishedAt: string | null;
    title: string;
    topic: string;
  },
) {
  const { error } = await supabase.from("airport_topic_history").insert({
    category,
    published_at: publishedAt || new Date().toISOString(),
    title,
    topic,
  });

  if (error) {
    console.warn("INConnect airport_topic_history legacy insert skipped", {
      error,
      selectedCategory: category,
      selectedTopic: topic,
    });
  }
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
  delete fallbackPayload.airport_name;
  delete fallbackPayload.category;
  delete fallbackPayload.keywords;
  delete fallbackPayload.reading_time;

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
  topicHistory: AirportTopicHistoryRow[],
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
  const primaryProjectSource = selectedSources.find(hasSpecificAirportProjectSignal);

  if (selectedSources.length < MIN_AIRPORT_RESEARCH_SOURCES) {
    throw new Error(
      `Airport web research found ${selectedSources.length} usable sources; at least ${MIN_AIRPORT_RESEARCH_SOURCES} are required.`,
    );
  }

  if (!primaryProjectSource) {
    throw new Error(
      "Airport web research did not find a specific recent project, deployment, pilot, airport/operator announcement, or supplier-backed automation source.",
    );
  }

  const topicSelection = chooseAirportBriefingTopic(
    selectedSources,
    existingBriefings,
    topicHistory,
  );
  const articleAngle = topicSelection.angle;
  const researchSummary = createAirportResearchSummary(selectedSources, articleAngle);

  console.info("INConnect airport automation web research success", {
    angle: articleAngle,
    noveltyScore: topicSelection.noveltyScore,
    rejectedCategories: topicSelection.rejectedCategories,
    selectedCategory: topicSelection.category,
    selectedTopic: topicSelection.topic,
    primaryProjectSource: {
      domain: primaryProjectSource.domain,
      title: primaryProjectSource.title,
      url: primaryProjectSource.url,
    },
    sourceCount: selectedSources.length,
    sources: selectedSources.map((source) => ({
      domain: source.domain,
      title: source.title,
      url: source.url,
    })),
  });

  return {
    articleAngle,
    topicSelection,
    researchSources: selectedSources,
    researchSummary,
  } as BlogResearchResult;
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

function hasSpecificAirportProjectSignal(source: BlogResearchSource) {
  const haystack = createAirportSourceHaystack(source);
  const hasProjectSignal = AIRPORT_PROJECT_SIGNALS.some((signal) =>
    haystack.includes(signal),
  );
  const hasPlayerSignal = AIRPORT_PLAYER_SIGNALS
    .filter((signal) => !["airport", "airports"].includes(signal))
    .some((signal) => haystack.includes(signal));
  const hasSpecificAirportName =
    /\b[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,4}\s+(?:International\s+)?Airport\b/.test(
      `${source.title} ${source.excerpt}`,
    );
  const hasSupplierSignal = AIRPORT_PREFERRED_DOMAINS.some((domain) =>
    source.domain.endsWith(domain),
  );

  return hasProjectSignal && (hasSpecificAirportName || hasSupplierSignal || hasPlayerSignal);
}

function isAirportRelevantSource(source: BlogResearchSource) {
  const haystack = createAirportSourceHaystack(source);
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

function createAirportSourceHaystack(source: BlogResearchSource) {
  return `${source.title} ${source.excerpt} ${source.domain} ${source.url}`
    .toLowerCase()
    .replace(/[-_]+/g, " ");
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

  if (hasSpecificAirportProjectSignal(source)) {
    score += 28;
  }

  for (const signal of AIRPORT_PROJECT_SIGNALS) {
    if (haystack.includes(signal)) score += 3;
  }

  for (const signal of AIRPORT_PLAYER_SIGNALS) {
    if (haystack.includes(signal)) score += 2;
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

function chooseAirportBriefingTopic(
  sources: BlogResearchSource[],
  existingBriefings: ExistingAirportBriefing[],
  topicHistory: AirportTopicHistoryRow[],
): AirportTopicSelection {
  const preferredCategory = getPreferredAirportCategory();
  const recentText = existingBriefings
    .slice(0, 30)
    .map((briefing) =>
      `${briefing.title ?? ""} ${briefing.research_summary ?? ""} ${
        briefing.keywords?.join(" ") ?? ""
      }`,
    )
    .join(" ")
    .toLowerCase();
  const sourceText = sources
    .map((source) => `${source.title} ${source.excerpt}`)
    .join(" ")
    .toLowerCase();
  const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
  const recentCategories = new Set(
    topicHistory
      .filter((entry) => {
        if (!entry.published_at) return false;
        const publishedAt = new Date(entry.published_at).getTime();
        return Number.isFinite(publishedAt) && publishedAt >= tenDaysAgo;
      })
      .map((entry) => normalizeAirportCategory(entry.category ?? ""))
      .filter((category): category is string => Boolean(category)),
  );
  const rejectedCategories = AIRPORT_TOPIC_CANDIDATES
    .filter((candidate) => recentCategories.has(normalizeAirportCategory(candidate.category)))
    .map((candidate) => normalizeAirportCategory(candidate.category));
  const recentKeywords = getRepeatedAirportKeywords([
    ...existingBriefings.slice(0, 30).map((briefing) => briefing.title ?? ""),
    ...existingBriefings
      .slice(0, 30)
      .flatMap((briefing) => briefing.keywords ?? []),
    ...topicHistory.slice(0, 30).map((entry) => `${entry.title ?? ""} ${entry.topic ?? ""}`),
    ...topicHistory.slice(0, 30).flatMap((entry) => entry.keywords ?? []),
  ]);
  const recentAirports = new Set(
    [...existingBriefings, ...topicHistory]
      .filter((entry) => {
        const publishedAt =
          "published_at" in entry ? entry.published_at : entry.generated_at ?? entry.created_at;
        if (!publishedAt) return false;
        const timestamp = new Date(publishedAt).getTime();
        return Number.isFinite(timestamp) && timestamp >= Date.now() - 14 * 24 * 60 * 60 * 1000;
      })
      .map((entry) => normalizeAirportKeyword(entry.airport_name ?? ""))
      .filter(Boolean),
  );
  const candidates = AIRPORT_TOPIC_CANDIDATES
    .filter((candidate) => !recentCategories.has(normalizeAirportCategory(candidate.category)))
    .map((candidate) => {
      const normalizedCategory = normalizeAirportCategory(candidate.category);
      const relevanceScore =
        candidate.signals.filter((signal) => sourceText.includes(signal.toLowerCase())).length *
        12;
      const categoryRotationScore =
        preferredCategory === "Editor's Pick"
          ? 0
          : normalizedCategory === preferredCategory
            ? 45
            : 0;
      const titleSimilarityPenalty = existingBriefings
        .slice(0, 30)
        .some((briefing) => areAirportTitlesSimilar(candidate.topic, briefing.title ?? ""))
        ? 30
        : 0;
      const repeatedKeywordPenalty =
        candidate.signals.filter((signal) => recentKeywords.has(normalizeAirportKeyword(signal)))
          .length * 8;
      const recentHistoryPenalty = topicHistory
        .slice(0, 30)
        .some((entry) => areAirportTitlesSimilar(candidate.topic, entry.topic ?? entry.title ?? ""))
        ? 20
        : 0;
      const repeatedAirportPenalty = [...recentAirports].some((airport) =>
        normalizeAirportKeyword(candidate.topic).includes(airport),
      )
        ? 20
        : 0;
      const noveltyScore =
        100 +
        relevanceScore +
        categoryRotationScore -
        titleSimilarityPenalty -
        repeatedKeywordPenalty -
        recentHistoryPenalty -
        repeatedAirportPenalty;

      return {
        ...candidate,
        category: normalizedCategory,
        noveltyScore,
      };
    })
    .sort((a, b) => b.noveltyScore - a.noveltyScore);
  const selected =
    candidates[0] ??
    AIRPORT_TOPIC_CANDIDATES.map((candidate) => ({
      ...candidate,
      noveltyScore: candidate.signals.filter((signal) =>
        sourceText.includes(signal.toLowerCase()),
      ).length,
    })).sort((a, b) => b.noveltyScore - a.noveltyScore)[0];

  return {
    angle:
      selected?.angle ??
      "Airport automation signals across baggage, passenger processing, security, sensors, AI, and smart airport infrastructure.",
    category: normalizeAirportCategory(selected?.category ?? "Airport Operations"),
    noveltyScore: selected?.noveltyScore ?? 0,
    rejectedCategories,
    topic: selected?.topic ?? "Airport automation market signal",
  };
}

function createAirportResearchSummary(
  sources: BlogResearchSource[],
  articleAngle: string,
) {
  const primaryProjectSource = sources.find(hasSpecificAirportProjectSignal) ?? sources[0];

  return [
    `Airport-only research angle: ${articleAngle}`,
    "Anchor the briefing on the primary project source below. The post must describe what is new, where it is happening, and which companies, airport operators, agencies, airlines, handlers, or technology suppliers are involved when supported by the source snippets.",
    `Primary project source: ${primaryProjectSource.title} (${primaryProjectSource.domain}) - ${primaryProjectSource.excerpt}`,
    "Use sources as context only. Do not invent contracts, pilots, airport deployments, supplier claims, statistics, or commercial relationships not supported by the source snippets.",
    "If exact companies or airports are not supported, describe the player types rather than inventing names.",
    "Source context:",
    ...sources.map(
      (source, index) =>
        `${index + 1}. ${source.title} (${source.domain}) - ${source.excerpt}`,
    ),
  ].join("\n");
}

function getAirportTopicSelection(research: BlogResearchResult) {
  const maybeSelection = (research as BlogResearchResult & {
    topicSelection?: AirportTopicSelection;
  }).topicSelection;

  return (
    maybeSelection ?? {
      angle: research.articleAngle,
      category: "Infrastructure",
      noveltyScore: 0,
      rejectedCategories: [],
      topic: research.articleAngle,
    }
  );
}

function getRepeatedAirportKeywords(values: string[]) {
  const keywords = new Set<string>();
  for (const value of values) {
    for (const word of value.toLowerCase().split(/\W+/)) {
      const keyword = normalizeAirportKeyword(word);
      if (keyword.length >= 5) keywords.add(keyword);
    }
  }
  return keywords;
}

function normalizeAirportKeyword(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function areAirportTitlesSimilar(left: string, right: string) {
  const leftKeywords = new Set(
    normalizeAirportKeyword(left)
      .split(/\s+/)
      .filter((word) => word.length >= 5),
  );
  const rightKeywords = normalizeAirportKeyword(right)
    .split(/\s+/)
    .filter((word) => word.length >= 5);

  if (leftKeywords.size === 0 || rightKeywords.length === 0) return false;

  const overlap = rightKeywords.filter((word) => leftKeywords.has(word)).length;
  return overlap >= 2 || overlap / Math.max(leftKeywords.size, rightKeywords.length) >= 0.45;
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
    const titleValidation = validateAirportTitle(generatedBriefing.title);
    if (titleValidation.isValid) return generatedBriefing;

    console.warn("INConnect airport briefing title rejected", {
      attempt,
      detectedCategory: titleValidation.detectedCategory,
      missingKeywordReason: titleValidation.missingKeywordReason,
      rejectedTitle: generatedBriefing.title,
      title: generatedBriefing.title,
    });
  }

  const titleValidation = validateAirportTitle(generatedBriefing?.title ?? "");
  throw new AirportBriefingGenerationError(
    "title_validation",
    [
      "Generated airport briefing title is outside the airport automation boundary.",
      `Rejected title: ${generatedBriefing?.title ?? "missing title"}.`,
      `Detected category: ${titleValidation.detectedCategory}.`,
      `Reason: ${titleValidation.missingKeywordReason}.`,
    ].join(" "),
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
  const topicSelection = getAirportTopicSelection(research);
  const preferredCategory = getPreferredAirportCategory();
  const requiredTitleFormat =
    "[Specific Topic] | INConnect 1-Minute Briefing";
  const slugDate = getUtcDateSuffix();

  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    temperature: 0.65,
    max_output_tokens: 2600,
    input: [
      {
        role: "system",
        content: [
          "You are INConnect Airport Automation Daily, a professional intelligence post for airport automation, aviation technology, and smart airport infrastructure.",
          "Build the output as a concise INConnect 1-Minute Briefing, not a blog article, newsletter, report, source summary, or LinkedIn status update.",
          "Hard boundary: write only about airports, baggage handling systems, baggage tracking, RFID in airports, automatic tag reading, passenger processing, biometrics, e-gates, smart airports, airport robotics, airport AI, airport security automation, airport operations, airport digital infrastructure, airport sensors, airport LiDAR, airport vision systems, airport logistics, airport expansion projects, and airport technology suppliers.",
          "Forbidden topics: LinkedIn optimization, LinkedIn headlines, personal branding, profile visibility, B2B sales visibility, career growth, generic AI for professionals, and any non-airport professional advice.",
          "Generate original analysis based only on the provided source context.",
          "Do not invent airport projects, contracts, pilots, deployments, acquisitions, passenger statistics, financial figures, or company claims.",
          "If the source context does not support a specific claim, write at the category or trend level instead of naming a project.",
          "Do not copy source wording or structure.",
          "Do not include source attribution, source lists, further reading sections, audience questions, raw URLs, or links to news articles.",
          "When mentioning a named airport, operator, agency, airline, or company, make the name bold. If an official website URL is clearly available from the source context or known official supplier domain, use an inline Markdown link on the bold name, for example [**SITA**](https://www.sita.aero).",
          "Only link to official company, airport, operator, agency, or airline websites. Do not link to news articles, search pages, social media pages, or tracking URLs.",
          "Write for professionals in airports, airlines, BHS, RFID, passenger processing, biometrics, airport security, AI, LiDAR, robotics, and digital airport operations.",
          "The content must cover one primary topic only.",
          "Prioritize a single new airport deployment, airport project, airport technology launch, airport modernization initiative, airport automation case study, or airport operator announcement.",
          "The briefing must read like a real airport automation news update: what is new, where it happened, which airport/operator/agency/airline/supplier is involved, and what technology is being used.",
          "Do not publish broad trend commentary when the source context supports a named project, airport, supplier, or deployment.",
          "Examples of good topics: RFID Expansion at Major Airports, Humanoid Robots Enter Airport Operations, Autonomous GSE Trials, Passenger Flow AI, Digital Twin Airports, Baggage Automation, Airport Cybersecurity, Self-Service Technologies.",
          "Write one flowing professional intelligence post only, 150-250 words target and 180-220 words ideal. The hard allowed range is 120-350 words.",
          "Use exactly three concise paragraphs: paragraph 1 explains what happened and names the particular project, airport, operator, supplier, pilot, launch, or modernization initiative when supported by the source context; paragraph 2 explains why it is important for airports and mentions the main players shaping this direction; paragraph 3 integrates the INConnect View naturally.",
          "Every briefing must include a specific development, a specific technology, a specific operational implication, relevant project context, the main players involved or leading the category, and an INConnect opinion.",
          "Main players can include airports, airlines, airport operators, handlers, technology vendors, integrators, BHS suppliers, robotics companies, biometric providers, RFID providers, or infrastructure partners, but only name them when supported by the source context.",
          "If the source context does not support exact named players, describe the player types instead, such as airport operators, ground handlers, BHS integrators, RFID providers, biometric vendors, robotics suppliers, or GSE manufacturers.",
          "Avoid generic language such as 'Airports are increasingly leveraging', 'Digital transformation continues', and 'The future is'.",
          "Prioritize freshness over length.",
          "Do not include Why It Matters, Source, Key Takeaways, Discussion Question, Read Original Article, Summary, Suggested LinkedIn Post, Top Developments, Technology Trends, Business Opportunities, numbered lists, newsletter formatting, long-form article sections, or report-style commentary.",
          "Do not use numbered lists or bullet lists.",
          "Tone must be professional, concise, insightful, opinionated, and airport industry focused.",
          "The entire post must represent the INConnect interpretation of the source context, not the original article.",
          "The title must use this exact pattern: [Specific Topic] | INConnect 1-Minute Briefing.",
          "Return one category from: Passenger Processing, Baggage Handling, RFID, Computer Vision, LiDAR, Robotics, Autonomous Vehicles, Airport Operations, Apron Safety, Airside Automation, Cargo Automation, Security Screening, Terminal Analytics, Digital Twin, AI Operations, Biometrics, Self Service, Sustainability, Asset Tracking, Turnaround Optimization.",
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
          `Preferred category for today's rotation: ${preferredCategory}`,
          `Selected novelty category: ${topicSelection.category}`,
          `Selected novelty topic: ${topicSelection.topic}`,
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
          "Official site hints for inline company links:",
          ...AIRPORT_OFFICIAL_SITE_HINTS.map((hint) => `- ${hint}`),
          "",
          "Return structured JSON only.",
          `Set title in this exact format: ${requiredTitleFormat}`,
          "Choose one specific airport automation development. Do not create a generic trend title.",
          "Base the post on the strongest recent airport project or deployment in the source context.",
          "Include where the development happened, such as the airport, operator, agency, or region, when supported.",
          "Include companies or main players involved, such as airport operators, airlines, technology vendors, integrators, handlers, suppliers, agencies, or infrastructure partners, when supported.",
          "Bold every named airport, operator, airline, agency, and company. Use official-site Markdown links for those names when an official website is clearly available. Do not write raw URLs.",
          "Set category to the selected novelty category unless the source context clearly supports a stronger category.",
          "Set airportName to the airport/operator if clearly supported, otherwise use an empty string.",
          "Set keywords to 4-8 topic keywords for anti-repetition.",
          `Set slug to a concise keyword phrase ending in ${slugDate}.`,
          "content: exactly three concise paragraphs with no Markdown headings. Paragraph 1: what happened and the particular project/deployment if supported. Paragraph 2: why it matters for airports and the main players in this direction. Paragraph 3: INConnect View integrated naturally.",
          "Do not include source article links, source labels, discussion questions, bullets, or numbered lists.",
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
  if (
    !parsed.title ||
    !parsed.content
  ) {
    throw new Error("Generated airport briefing was empty or incomplete.");
  }

  return {
    ...parsed,
    category: normalizeAirportCategory(parsed.category || topicSelection.category),
    keywords: normalizeAirportKeywords(parsed.keywords),
    title: normalizeAirportBriefingTitle(parsed.title),
  };
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
  let content = cleanPostContent(generatedBriefing.content);
  let quality = getAirportBriefingQuality(content);
  const initialWordCount = quality.wordCount;

  console.info("INConnect airport briefing initial quality check", {
    issues: quality.issues,
    initialWordCount,
    paragraphCount: quality.paragraphCount,
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
    quality = getAirportBriefingQuality(content);
    console.info("INConnect airport digest revision quality check", {
      issues: quality.issues,
      revisionAttempt,
      paragraphCount: quality.paragraphCount,
      title,
      wordCount: quality.wordCount,
    });
  }

  console.info("INConnect airport briefing final quality check result", {
    issues: quality.issues,
    passed: quality.issues.length === 0,
    paragraphCount: quality.paragraphCount,
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
          "You are revising an INConnect 1-Minute Briefing for airport professionals.",
          "Fix the listed quality issues exactly.",
          "Return one flowing professional intelligence post only and target 150-250 words total, with an allowed range of 120-350 words.",
          "If the current briefing is below 120 words, expand once with more INConnect perspective and airport-specific operational context.",
          "If the current briefing is above 350 words, shorten once while preserving the key point.",
          "Use exactly three concise paragraphs: what happened with the particular project or deployment when supported, airport importance with the main players in this direction, and INConnect View integrated naturally in the final paragraph.",
          "Preserve concrete project context and relevant players from the research context whenever they are supported.",
          "If exact company or airport names are not supported, refer to the player types instead, such as airport operators, ground handlers, BHS integrators, RFID providers, biometric vendors, robotics suppliers, or GSE manufacturers.",
          "Bold every named airport, operator, airline, agency, and company. Use official-site Markdown links for those names when an official website is clearly available. Do not write raw URLs.",
          "Return only the post body in the content field. Do not include title, source article links, discussion questions, headings, bullets, or numbered lists.",
          "Do not invent airport projects, contracts, deployments, or company claims.",
          "Do not add LinkedIn optimization, personal branding, B2B sales visibility, career growth, or generic AI-for-professionals content.",
          "Use only the provided research context.",
          "Do not add Why It Matters, Source, Read original story, Discussion Question, Key Takeaways, Summary, Suggested LinkedIn Post, Top Developments, Technology Trends, Business Opportunities, numbered lists, newsletter formatting, long-form article sections, external source lists, raw URLs, news article links, or generic filler.",
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
          "Current briefing:",
          content,
          "",
          "Return structured JSON only with the revised post body in the content field.",
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
  if (!parsed.content) {
    throw new Error("Revised airport digest was empty or incomplete.");
  }

  return cleanPostContent(parsed.content);
}

function getAirportBriefingQuality(content: string): AirportBriefingQuality {
  const issues: string[] = [];
  const wordCount = countWords(stripMarkdown(content));
  const paragraphs = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const paragraphCount = paragraphs.length;

  if (wordCount < MIN_AIRPORT_WORD_COUNT) {
    issues.push(`Briefing has ${wordCount} words; minimum is ${MIN_AIRPORT_WORD_COUNT}.`);
  }

  if (wordCount > MAX_AIRPORT_WORD_COUNT) {
    issues.push(`Briefing has ${wordCount} words; maximum is ${MAX_AIRPORT_WORD_COUNT}.`);
  }

  if (paragraphCount !== 3) {
    issues.push("Briefing must be one flowing post with exactly three short paragraphs.");
  }

  if (hasRawUrlOutsideMarkdownLink(content)) {
    issues.push("Post must not include raw URLs. Use inline Markdown links only on official company or airport names.");
  }

  if (!hasValidMarkdownLinks(content)) {
    issues.push("Markdown links must use valid http or https URLs and readable linked names.");
  }

  if (/^#{1,6}\s+/m.test(content)) {
    issues.push("Briefing must not use Markdown section headings.");
  }

  if (/why it matters|source:|read original story|discussion question|\?|key takeaways|summary|further reading|suggested linkedin post|technology signals|business opportunities|companies to watch|executive summary|top developments|technology trends|development a|development b|development c/i.test(content)) {
    issues.push("Post includes article, newsletter, or report-style sections.");
  }

  if (!hasAirportProjectLanguage(content)) {
    issues.push("Post must include concrete project, deployment, launch, pilot, rollout, or modernization context.");
  }

  if (!hasAirportPlayerContext(content)) {
    issues.push("Post must mention the airport, operator, agency, airline, supplier, integrator, handler, or main player type involved.");
  }

  if (/^\s*\d+\./m.test(content)) {
    issues.push("Digest includes a numbered list.");
  }

  if (containsForbiddenAirportTopic(content)) {
    issues.push("Briefing includes non-airport LinkedIn, branding, career, or B2B sales content.");
  }

  return { issues, paragraphCount, wordCount };
}

function hasAirportProjectLanguage(content: string) {
  const haystack = content.toLowerCase();
  return AIRPORT_PROJECT_SIGNALS.some((signal) => haystack.includes(signal));
}

function hasAirportPlayerContext(content: string) {
  const haystack = content.toLowerCase();
  const playerTypePattern =
    /\b(airport operator|airport authority|airline|agency|handler|ground handler|technology vendor|supplier|integrator|bhs provider|rfid provider|biometric provider|robotics supplier|gse manufacturer|infrastructure partner)\b/i;
  return (
    playerTypePattern.test(content) ||
    AIRPORT_PLAYER_SIGNALS
      .filter((signal) => !["airport", "airports"].includes(signal))
      .some((signal) => haystack.includes(signal))
  );
}

function hasRawUrlOutsideMarkdownLink(content: string) {
  const withoutMarkdownUrls = content.replace(/\[[^\]]+\]\(https?:\/\/[^)\s]+\)/gi, "");
  return /https?:\/\//i.test(withoutMarkdownUrls);
}

function hasValidMarkdownLinks(content: string) {
  const matches = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
  return matches.every((match) => {
    const label = stripMarkdown(match[1] ?? "").trim();
    const url = (match[2] ?? "").trim();
    return label.length > 1 && /^https?:\/\/[^\s)]+$/i.test(url);
  });
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
  const visual = chooseAirportVisual(`${slug} ${title}`);
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
      : "Avoid generic blue office imagery and generic airport control rooms; make the scene specific to the exact airport automation topic.",
    "Realistic premium business-magazine photography, modern airport environment, diverse professionals, operational technology, blue INConnect accents balanced with neutral airport materials.",
    "No LinkedIn screens, no social media profile imagery, no generic professional branding scenes, no office-only scenes.",
    "No text, no letters, no logos, no watermarks, no cartoon style, no mascot style, no exaggerated sci-fi effects.",
  ].join(" ");
}

function chooseAirportVisual(slug: string) {
  const normalized = slug.toLowerCase();
  const visuals = [
    {
      pattern: /\b(rfid|atr|tag|tracking)\b/,
      visual:
        "close-up realistic airport baggage tags passing through RFID reading gates on a conveyor, airport engineer checking sensor status nearby",
    },
    {
      pattern: /\b(baggage|bhs|bag|sortation|conveyor)\b/,
      visual:
        "automated baggage handling hall with conveyors, diverters, scanning equipment, and airport operations staff inspecting system flow",
    },
    {
      pattern: /\b(biometric|e-?gate|passenger|kiosk|self-service|boarding)\b/,
      visual:
        "modern airport passenger processing area with biometric e-gates, self-service kiosks, and calm terminal staff supervising passenger flow",
    },
    {
      pattern: /\b(robot|robotics|humanoid)\b/,
      visual:
        "realistic airport robotics scene with a robot supporting baggage or terminal operations, airport staff nearby, no cartoon styling",
    },
    {
      pattern: /\b(gse|ground support|tug|airside|apron|turnaround)\b/,
      visual:
        "autonomous electric ground support vehicle or tug operating on an airport apron near aircraft turnaround equipment",
    },
    {
      pattern: /\b(cargo|freight|uld|warehouse)\b/,
      visual:
        "automated air cargo facility with ULD containers, tracking scanners, robotic handling equipment, and logistics professionals",
    },
    {
      pattern: /\b(security|screening|checkpoint)\b/,
      visual:
        "airport security screening lane with automated scanners, sensor analytics displays, and professional security staff",
    },
    {
      pattern: /\b(ai|vision|analytics|lidar|sensor|digital)\b/,
      visual:
        "airport operations floor with computer vision and sensor analytics visualized over passenger or baggage flow, realistic and topic-specific",
    },
  ];
  const matchedVisual = visuals.find(({ pattern }) => pattern.test(normalized))?.visual;
  if (matchedVisual) return matchedVisual;

  const fallbackVisuals = [
    "smart airport passenger processing deployment with e-gates and airport technology specialists in a terminal",
    "airport baggage automation deployment with conveyors, scanners, RFID tags, and engineering staff",
    "airside automation scene with autonomous support equipment, apron operations, and aviation technology professionals",
  ];
  return fallbackVisuals[hashString(slug) % fallbackVisuals.length];
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
  return `Airport Automation Signal | INConnect 1-Minute Briefing`;
}

function cleanPostContent(value: string) {
  return value
    .replace(/^#+\s+/gm, "")
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, "")
    .replace(/^\s*(?:INConnect Brief|Why It Matters|INConnect View|Summary|Key Takeaways|Source)\s*:?\s*/gim, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, "[$1]($2)")
    .replace(/(?<!\]\()https?:\/\/\S+/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeAirportBriefingTitle(value: string) {
  const baseTitle = value
    .replace(/\s*\|\s*Airport Automation Daily\s*$/i, "")
    .replace(/\s*-\s*\d{1,2}\s+\w+\s+\d{4}$/i, "")
    .replace(/\s*-\s*\d{4}-\d{2}-\d{2}$/i, "")
    .replace(/\s*\|\s*INConnect 1-Minute Briefing\s*$/i, "")
    .trim();

  return `${baseTitle || "Airport Automation Signal"} | INConnect 1-Minute Briefing`;
}

function normalizeAirportCategory(value: string) {
  const trimmedValue = value.trim();
  return AIRPORT_CATEGORY_ALIASES[trimmedValue] ?? trimmedValue;
}

function normalizeAirportKeywords(values: unknown) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === "string" ? cleanText(value, 60) : ""))
    .filter(Boolean)
    .slice(0, 8);
}

function getPreferredAirportCategory() {
  return AIRPORT_CATEGORY_ROTATION[new Date().getUTCDay()] ?? "Editor's Pick";
}

function validateAirportTitle(title: string) {
  const normalizedTitle = title.toLowerCase().replace(/[-_/]+/g, " ");
  const detectedCategory =
    AIRPORT_TITLE_CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(title))
      ?.category ?? "Unknown";
  const matchedKeyword = AIRPORT_TITLE_KEYWORDS.find((keyword) =>
    normalizedTitle.includes(keyword.toLowerCase()),
  );

  return {
    detectedCategory,
    isValid: Boolean(matchedKeyword) || detectedCategory !== "Unknown",
    missingKeywordReason: matchedKeyword
      ? ""
      : "Title does not contain a recognized airport automation keyword or category signal.",
    matchedKeyword: matchedKeyword ?? "",
  };
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
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
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
