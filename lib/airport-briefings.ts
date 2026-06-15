import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type AirportBriefing = {
  airportName?: string;
  category?: string;
  content: string;
  createdAt: string;
  excerpt: string;
  generatedAt: string;
  heroImagePrompt?: string;
  heroImageUrl: string;
  id?: string;
  keywords?: string[];
  published?: boolean;
  publishedAt?: string;
  readingTime?: string;
  researchSources?: unknown[];
  researchSummary?: string;
  seoDescription: string;
  seoTitle: string;
  slug: string;
  title: string;
};

type AirportBriefingRow = {
  airport_name: string | null;
  category: string | null;
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  hero_image_url: string | null;
  hero_image_prompt: string | null;
  keywords: string[] | null;
  reading_time: string | null;
  research_sources: unknown[] | null;
  research_summary: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published: boolean;
  published_at: string | null;
  generated_at: string;
  created_at: string;
};

type AirportBriefingLegacyRow = Omit<
  AirportBriefingRow,
  | "airport_name"
  | "category"
  | "keywords"
  | "published_at"
  | "reading_time"
  | "research_sources"
  | "research_summary"
>;

const DEFAULT_AIRPORT_HERO_IMAGE_URL = "/hero-professionals-collage.png";
const demoGeneratedAt = "2026-06-09T07:30:00.000Z";

export const demoAirportBriefings: AirportBriefing[] = [
  {
    content: [
      "## INConnect Brief",
      "Airport baggage automation is becoming one of the clearest operational signals in the smart airport market. The strongest story is no longer only faster bag movement, but better visibility across exceptions, transfer points, and terminal constraints.",
      "",
      "## Why It Matters",
      "Baggage remains one of the most visible failure points in airport operations. Better automation gives airports and airlines more control over disruption, accountability, and passenger trust.",
      "",
      "## INConnect View",
      "INConnect sees baggage automation as a practical bridge between legacy infrastructure and digital airport operations. The winners will treat baggage data as operational intelligence, not only tracking information.",
    ].join("\n"),
    createdAt: demoGeneratedAt,
    category: "Baggage Handling",
    excerpt: "A concise INConnect briefing on baggage automation as a practical smart airport signal.",
    generatedAt: demoGeneratedAt,
    heroImageUrl: DEFAULT_AIRPORT_HERO_IMAGE_URL,
    readingTime: "1 Minute Read",
    seoDescription:
      "Airport Automation Daily preview from INConnect covering smart airports, baggage automation, RFID, AI, robotics, and passenger processing.",
    seoTitle: "Baggage Automation Signal | INConnect 1-Minute Briefing | Airport Automation Daily",
    slug: "airport-automation-daily-preview",
    title: "Baggage Automation Signal | INConnect 1-Minute Briefing",
  },
];

export async function getPublishedAirportBriefings(limit?: number) {
  try {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("airport_briefings")
      .select(
        "id, slug, title, category, airport_name, excerpt, content, hero_image_url, hero_image_prompt, keywords, reading_time, research_sources, research_summary, seo_title, seo_description, published, published_at, generated_at, created_at",
      )
      .eq("published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("generated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (typeof limit === "number") {
      query = query.limit(limit);
    }

    const { data, error } = await query.returns<AirportBriefingRow[]>();

    if (error) {
      if (isMissingColumnError(error)) {
        return getPublishedAirportBriefingsLegacy(limit);
      }
      console.error("Airport briefings lookup failed", error);
      return [];
    }

    return (data ?? []).map(mapAirportBriefingRow).filter(isDisplayableAirportBriefing);
  } catch (error) {
    if (!isMissingSupabaseConfigError(error)) {
      console.error("Airport briefings fallback used", error);
      return [];
    }
    return demoAirportBriefings;
  }
}

export async function getPublishedAirportBriefingBySlug(slug: string) {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("airport_briefings")
      .select(
        "id, slug, title, category, airport_name, excerpt, content, hero_image_url, hero_image_prompt, keywords, reading_time, research_sources, research_summary, seo_title, seo_description, published, published_at, generated_at, created_at",
      )
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle<AirportBriefingRow>();

    if (error) {
      if (isMissingColumnError(error)) {
        return getPublishedAirportBriefingBySlugLegacy(slug);
      }
      console.error("Airport briefing lookup failed", { slug, error });
    }

    if (data) {
      const briefing = mapAirportBriefingRow(data);
      if (isDisplayableAirportBriefing(briefing)) return briefing;
    }
  } catch (error) {
    if (!isMissingSupabaseConfigError(error)) {
      console.error("Airport briefing fallback lookup used", { slug, error });
    }
  }

  return demoAirportBriefings.find((briefing) => briefing.slug === slug) ?? null;
}

