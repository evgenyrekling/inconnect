import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type AirportBriefing = {
  content: string;
  createdAt: string;
  excerpt: string;
  generatedAt: string;
  heroImagePrompt?: string;
  heroImageUrl: string;
  id?: string;
  published?: boolean;
  seoDescription: string;
  seoTitle: string;
  slug: string;
  title: string;
};

type AirportBriefingRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  hero_image_url: string | null;
  hero_image_prompt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published: boolean;
  generated_at: string;
  created_at: string;
};

const DEFAULT_AIRPORT_HERO_IMAGE_URL = "/hero-professionals-collage.png";
const demoGeneratedAt = "2026-06-09T07:30:00.000Z";

export const demoAirportBriefings: AirportBriefing[] = [
  {
    content: [
      "## Executive Summary",
      "",
      "Airport Automation Daily tracks the operational technologies reshaping passenger flow, baggage movement, security, and airport infrastructure. This preview briefing is available while the live airport automation generator is being prepared.",
      "",
      "The strongest airport automation signals usually combine three themes: capacity pressure, labor efficiency, and passenger experience. Airports and suppliers are investing in systems that make operations more predictable without adding unnecessary complexity.",
      "",
      "## Top Developments",
      "",
      "- Baggage automation remains a priority because mishandled bags create cost, passenger frustration, and operational drag.",
      "- Passenger processing continues to move toward self-service, biometrics, and better identity orchestration.",
      "- AI, robotics, sensors, and digital airport platforms are becoming more practical when they solve a narrow operational pain point.",
      "",
      "## Industry Impact",
      "",
      "The industry impact is not only technical. Automation changes airport procurement, airline-airport collaboration, operational training, and the way infrastructure projects are justified.",
      "",
      "## Technology Trends",
      "",
      "- RFID baggage tracking and sensor-based visibility",
      "- AI-assisted decision support for operations teams",
      "- Robotics for repetitive or hard-to-staff operational tasks",
      "- LiDAR, computer vision, and flow analytics for passenger movement",
      "",
      "## Business Opportunities",
      "",
      "Suppliers that connect automation to measurable operational outcomes are better positioned than suppliers that only describe features. Airports need clear business cases, integration confidence, and credible deployment paths.",
      "",
      "## Companies Mentioned",
      "",
      "This preview does not reference live market sources yet. Future daily briefings will only mention companies when supported by source context.",
      "",
      "## Recommended LinkedIn Post",
      "",
      "Airport automation is becoming less about isolated technology pilots and more about operational intelligence. The winners will connect passenger flow, baggage visibility, security, and infrastructure data into decisions that help airports run with more confidence.",
    ].join("\n"),
    createdAt: demoGeneratedAt,
    excerpt:
      "A preview of Airport Automation Daily covering smart airports, baggage automation, RFID, AI, robotics, and passenger processing.",
    generatedAt: demoGeneratedAt,
    heroImageUrl: DEFAULT_AIRPORT_HERO_IMAGE_URL,
    seoDescription:
      "Airport Automation Daily preview from INConnect covering smart airports, baggage automation, RFID, AI, robotics, and passenger processing.",
    seoTitle: "Airport Automation Daily | INConnect",
    slug: "airport-automation-daily-preview",
    title: "Airport Automation Daily Preview",
  },
];

export async function getPublishedAirportBriefings(limit?: number) {
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

    const { data, error } = await query.returns<AirportBriefingRow[]>();

    if (error) {
      console.error("Airport briefings lookup failed", error);
      return [];
    }

    return (data ?? []).map(mapAirportBriefingRow);
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
        "id, slug, title, excerpt, content, hero_image_url, hero_image_prompt, seo_title, seo_description, published, generated_at, created_at",
      )
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle<AirportBriefingRow>();

    if (error) {
      console.error("Airport briefing lookup failed", { slug, error });
    }

    if (data) return mapAirportBriefingRow(data);
  } catch (error) {
    if (!isMissingSupabaseConfigError(error)) {
      console.error("Airport briefing fallback lookup used", { slug, error });
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
    content: row.content,
    createdAt: row.created_at,
    excerpt: row.excerpt,
    generatedAt: row.generated_at || row.created_at,
    heroImagePrompt: row.hero_image_prompt ?? undefined,
    heroImageUrl: row.hero_image_url || DEFAULT_AIRPORT_HERO_IMAGE_URL,
    id: row.id,
    published: row.published,
    seoDescription: row.seo_description || row.excerpt,
    seoTitle: row.seo_title || `${row.title} | Airport Automation Daily`,
    slug: row.slug,
    title: row.title,
  };
}

function isMissingSupabaseConfigError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Supabase server configuration is missing")
  );
}
