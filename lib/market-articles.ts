import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type MarketArticle = {
  articleType: string;
  body: string;
  category: string;
  createdAt: string;
  excerpt: string;
  id: string;
  imageAttribution: string;
  inconnectPerspective: string;
  published: boolean;
  publishedAt: string;
  qualityScore: number | null;
  slug: string;
  sourceDomain: string;
  sourceImageUrl: string;
  sourceName: string;
  sourceUrl: string;
  status: string;
  title: string;
  updatedAt: string;
};

export type MarketArticleRow = {
  article_type: string;
  body: string | null;
  category: string | null;
  created_at: string;
  excerpt: string | null;
  id: string;
  image_attribution: string | null;
  inconnect_perspective: string | null;
  published: boolean | null;
  published_at: string | null;
  quality_score: number | null;
  slug: string;
  source_domain: string | null;
  source_image_url: string | null;
  source_name: string | null;
  source_url: string | null;
  status: string | null;
  title: string;
  updated_at: string | null;
};

const MARKET_ARTICLE_SELECT = [
  "id",
  "article_type",
  "title",
  "slug",
  "category",
  "source_name",
  "source_url",
  "source_domain",
  "source_image_url",
  "image_attribution",
  "body",
  "inconnect_perspective",
  "excerpt",
  "status",
  "quality_score",
  "published",
  "published_at",
  "created_at",
  "updated_at",
].join(", ");

export const DEFAULT_MARKET_ARTICLE_IMAGE = "/hero-professionals-collage.png";

export async function getPublishedMarketArticles(articleType: string, limit?: number) {
  try {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("market_articles")
      .select(MARKET_ARTICLE_SELECT)
      .eq("article_type", articleType)
      .eq("published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (typeof limit === "number") query = query.limit(limit);

    const { data, error } = await query.returns<MarketArticleRow[]>();
    if (error) {
      console.error("MARKET ARTICLES LOOKUP ERROR", { articleType, error });
      return [];
    }

    return (data ?? []).map(mapMarketArticleRow);
  } catch (error) {
    if (!isMissingSupabaseConfigError(error)) {
      console.error("MARKET ARTICLES LOOKUP FAILED", { articleType, error });
    }
    return [];
  }
}

export async function getPublishedMarketArticleBySlug(articleType: string, slug: string) {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("market_articles")
      .select(MARKET_ARTICLE_SELECT)
      .eq("article_type", articleType)
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle<MarketArticleRow>();

    if (error) {
      console.error("MARKET ARTICLE LOOKUP ERROR", { articleType, error, slug });
      return null;
    }

    return data ? mapMarketArticleRow(data) : null;
  } catch (error) {
    if (!isMissingSupabaseConfigError(error)) {
      console.error("MARKET ARTICLE LOOKUP FAILED", { articleType, error, slug });
    }
    return null;
  }
}

export function mapMarketArticleRow(row: MarketArticleRow): MarketArticle {
  return {
    articleType: row.article_type,
    body: row.body ?? "",
    category: row.category ?? "",
    createdAt: row.created_at,
    excerpt: row.excerpt ?? "",
    id: row.id,
    imageAttribution: row.image_attribution ?? "",
    inconnectPerspective: row.inconnect_perspective ?? "",
    published: Boolean(row.published),
    publishedAt: row.published_at ?? row.created_at,
    qualityScore: row.quality_score,
    slug: row.slug,
    sourceDomain: row.source_domain ?? "",
    sourceImageUrl: row.source_image_url || DEFAULT_MARKET_ARTICLE_IMAGE,
    sourceName: row.source_name ?? "",
    sourceUrl: row.source_url ?? "",
    status: row.status ?? "",
    title: row.title,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export function formatMarketArticleDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function isMissingSupabaseConfigError(error: unknown) {
  return error instanceof Error && error.message.includes("Supabase server configuration is missing");
}
