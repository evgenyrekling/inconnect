import crypto from "node:crypto";
import OpenAI from "openai";
import { sendLidarDailyEmail } from "@/lib/email/resend";
import { normalizeEmail } from "@/lib/identity";
import { mapMarketArticleRow, type MarketArticle, type MarketArticleRow } from "@/lib/market-articles";
import { SITE_URL } from "@/lib/seo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type LidarSourceCandidate = {
  category: string;
  excerpt: string;
  imageUrl: string | null;
  sourceName: string;
  title: string;
  url: string;
};

type LidarRotationHistoryItem = {
  category: string;
  createdAt: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
};

type LidarRotationHistory = {
  recent: LidarRotationHistoryItem[];
  recentCategories: string[];
  recentSourceNames: string[];
  recentUrls: string[];
  usedUrls: Set<string>;
};

type GeneratedLidarArticle = {
  body: string;
  category: string;
  excerpt: string;
  inconnectPerspective: string;
  slug: string;
  title: string;
};

type SubscriptionRow = {
  email: string;
  id: string;
  normalized_email: string | null;
  unsubscribe_token: string | null;
};

const LIDAR_ARTICLE_TYPE = "lidar_daily";
const LIDAR_CATEGORIES = [
  "Automotive LiDAR",
  "Industrial LiDAR",
  "Robotics",
  "ITS / Smart Infrastructure",
  "Airports",
  "Ports",
  "Warehousing",
  "Mobile Machines",
  "Mapping & Surveying",
  "Security / Perimeter",
  "New Products",
  "Funding & M&A",
  "Partnerships",
  "Research & Innovation",
];

const LIDAR_SOURCES = [
  { name: "Ouster", url: "https://ouster.com/news" },
  { name: "Hesai", url: "https://www.hesaitech.com/newsroom/" },
  { name: "Seyond", url: "https://www.seyond.com/newsroom/" },
  { name: "RoboSense", url: "https://www.robosense.ai/en/news" },
  { name: "Luminar", url: "https://www.luminartech.com/newsroom" },
  { name: "Innoviz", url: "https://innoviz.tech/newsroom" },
  { name: "Aeva", url: "https://www.aeva.com/news/" },
  { name: "AEye", url: "https://www.aeye.ai/news/" },
  { name: "Blickfeld", url: "https://www.blickfeld.com/blog/" },
  { name: "SICK", url: "https://www.sick.com/news" },
  { name: "Leuze", url: "https://www.leuze.com/en-int/news" },
  { name: "Pepperl+Fuchs", url: "https://www.pepperl-fuchs.com/global/en/news.htm" },
  { name: "Livox", url: "https://www.livoxtech.com/news" },
  { name: "Benewake", url: "https://en.benewake.com/news" },
  { name: "VanJee", url: "https://www.vanjee.net/news/" },
  { name: "Waymo", url: "https://waymo.com/blog/" },
  { name: "Zoox", url: "https://zoox.com/news/" },
  { name: "Aurora", url: "https://aurora.tech/newsroom" },
  { name: "Mobileye", url: "https://www.mobileye.com/news/" },
  { name: "Caterpillar", url: "https://www.caterpillar.com/en/news.html" },
  { name: "Komatsu", url: "https://www.komatsu.com/en/newsroom/" },
  { name: "Sandvik", url: "https://www.home.sandvik/en/news-and-media/news/" },
  { name: "Siemens", url: "https://press.siemens.com/global/en/press-search?search_api_fulltext=lidar" },
  { name: "ABB", url: "https://new.abb.com/news" },
  { name: "KUKA", url: "https://www.kuka.com/en-de/company/press/news" },
  { name: "The Robot Report", url: "https://www.therobotreport.com/" },
  { name: "IEEE Spectrum", url: "https://spectrum.ieee.org/tag/lidar" },
  { name: "ITS International", url: "https://www.itsinternational.com/" },
  { name: "Automotive World", url: "https://www.automotiveworld.com/" },
  { name: "Smart Cities World", url: "https://www.smartcitiesworld.net/" },
];

const lidarArticleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "slug", "category", "excerpt", "body", "inconnectPerspective"],
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    category: { type: "string" },
    excerpt: { type: "string" },
    body: { type: "string" },
    inconnectPerspective: { type: "string" },
  },
};

