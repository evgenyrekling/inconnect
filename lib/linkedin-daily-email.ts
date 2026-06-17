import crypto from "node:crypto";
import { sendLinkedInDailyEmail } from "@/lib/email/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { SITE_URL } from "@/lib/seo";

type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  hero_image_url: string | null;
  published_at: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  email: string;
  normalized_email?: string | null;
  unsubscribe_token: string | null;
};

export async function sendLatestLinkedInDailyEmail() {
  const supabase = getSupabaseAdminClient();
  const post = await getLatestLinkedInPost(supabase);
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, email, normalized_email, unsubscribe_token")
    .eq("digest_type", "linkedin_daily")
    .eq("is_active", true)
    .returns<SubscriptionRow[]>();

  if (error) throw new Error(error.message);

  const subscribers = data ?? [];
  let sent = 0;
  let failed = 0;
  let skippedDuplicates = 0;

  for (const subscription of subscribers) {
    const email = normalizeEmail(subscription.normalized_email || subscription.email);
    if (await hasSuccessfulDelivery(supabase, post.id, email)) {
      skippedDuplicates += 1;
      continue;
    }

    try {
      const unsubscribeToken =
        subscription.unsubscribe_token ||
        (await ensureUnsubscribeToken(supabase, subscription.id));
      const result = await sendLinkedInDailyEmail({
        briefingText: createLinkedInEmailText(post),
        heroImageUrl: toAbsoluteUrl(post.hero_image_url || "/hero-professionals-collage.png"),
        readUrl: `${SITE_URL}/intelligence/linkedin-daily/${post.slug}`,
        title: post.title,
        to: email,
        unsubscribeUrl: `${SITE_URL}/unsubscribe?token=${unsubscribeToken}`,
      });
      await logDelivery(supabase, {
        contentId: post.id,
        email,
        resendEmailId: result.id,
        status: "sent",
        subscriptionId: subscription.id,
      });
      sent += 1;
    } catch (sendError) {
      failed += 1;
      await logDelivery(supabase, {
        contentId: post.id,
        email,
        errorMessage: sendError instanceof Error ? sendError.message : String(sendError),
        status: "failed",
        subscriptionId: subscription.id,
      });
    }
  }

  return {
    contentId: post.id,
    failed,
    sent,
    skippedDuplicates,
    slug: post.slug,
    subscribers: subscribers.length,
    success: failed === 0,
    title: post.title,
  };
}

export async function sendLinkedInDailyTestEmail(to: string) {
  const supabase = getSupabaseAdminClient();
  const post = await getLatestLinkedInPost(supabase);
  const result = await sendLinkedInDailyEmail({
    briefingText: createLinkedInEmailText(post),
    heroImageUrl: toAbsoluteUrl(post.hero_image_url || "/hero-professionals-collage.png"),
    readUrl: `${SITE_URL}/intelligence/linkedin-daily/${post.slug}`,
    title: post.title,
    to: normalizeEmail(to),
  });
  return {
    ...result,
    post,
  };
}

async function getLatestLinkedInPost(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, content, hero_image_url, published_at, created_at")
    .eq("published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BlogPostRow>();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("No published LinkedIn Daily content found.");
  return data;
}

function createLinkedInEmailText(post: BlogPostRow) {
  return post.excerpt || stripMarkdown(post.content || "").slice(0, 700);
}

async function hasSuccessfulDelivery(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  contentId: string,
  email: string,
) {
  const { data, error } = await supabase
    .from("email_deliveries")
    .select("id")
    .eq("digest_type", "linkedin_daily")
    .eq("content_type", "linkedin_daily")
    .eq("content_id", contentId)
    .eq("email", normalizeEmail(email))
    .in("status", ["sent", "delivered", "opened", "clicked"])
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) return false;
  return Boolean(data);
}

async function logDelivery(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  values: {
    contentId: string;
    email: string;
    errorMessage?: string;
    resendEmailId?: string;
    status: string;
    subscriptionId: string;
  },
) {
  await supabase.from("email_deliveries").insert({
    briefing_id: values.contentId,
    content_id: values.contentId,
    content_type: "linkedin_daily",
    digest_type: "linkedin_daily",
    email: normalizeEmail(values.email),
    error_message: values.errorMessage ?? null,
    resend_email_id: values.resendEmailId ?? null,
    sent_at: new Date().toISOString(),
    status: values.status,
    subscription_id: values.subscriptionId,
  });
}

async function ensureUnsubscribeToken(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  subscriptionId: string,
) {
  const unsubscribeToken = crypto.randomBytes(32).toString("hex");
  const { error } = await supabase
    .from("subscriptions")
    .update({ unsubscribe_token: unsubscribeToken, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);
  if (error) throw new Error(error.message);
  return unsubscribeToken;
}

function toAbsoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function stripMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[#>*_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