async function getPublishedAirportBriefingsLegacy(limit?: number) {
  try {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("airport_briefings")
      .select(
        "id, slug, title, excerpt, content, hero_image_url, hero_image_prompt, seo_title, seo_description, published, generated_at, created_at",
      )
      .eq("published", true)
      .order("generated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (typeof limit === "number") {
      query = query.limit(limit);
    }

    const { data, error } = await query.returns<AirportBriefingLegacyRow[]>();

    if (error) {
      console.error("Airport briefings legacy lookup failed", error);
      return [];
    }

    return (data ?? [])
      .map(mapAirportBriefingLegacyRow)
      .filter(isDisplayableAirportBriefing);
  } catch (error) {
    if (!isMissingSupabaseConfigError(error)) {
      console.error("Airport briefings legacy fallback used", error);
      return [];
    }
    return demoAirportBriefings;
  }
}

async function getPublishedAirportBriefingBySlugLegacy(slug: string) {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("airport_briefings")
      .select(
        "id, slug, title, excerpt, content, hero_image_url, hero_image_prompt, seo_title, seo_description, published, generated_at, created_at",
      )
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle<AirportBriefingLegacyRow>();

    if (error) {
      console.error("Airport briefing legacy lookup failed", { slug, error });
      return null;
    }

    if (data) {
      const briefing = mapAirportBriefingLegacyRow(data);
      if (isDisplayableAirportBriefing(briefing)) return briefing;
    }
  } catch (error) {
    if (!isMissingSupabaseConfigError(error)) {
      console.error("Airport briefing legacy fallback lookup used", { slug, error });
    }
  }

  return demoAirportBriefings.find((briefing) => briefing.slug === slug) ?? null;
}

export function formatAirportBriefingDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function mapAirportBriefingRow(row: AirportBriefingRow): AirportBriefing {
  return {
    airportName: row.airport_name ?? undefined,
    category: row.category ?? undefined,
    content: row.content,
    createdAt: row.created_at,
    excerpt: row.excerpt,
    generatedAt: row.generated_at || row.created_at,
    heroImagePrompt: row.hero_image_prompt ?? undefined,
    heroImageUrl: row.hero_image_url || DEFAULT_AIRPORT_HERO_IMAGE_URL,
    id: row.id,
    keywords: row.keywords ?? undefined,
    published: row.published,
    publishedAt: row.published_at ?? undefined,
    readingTime: row.reading_time || "1 Minute Read",
    researchSources: row.research_sources ?? undefined,
    researchSummary: row.research_summary ?? undefined,
    seoDescription: row.seo_description || row.excerpt,
    seoTitle: row.seo_title || `${row.title} | Airport Automation Daily`,
    slug: row.slug,
    title: row.title,
  };
}

function mapAirportBriefingLegacyRow(row: AirportBriefingLegacyRow): AirportBriefing {
  return mapAirportBriefingRow({
    ...row,
    airport_name: null,
    category: null,
    keywords: null,
    published_at: null,
    reading_time: null,
    research_sources: null,
    research_summary: null,
  });
}

function isMissingSupabaseConfigError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Supabase server configuration is missing")
  );
}

function isMissingColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "42703"
  );
}

function isDisplayableAirportBriefing(briefing: AirportBriefing) {
  const title = briefing.title.toLowerCase();
  const hasAirportKeyword =
    /\b(airport|terminal|baggage|passenger processing|biometric|rfid|bhs|atr|airside|apron|ground support|gse|ground handling|cargo|security screening|e-?gate|self-service|kiosk|boarding|airport robotics|autonomous vehicle|airport ai|smart airport|digital airport|airport infrastructure)\b/i.test(
      `${briefing.title} ${briefing.category ?? ""} ${briefing.keywords?.join(" ") ?? ""}`,
    );
  const hasOffTopicTitle =
    title.includes("linkedin optimization") ||
    title.includes("linkedin headline") ||
    title.includes("personal branding") ||
    title.includes("profile visibility") ||
    title.includes("b2b sales visibility") ||
    title.includes("career growth");

  return hasAirportKeyword && !hasOffTopicTitle;
}