export class LidarDailyError extends Error {
  constructor(
    public readonly stage: string,
    message: string,
  ) {
    super(message);
    this.name = "LidarDailyError";
  }
}

export async function generateAndStoreLidarDailyArticle(options?: {
  publish?: boolean;
  sourceUrl?: string;
}) {
  console.info("LIDAR DAILY GENERATION START");
  const supabase = getSupabaseAdminClient();
  const rotationHistory = await getLidarRotationHistory();
  const selectedSource = options?.sourceUrl
    ? await createManualLidarSourceSelection(options.sourceUrl, rotationHistory)
    : await selectLidarSource(rotationHistory);
  const source = selectedSource?.candidate ?? null;

  if (!source) {
    throw new LidarDailyError("source_selection", "No strong LiDAR source found today.");
  }

  console.info("LIDAR DAILY SOURCE SELECTED", {
    category: source.category,
    rotationFallbackUsed: selectedSource?.rotationFallbackUsed ?? false,
    sourceName: source.sourceName,
    title: source.title,
    url: source.url,
  });

  const generated = await generateOriginalLidarArticle(source);
  const quality = scoreLidarArticle(generated, source);
  const autoSendEnabled = isAutoSendLidarDailyEnabled();
  const publishRequested = Boolean(options?.publish || autoSendEnabled);
  const published = publishRequested && quality.score >= 85;
  const status = published ? "published" : "draft_candidate";
  const emailSkippedReason = published
    ? ""
    : !autoSendEnabled && !options?.publish
      ? "AUTO_SEND_LIDAR_DAILY is false"
      : quality.score < 85
        ? "quality score below 85"
        : "publish not requested";
  console.info("LIDAR DAILY PUBLISH DECISION", {
    autoSendValue: process.env.AUTO_SEND_LIDAR_DAILY ?? "",
    autoSendEnabled,
    emailSkippedReason,
    publishRequested,
    published,
    qualityScore: quality.score,
    status,
  });
  const now = new Date().toISOString();
  const slug = await ensureUniqueMarketArticleSlug(generated.slug || slugify(generated.title));
  const payload = {
    article_type: LIDAR_ARTICLE_TYPE,
    body: generated.body,
    category: generated.category || source.category,
    excerpt: generated.excerpt,
    image_attribution: source.imageUrl ? `Source image from ${source.sourceName}` : null,
    inconnect_perspective: generated.inconnectPerspective,
    published,
    published_at: published ? now : null,
    quality_score: quality.score,
    slug,
    source_domain: getDomain(source.url),
    source_image_url: source.imageUrl || null,
    source_name: source.sourceName,
    source_url: source.url,
    status,
    title: generated.title,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("market_articles")
    .insert(payload)
    .select(
      "id, article_type, title, slug, category, source_name, source_url, source_domain, source_image_url, image_attribution, body, inconnect_perspective, excerpt, status, quality_score, published, published_at, created_at, updated_at",
    )
    .single<MarketArticleRow>();

  if (error) {
    console.error("LIDAR DAILY ARTICLE INSERT ERROR", { error, payload });
    throw new LidarDailyError("database_insert", error.message);
  }

  console.info("LIDAR DAILY ARTICLE STORED", {
    autoSendValue: process.env.AUTO_SEND_LIDAR_DAILY ?? "",
    emailSkippedReason,
    published,
    qualityScore: quality.score,
    slug,
    status,
    title: generated.title,
  });

  return {
    article: mapMarketArticleRow(data),
    publishDecision: {
      autoSendEnabled,
      emailSkippedReason,
      publishRequested,
      published,
      status,
    },
    quality,
  };
}

export async function sendLatestLidarDailyEmail(options?: {
  allowDraft?: boolean;
  articleId?: string;
  testEmail?: string;
}) {
  const supabase = getSupabaseAdminClient();
  const article = options?.articleId
    ? await getLidarArticleById(options.articleId, Boolean(options.allowDraft))
    : await getLatestPublishedLidarArticle();
  if (!article) {
    throw new LidarDailyError(
      "latest_article",
      options?.allowDraft
        ? "No LiDAR Daily article found."
        : "No published LiDAR Daily article found.",
    );
  }
  if (!article.published && !options?.allowDraft) {
    console.info("LIDAR DAILY EMAIL SKIPPED", {
      articleId: article.id,
      reason: "article is draft",
      status: article.status,
    });
    throw new LidarDailyError("email_skip", "Publish the LiDAR Daily article before sending to subscribers.");
  }

  const subscribers = options?.testEmail
    ? [{ email: normalizeEmail(options.testEmail), id: "test", normalized_email: normalizeEmail(options.testEmail), unsubscribe_token: null }]
    : await getActiveLidarSubscribers();

  console.info("LIDAR DAILY EMAIL SUBSCRIBERS", {
    articleId: article.id,
    count: subscribers.length,
    mode: options?.testEmail ? "test" : "subscribers",
    published: article.published,
    status: article.status,
  });
  if (subscribers.length === 0) {
    console.info("LIDAR DAILY EMAIL SKIPPED", {
      articleId: article.id,
      reason: "no active lidar_daily subscribers",
    });
  }

  let sent = 0;
  let failed = 0;
  const results: Array<{ email: string; error?: string; status: "failed" | "sent" }> = [];

  for (const subscriber of subscribers) {
    const email = normalizeEmail(subscriber.normalized_email || subscriber.email);
    if (!email) continue;

    try {
      const unsubscribeToken =
        subscriber.unsubscribe_token ||
        (subscriber.id === "test" ? "" : await ensureUnsubscribeToken(subscriber.id));
      const result = await sendLidarDailyEmail({
        briefingText: createEmailExcerpt(article),
        heroImageUrl: article.sourceImageUrl ? toAbsoluteUrl(article.sourceImageUrl) : undefined,
        readUrl: `${SITE_URL}/intelligence/lidar-daily/${article.slug}`,
        sourceUrl: article.sourceUrl,
        title: article.title,
        to: email,
        unsubscribeUrl: unsubscribeToken ? `${SITE_URL}/unsubscribe?token=${unsubscribeToken}` : undefined,
      });

      if (subscriber.id !== "test") {
        await logDelivery({
          articleId: article.id,
          email,
          resendEmailId: result.id,
          status: "sent",
          subscriptionId: subscriber.id,
        });
      }
      sent += 1;
      results.push({ email, status: "sent" });
      console.info("LIDAR DAILY EMAIL SENT", {
        articleId: article.id,
        email,
        sent,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("LIDAR DAILY EMAIL SEND FAILURE", { email, error });
      if (subscriber.id !== "test") {
        await logDelivery({
          articleId: article.id,
          email,
          errorMessage: message,
          status: "failed",
          subscriptionId: subscriber.id,
        });
      }
      failed += 1;
      results.push({ email, error: message, status: "failed" });
    }
  }

  console.info("LIDAR DAILY EMAIL COMPLETE", {
    articleId: article.id,
    failed,
    mode: options?.testEmail ? "test" : "subscribers",
    sent,
    subscriberCount: subscribers.length,
  });

  return {
    articleId: article.id,
    failed,
    results,
    sent,
    slug: article.slug,
    subscribers: subscribers.length,
    success: failed === 0,
    title: article.title,
  };
}

export async function getLatestLidarAdminArticle() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("market_articles")
    .select(
      "id, article_type, title, slug, category, source_name, source_url, source_domain, source_image_url, image_attribution, body, inconnect_perspective, excerpt, status, quality_score, published, published_at, created_at, updated_at",
    )
    .eq("article_type", LIDAR_ARTICLE_TYPE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<MarketArticleRow>();

  if (error) throw new LidarDailyError("admin_lookup", error.message);
  return data ? mapMarketArticleRow(data) : null;
}

export async function updateLidarArticleStatus(id: string, action: "delete" | "publish" | "unpublish") {
  const supabase = getSupabaseAdminClient();
  if (action === "delete") {
    const { error } = await supabase.from("market_articles").delete().eq("id", id);
    if (error) throw new LidarDailyError("delete", error.message);
    return null;
  }

  const published = action === "publish";
  const { data, error } = await supabase
    .from("market_articles")
    .update({
      published,
      published_at: published ? new Date().toISOString() : null,
      status: published ? "published" : "draft_candidate",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(
      "id, article_type, title, slug, category, source_name, source_url, source_domain, source_image_url, image_attribution, body, inconnect_perspective, excerpt, status, quality_score, published, published_at, created_at, updated_at",
    )
    .single<MarketArticleRow>();

  if (error) throw new LidarDailyError(action, error.message);
  return mapMarketArticleRow(data);
}

async function createManualLidarSourceSelection(sourceUrl: string, history: LidarRotationHistory) {
  const candidate = await createCandidateFromUrl(sourceUrl);
  if (!candidate) return null;

  const hardReason = getSourceRejectionReason(candidate, history.usedUrls);
  if (hardReason) {
    console.info("LIDAR DAILY CANDIDATE REJECTED", {
      reason: hardReason,
      sourceName: candidate.sourceName,
      url: candidate.url,
    });
    return null;
  }

  const rotationReason = getRotationRejectionReason(candidate, history);
  if (rotationReason) {
    console.warn("LIDAR DAILY ROTATION FALLBACK USED", {
      category: candidate.category,
      reason: rotationReason,
      sourceName: candidate.sourceName,
      url: candidate.url,
    });
  }

  return { candidate, rotationFallbackUsed: Boolean(rotationReason) };
}

async function selectLidarSource(history: LidarRotationHistory) {
  const rejected: Array<{ reason: string; sourceName: string; title: string; url: string }> = [];
  const rotationFallbacks: LidarSourceCandidate[] = [];

  console.info("LIDAR DAILY ROTATION HISTORY", {
    recentCategories: history.recentCategories,
    recentSourceNames: history.recentSourceNames,
    recentUrls: history.recentUrls,
  });

  for (const source of LIDAR_SOURCES) {
    const candidates = await discoverCandidatesFromSource(source);
    for (const candidate of candidates) {
      const hardReason = getSourceRejectionReason(candidate, history.usedUrls);
      if (hardReason) {
        console.info("LIDAR DAILY CANDIDATE REJECTED", {
          reason: hardReason,
          sourceName: candidate.sourceName,
          url: candidate.url,
        });
        rejected.push({ reason: hardReason, sourceName: candidate.sourceName, title: candidate.title, url: candidate.url });
        continue;
      }

      const rotationReason = getRotationRejectionReason(candidate, history);
      if (rotationReason) {
        console.info("LIDAR DAILY CANDIDATE REJECTED", {
          reason: rotationReason,
          sourceName: candidate.sourceName,
          url: candidate.url,
        });
        rejected.push({ reason: rotationReason, sourceName: candidate.sourceName, title: candidate.title, url: candidate.url });
        rotationFallbacks.push(candidate);
        continue;
      }

      console.info("LIDAR DAILY SOURCE SELECTED", {
        category: candidate.category,
        rotationFallbackUsed: false,
        sourceName: candidate.sourceName,
        url: candidate.url,
      });
      return { candidate, rotationFallbackUsed: false };
    }
  }

  if (rotationFallbacks.length > 0) {
    const candidate = rotationFallbacks[0];
    console.warn("LIDAR DAILY ROTATION FALLBACK USED", {
      category: candidate.category,
      sourceName: candidate.sourceName,
      url: candidate.url,
    });
    return { candidate, rotationFallbackUsed: true };
  }

  console.warn("LIDAR DAILY SOURCE CANDIDATES REJECTED", rejected.slice(0, 30));
  return null;
}

async function discoverCandidatesFromSource(source: { name: string; url: string }) {
  const html = await fetchHtml(source.url);
  const links = extractLinks(html, source.url)
    .filter((link) => !isWeakUrl(link.url))
    .slice(0, 12);
  const candidates: LidarSourceCandidate[] = [];

  for (const link of links) {
    const articleHtml = await fetchHtml(link.url);
    const title = cleanText(extractMeta(articleHtml, "og:title") || extractTitle(articleHtml) || link.text);
    const excerpt = cleanText(extractMeta(articleHtml, "og:description") || extractMeta(articleHtml, "description"));
    const imageUrl = await getValidSourceImageUrl(extractMeta(articleHtml, "og:image"), link.url);
    const value = `${title} ${excerpt} ${articleHtml.slice(0, 2000)}`;
    if (!hasLidarSignal(value)) continue;
    candidates.push({
      category: inferLidarCategory(value),
      excerpt,
      imageUrl,
      sourceName: source.name,
      title,
      url: link.url,
    });
  }

  return candidates;
}

async function createCandidateFromUrl(url: string) {
  const html = await fetchHtml(url);
  const title = cleanText(extractMeta(html, "og:title") || extractTitle(html));
  const excerpt = cleanText(extractMeta(html, "og:description") || extractMeta(html, "description"));
  const imageUrl = await getValidSourceImageUrl(extractMeta(html, "og:image"), url);
  const value = `${title} ${excerpt} ${html.slice(0, 3000)}`;
  if (!title || !hasLidarSignal(value)) return null;
  return {
    category: inferLidarCategory(value),
    excerpt,
    imageUrl,
    sourceName: getDomain(url),
    title,
    url,
  };
}

async function generateOriginalLidarArticle(source: LidarSourceCandidate) {
  if (!process.env.OPENAI_API_KEY) {
    throw new LidarDailyError("openai_config", "OPENAI_API_KEY is not configured.");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    temperature: 0.55,
    max_output_tokens: 2600,
    input: [
      {
        role: "system",
        content: [
          "You are INConnect Market Intelligence writing LiDAR Daily.",
          "Write one original industry-news article from one primary source.",
          "Do not copy or closely paraphrase the source.",
          "Tone is neutral, professional, and factual.",
          "The article body must be 400-800 words.",
          "Opening should normally start with 'Today, {company/source} announced...' or similar factual wording.",
          "No bullet-heavy format. No unsupported claims. No fake statistics.",
          "Include source attribution naturally at the end.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Source name: ${source.sourceName}`,
          `Source URL: ${source.url}`,
          `Source title: ${source.title}`,
          `Source excerpt: ${source.excerpt}`,
          `Preferred category: ${source.category}`,
          `Allowed categories: ${LIDAR_CATEGORIES.join(", ")}`,
          "Return structured JSON only.",
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "lidar_daily_article",
        strict: true,
        schema: lidarArticleSchema,
      },
    },
  });

  if (!response.output_parsed) {
    throw new LidarDailyError("openai_generation", "LiDAR Daily response format error.");
  }
  const parsed = response.output_parsed as GeneratedLidarArticle;
  if (!parsed.title || !parsed.body) {
    throw new LidarDailyError("quality_check", "Generated LiDAR article was incomplete.");
  }
  return parsed;
}

function scoreLidarArticle(article: GeneratedLidarArticle, source: LidarSourceCandidate) {
  const wordCount = countWords(article.body);
  const issues = [];
  if (wordCount < 400) issues.push("Article is below 400 words.");
  if (wordCount > 800) issues.push("Article is above 800 words.");
  if (!hasLidarSignal(`${article.title} ${article.body}`)) issues.push("Article lacks clear LiDAR relevance.");
  if (!article.body.toLowerCase().includes(source.sourceName.toLowerCase().split(".")[0])) {
    issues.push("Article does not clearly attribute the source.");
  }
  const score = Math.max(0, 100 - issues.length * 20);
  console.info("LIDAR DAILY QUALITY CHECK", { issues, score, wordCount });
  return { issues, score, wordCount };
}

async function getLidarRotationHistory(): Promise<LidarRotationHistory> {
  const supabase = getSupabaseAdminClient();
  const [recentResult, usedUrls] = await Promise.all([
    supabase
      .from("market_articles")
      .select("source_name, source_url, category, title, created_at")
      .eq("article_type", LIDAR_ARTICLE_TYPE)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<
        Array<{
          category: string | null;
          created_at: string;
          source_name: string | null;
          source_url: string | null;
          title: string | null;
        }>
      >(),
    getAllUsedLidarSourceUrls(),
  ]);

  if (recentResult.error) {
    console.warn("LIDAR DAILY ROTATION HISTORY LOOKUP ERROR", recentResult.error);
  }

  const recent = (recentResult.data ?? []).map((row) => ({
    category: row.category ?? "",
    createdAt: row.created_at,
    sourceName: row.source_name ?? "",
    sourceUrl: row.source_url ?? "",
    title: row.title ?? "",
  }));

  return {
    recent,
    recentCategories: recent.map((row) => row.category).filter(Boolean),
    recentSourceNames: recent.map((row) => row.sourceName).filter(Boolean),
    recentUrls: recent.map((row) => row.sourceUrl).filter(Boolean),
    usedUrls,
  };
}

async function getAllUsedLidarSourceUrls() {
  const supabase = getSupabaseAdminClient();
  const usedUrls = new Set<string>();
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("market_articles")
      .select("source_url")
      .eq("article_type", LIDAR_ARTICLE_TYPE)
      .not("source_url", "is", null)
      .range(from, from + pageSize - 1)
      .returns<Array<{ source_url: string | null }>>();

    if (error) {
      console.warn("LIDAR DAILY USED URL LOOKUP ERROR", error);
      break;
    }

    for (const row of data ?? []) {
      if (row.source_url) usedUrls.add(row.source_url);
    }
    if (!data || data.length < pageSize) break;
  }

  return usedUrls;
}

async function getLatestPublishedLidarArticle() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("market_articles")
    .select(
      "id, article_type, title, slug, category, source_name, source_url, source_domain, source_image_url, image_attribution, body, inconnect_perspective, excerpt, status, quality_score, published, published_at, created_at, updated_at",
    )
    .eq("article_type", LIDAR_ARTICLE_TYPE)
    .eq("published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<MarketArticleRow>();
  if (error) throw new LidarDailyError("latest_article", error.message);
  return data ? mapMarketArticleRow(data) : null;
}

async function getLidarArticleById(articleId: string, allowDraft: boolean) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("market_articles")
    .select(
      "id, article_type, title, slug, category, source_name, source_url, source_domain, source_image_url, image_attribution, body, inconnect_perspective, excerpt, status, quality_score, published, published_at, created_at, updated_at",
    )
    .eq("article_type", LIDAR_ARTICLE_TYPE)
    .eq("id", articleId);

  if (!allowDraft) query = query.eq("published", true);

  const { data, error } = await query.maybeSingle<MarketArticleRow>();
  if (error) throw new LidarDailyError("article_lookup", error.message);
  return data ? mapMarketArticleRow(data) : null;
}

async function getActiveLidarSubscribers() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, email, normalized_email, unsubscribe_token")
    .eq("digest_type", "lidar_daily")
    .eq("is_active", true)
    .returns<SubscriptionRow[]>();
  if (error) throw new LidarDailyError("subscribers", error.message);
  return data ?? [];
}

function isAutoSendLidarDailyEnabled() {
  return (process.env.AUTO_SEND_LIDAR_DAILY ?? "").trim().toLowerCase() === "true";
}

async function ensureUnsubscribeToken(subscriptionId: string) {
  const supabase = getSupabaseAdminClient();
  const token = crypto.randomBytes(32).toString("hex");
  const { data } = await supabase
    .from("subscriptions")
    .select("unsubscribe_token")
    .eq("id", subscriptionId)
    .maybeSingle<{ unsubscribe_token: string | null }>();
  if (data?.unsubscribe_token) return data.unsubscribe_token;
  const { error } = await supabase
    .from("subscriptions")
    .update({ unsubscribe_token: token, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);
  if (error) throw new LidarDailyError("unsubscribe_token", error.message);
  return token;
}

async function logDelivery(values: {
  articleId: string;
  email: string;
  errorMessage?: string;
  resendEmailId?: string;
  status: string;
  subscriptionId: string;
}) {
  const supabase = getSupabaseAdminClient();
  await supabase.from("email_deliveries").insert({
    content_id: values.articleId,
    content_type: "lidar_daily",
    digest_type: "lidar_daily",
    email: normalizeEmail(values.email),
    error_message: values.errorMessage ?? null,
    resend_email_id: values.resendEmailId ?? null,
    sent_at: new Date().toISOString(),
    status: values.status,
    subscription_id: values.subscriptionId,
  });
}

async function ensureUniqueMarketArticleSlug(baseSlug: string) {
  const supabase = getSupabaseAdminClient();
  let slug = slugify(baseSlug) || `lidar-daily-${Date.now()}`;
  const base = slug;
  let suffix = 2;
  while (true) {
    const { data } = await supabase
      .from("market_articles")
      .select("id")
      .eq("article_type", LIDAR_ARTICLE_TYPE)
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

function getSourceRejectionReason(candidate: LidarSourceCandidate, existingSources: Set<string>) {
  if (existingSources.has(candidate.url)) return "duplicate source URL";
  if (isWeakUrl(candidate.url)) return "weak URL";
  if (!candidate.title || candidate.title.length < 12) return "weak title";
  if (!hasLidarSignal(`${candidate.title} ${candidate.excerpt}`)) return "missing LiDAR signal";
  return "";
}

function getRotationRejectionReason(candidate: LidarSourceCandidate, history: LidarRotationHistory) {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const candidateSource = normalizeComparable(candidate.sourceName);
  const candidateCategory = normalizeComparable(candidate.category);

  const recentSevenDays = history.recent.filter((item) => now - new Date(item.createdAt).getTime() <= sevenDaysMs);
  if (
    candidateSource &&
    recentSevenDays.some((item) => normalizeComparable(item.sourceName) === candidateSource)
  ) {
    return "source name used within last 7 days";
  }

  const recentTwoDays = history.recent.filter((item) => now - new Date(item.createdAt).getTime() <= twoDaysMs);
  if (
    candidateCategory &&
    recentTwoDays.some((item) => normalizeComparable(item.category) === candidateCategory)
  ) {
    return "category used within last 2 days";
  }

  const similarTitle = history.recent.find((item) => areTitlesSimilar(candidate.title, item.title));
  if (similarTitle) return `title too similar to recent article: ${similarTitle.title}`;

  return "";
}

async function getValidSourceImageUrl(value: string, pageUrl: string) {
  const raw = cleanText(value);
  if (!raw) return null;

  let imageUrl: string;
  try {
    imageUrl = new URL(raw, pageUrl).toString();
  } catch {
    return null;
  }

  const rejectedReason = getRejectedImageReason(imageUrl);
  if (rejectedReason) {
    console.info("LIDAR DAILY SOURCE IMAGE REJECTED", { imageUrl, reason: rejectedReason });
    return null;
  }

  const metadata = await fetchImageMetadata(imageUrl, "HEAD");
  const finalMetadata =
    metadata.status === 405 || metadata.status === 403 || metadata.status === 0
      ? await fetchImageMetadata(imageUrl, "GET")
      : metadata;

  if (!finalMetadata.ok) {
    console.info("LIDAR DAILY SOURCE IMAGE REJECTED", {
      imageUrl,
      reason: `image fetch failed with status ${finalMetadata.status}`,
    });
    return null;
  }

  const contentType = finalMetadata.contentType.toLowerCase();
  if (!contentType.startsWith("image/")) {
    console.info("LIDAR DAILY SOURCE IMAGE REJECTED", { contentType, imageUrl, reason: "non-image content type" });
    return null;
  }
  if (contentType.includes("gif") || contentType.includes("svg")) {
    console.info("LIDAR DAILY SOURCE IMAGE REJECTED", { contentType, imageUrl, reason: "gif or svg image" });
    return null;
  }
  if (finalMetadata.contentLength > 0 && finalMetadata.contentLength < 2048) {
    console.info("LIDAR DAILY SOURCE IMAGE REJECTED", {
      contentLength: finalMetadata.contentLength,
      imageUrl,
      reason: "tiny image",
    });
    return null;
  }

  return imageUrl;
}

async function fetchImageMetadata(url: string, method: "GET" | "HEAD") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "image/*",
        ...(method === "GET" ? { range: "bytes=0-2048" } : {}),
        "user-agent": "Mozilla/5.0 (compatible; INConnectBot/1.0; +https://in-connect.app)",
      },
      method,
      signal: controller.signal,
    });
    return {
      contentLength: Number(response.headers.get("content-length") ?? "0"),
      contentType: response.headers.get("content-type") ?? "",
      ok: response.ok,
      status: response.status,
    };
  } catch {
    return { contentLength: 0, contentType: "", ok: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

function getRejectedImageReason(value: string) {
  const lower = value.toLowerCase();
  if (!/^https?:\/\//i.test(value)) return "not an http image URL";
  if (/\.(?:gif|svg)(?:[?#]|$)/i.test(value)) return "tracking-prone gif or svg";
  if (/\b(?:tracking|analytics|pixel|beacon|1x1|spacer)\b/i.test(value)) return "tracking or pixel image";
  if (/[?&](?:w|width|h|height)=(?:0|1|2|3|4|5|6|7|8|9|10)(?:&|$)/i.test(value)) {
    return "tiny image dimensions";
  }
  if (/(?:doubleclick|googletagmanager|google-analytics|facebook\.com\/tr|pixel)/i.test(lower)) {
    return "tracking domain";
  }
  return "";
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; INConnectBot/1.0; +https://in-connect.app)",
      },
      signal: controller.signal,
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function extractLinks(html: string, baseUrl: string) {
  const links: Array<{ text: string; url: string }> = [];
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1];
    const text = cleanText(match[2].replace(/<[^>]+>/g, " "));
    try {
      const url = new URL(href, baseUrl).toString();
      if (text && url.startsWith("http")) links.push({ text, url });
    } catch {
      // Ignore malformed links.
    }
  }
  return Array.from(new Map(links.map((link) => [link.url, link])).values());
}

function extractMeta(html: string, property: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : "";
}

function hasLidarSignal(value: string) {
  return /lidar|liDAR|3d sensing|laser scanning|perception sensor|autonomous sensing|digital lidar|fmcw|1550\s*nm|solid-state|flash lidar/i.test(value);
}

function inferLidarCategory(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("automotive") || lower.includes("vehicle")) return "Automotive LiDAR";
  if (lower.includes("robot")) return "Robotics";
  if (lower.includes("traffic") || lower.includes("infrastructure")) return "ITS / Smart Infrastructure";
  if (lower.includes("airport")) return "Airports";
  if (lower.includes("port")) return "Ports";
  if (lower.includes("warehouse")) return "Warehousing";
  if (lower.includes("mapping") || lower.includes("survey")) return "Mapping & Surveying";
  if (lower.includes("security") || lower.includes("perimeter")) return "Security / Perimeter";
  if (lower.includes("funding") || lower.includes("acquires") || lower.includes("merger")) return "Funding & M&A";
  if (lower.includes("partner")) return "Partnerships";
  if (lower.includes("launch") || lower.includes("unveil") || lower.includes("introduce")) return "New Products";
  return "Industrial LiDAR";
}

function isWeakUrl(url: string) {
  return /\/(?:about|contact|careers|privacy|terms|login|tag|category|search)(?:\/|$)|#|mailto:/i.test(url);
}

function createEmailExcerpt(article: MarketArticle) {
  return [article.excerpt, article.inconnectPerspective].filter(Boolean).join("\n\n").slice(0, 900);
}

function toAbsoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

function getDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function cleanText(value: string) {
  return decodeHtml(value).replace(/\s+/g, " ").trim().slice(0, 500);
}

function normalizeComparable(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function areTitlesSimilar(first: string, second: string) {
  const firstNormalized = normalizeComparable(first);
  const secondNormalized = normalizeComparable(second);
  if (!firstNormalized || !secondNormalized) return false;
  if (firstNormalized === secondNormalized) return true;
  if (firstNormalized.length > 20 && secondNormalized.includes(firstNormalized)) return true;
  if (secondNormalized.length > 20 && firstNormalized.includes(secondNormalized)) return true;

  const firstTokens = new Set(tokenizeTitle(firstNormalized));
  const secondTokens = new Set(tokenizeTitle(secondNormalized));
  if (firstTokens.size === 0 || secondTokens.size === 0) return false;

  const shared = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  const smaller = Math.min(firstTokens.size, secondTokens.size);
  return shared >= 4 && shared / smaller >= 0.65;
}

function tokenizeTitle(value: string) {
  const stopWords = new Set([
    "and",
    "for",
    "from",
    "into",
    "its",
    "new",
    "news",
    "press",
    "release",
    "the",
    "with",
  ]);
  return value.split(/\s+/).filter((token) => token.length > 2 && !stopWords.has(token));
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}
