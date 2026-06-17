import crypto from "node:crypto";
import { sendAirportDailyEmail } from "@/lib/email/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { SITE_URL } from "@/lib/seo";

type AirportBriefingRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  hero_image_url: string | null;
  inconnect_view: string | null;
  published: boolean | null;
  published_at: string | null;
  sent_at: string | null;
  source_url: string | null;
  summary: string | null;
  generated_at: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  email: string;
  digest_type: string;
  is_active: boolean | null;
  normalized_email?: string | null;
  unsubscribe_token: string | null;
};

type SendAirportDailyOptions = {
  briefingId?: string;
  requireUnsent?: boolean;
};

export type AirportDailySendResult = {
  briefingId: string;
  failed: number;
  results: Array<{ email: string; error?: string; status: "failed" | "sent" }>;
  sent: number;
  skippedDuplicates: number;
  slug: string;
  subscribers: number;
  success: boolean;
  title: string;
};

export async function sendLatestAirportDailyEmail({
  briefingId,
  requireUnsent = true,
}: SendAirportDailyOptions = {}): Promise<AirportDailySendResult> {
  console.info("AIRPORT DAILY START", {
    digest_type: "airport_automation_daily",
    requireUnsent,
  });
  validateAirportDailyEmailEnvironment();

  const supabase = getSupabaseAdminClient();
  let briefingQuery = supabase
    .from("airport_briefings")
    .select(
      "id, slug, title, content, hero_image_url, summary, inconnect_view, source_url, published, published_at, sent_at, generated_at, created_at",
    )
    .eq("published", true);

  if (briefingId) {
    briefingQuery = briefingQuery.eq("id", briefingId);
  } else {
    if (requireUnsent) briefingQuery = briefingQuery.is("sent_at", null);
    briefingQuery = briefingQuery
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("generated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data: briefing, error: briefingError } =
    await briefingQuery.maybeSingle<AirportBriefingRow>();

  if (briefingError) {
    console.error("AIRPORT DAILY EMAIL BRIEFING LOOKUP ERROR", briefingError);
    throw new Error(briefingError.message || "Latest airport briefing could not be loaded.");
  }

  if (!briefing) {
    throw new Error("No published airport briefing found for email delivery.");
  }

  console.info("AIRPORT BRIEFING FOUND", {
    briefing_id: briefing.id,
    slug: briefing.slug,
    title: briefing.title,
  });

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("subscriptions")
    .select("id, email, normalized_email, digest_type, is_active, unsubscribe_token")
    .eq("digest_type", "airport_automation_daily")
    .eq("is_active", true)
    .returns<SubscriptionRow[]>();

  if (subscriptionsError) {
    console.error("AIRPORT DAILY EMAIL SUBSCRIBER LOOKUP ERROR", subscriptionsError);
    throw new Error(subscriptionsError.message || "Airport subscribers could not be loaded.");
  }

  const subscribers = subscriptions ?? [];
  console.info("AIRPORT SUBSCRIBERS FOUND", {
    digest_type: "airport_automation_daily",
    subscriber_count: subscribers.length,
  });

  const readUrl = `${SITE_URL}/intelligence/airport-automation/${briefing.slug}`;
  const heroImageUrl = toAbsoluteUrl(briefing.hero_image_url || "/hero-professionals-collage.png");
  const results: AirportDailySendResult["results"] = [];
  let skippedDuplicates = 0;

  for (const subscription of subscribers) {
    const recipientEmail = normalizeEmail(subscription.normalized_email || subscription.email);
    if (!recipientEmail) {
      results.push({
        email: subscription.email,
        error: "Subscriber email is empty.",
        status: "failed",
      });
      continue;
    }

    const alreadySent = await hasSuccessfulAirportDelivery(supabase, {
      briefingId: briefing.id,
      email: recipientEmail,
    });
    if (alreadySent) {
      skippedDuplicates += 1;
      console.info("AIRPORT EMAIL SEND SKIPPED DUPLICATE", {
        briefing_id: briefing.id,
        digest_type: "airport_automation_daily",
        recipient: recipientEmail,
      });
      continue;
    }

    const unsubscribeToken =
      subscription.unsubscribe_token ||
      (await ensureUnsubscribeToken(supabase, subscription.id));
    const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${unsubscribeToken}`;

    try {
      console.info("AIRPORT EMAIL SEND START", {
        briefing_id: briefing.id,
        digest_type: "airport_automation_daily",
        recipient: recipientEmail,
        slug: briefing.slug,
      });

      const resendResult = await sendAirportDailyEmail({
        briefingText: createEmailBriefingText(briefing),
        heroImageUrl,
        readUrl,
        sourceUrl: briefing.source_url ?? undefined,
        title: briefing.title,
        to: recipientEmail,
        unsubscribeUrl,
      });

      await logEmailDelivery(supabase, {
        briefingId: briefing.id,
        digestType: "airport_automation_daily",
        email: recipientEmail,
        resendEmailId: resendResult.id,
        status: "sent",
        subscriptionId: subscription.id,
      });

      console.info("AIRPORT EMAIL SEND SUCCESS", {
        briefing_id: briefing.id,
        recipient: recipientEmail,
        resendMessageId: resendResult.id,
      });

      results.push({ email: recipientEmail, status: "sent" });
    } catch (sendError) {
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      console.error("AIRPORT EMAIL SEND FAILURE", {
        briefing_id: briefing.id,
        digest_type: "airport_automation_daily",
        email: recipientEmail,
        error: errorMessage,
        subscriptionId: subscription.id,
      });

      await logEmailDelivery(supabase, {
        briefingId: briefing.id,
        digestType: "airport_automation_daily",
        email: recipientEmail,
        errorMessage,
        status: "failed",
        subscriptionId: subscription.id,
      });

      results.push({ email: recipientEmail, error: errorMessage, status: "failed" });
    }
  }

  const sent = results.filter((result) => result.status === "sent").length;
  const failed = results.length - sent;

  if ((sent > 0 || skippedDuplicates === subscribers.length) && failed === 0) {
    const { error: sentAtError } = await supabase
      .from("airport_briefings")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", briefing.id);
    if (sentAtError) {
      console.error("AIRPORT DAILY SENT_AT UPDATE ERROR", sentAtError);
    }
  }

  const result = {
    briefingId: briefing.id,
    failed,
    results,
    sent,
    skippedDuplicates,
    slug: briefing.slug,
    subscribers: subscribers.length,
    success: failed === 0,
    title: briefing.title,
  };
  console.info("AIRPORT DAILY COMPLETE", {
    briefing_id: result.briefingId,
    failed: result.failed,
    sent: result.sent,
    skippedDuplicates: result.skippedDuplicates,
    slug: result.slug,
    subscriber_count: result.subscribers,
  });
  return result;
}

export async function sendAirportDailyTestEmail({
  briefingId,
  to,
}: {
  briefingId?: string;
  to: string;
}) {
  validateAirportDailyEmailEnvironment();
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("airport_briefings")
    .select(
      "id, slug, title, content, hero_image_url, summary, inconnect_view, source_url, published, published_at, sent_at, generated_at, created_at",
    )
    .eq("published", true);

  if (briefingId) {
    query = query.eq("id", briefingId);
  } else {
    query = query
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("generated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data: briefing, error } = await query.maybeSingle<AirportBriefingRow>();
  if (error) throw new Error(error.message);
  if (!briefing) throw new Error("No published airport briefing found for test email.");

  console.info("AIRPORT EMAIL SEND START", {
    briefing_id: briefing.id,
    digest_type: "airport_automation_daily",
    recipient: normalizeEmail(to),
    slug: briefing.slug,
    test: true,
  });

  const result = await sendAirportDailyEmail({
    briefingText: createEmailBriefingText(briefing),
    heroImageUrl: toAbsoluteUrl(briefing.hero_image_url || "/hero-professionals-collage.png"),
    readUrl: `${SITE_URL}/intelligence/airport-automation/${briefing.slug}`,
    sourceUrl: briefing.source_url ?? undefined,
    title: briefing.title,
    to: normalizeEmail(to),
  });

  console.info("AIRPORT EMAIL SEND SUCCESS", {
    briefing_id: briefing.id,
    recipient: normalizeEmail(to),
    resendMessageId: result.id,
    test: true,
  });

  return {
    ...result,
    briefing,
  };
}

async function logEmailDelivery(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  values: {
    briefingId: string;
    digestType: string;
    email: string;
    errorMessage?: string;
    resendEmailId?: string;
    status: string;
    subscriptionId: string;
  },
) {
  const { error } = await supabase.from("email_deliveries").insert({
    briefing_id: values.briefingId,
    content_id: values.briefingId,
    content_type: "airport_automation_daily",
    digest_type: values.digestType,
    email: normalizeEmail(values.email),
    error_message: values.errorMessage ?? null,
    resend_email_id: values.resendEmailId ?? null,
    sent_at: new Date().toISOString(),
    status: values.status,
    subscription_id: values.subscriptionId,
  });

  if (error) {
    console.error("EMAIL DELIVERY LOG ERROR", {
      email: values.email,
      error,
      status: values.status,
      subscriptionId: values.subscriptionId,
    });
  }
}

async function hasSuccessfulAirportDelivery(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  values: {
    briefingId: string;
    email: string;
  },
) {
  const { data, error } = await supabase
    .from("email_deliveries")
    .select("id")
    .eq("digest_type", "airport_automation_daily")
    .eq("content_type", "airport_automation_daily")
    .eq("content_id", values.briefingId)
    .eq("email", normalizeEmail(values.email))
    .in("status", ["sent", "delivered", "opened", "clicked"])
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    if ((error as { code?: string }).code === "42703") {
      console.warn("AIRPORT DAILY DUPLICATE CHECK SKIPPED", {
        reason: "email_deliveries content columns are missing",
      });
      return false;
    }
    console.error("AIRPORT DAILY DUPLICATE CHECK ERROR", {
      briefing_id: values.briefingId,
      email: normalizeEmail(values.email),
      error,
    });
    return false;
  }

  return Boolean(data);
}

function createEmailBriefingText(briefing: AirportBriefingRow) {
  if (briefing.summary || briefing.inconnect_view) {
    return [briefing.summary, briefing.inconnect_view].filter(Boolean).join("\n\n");
  }
  return briefing.content;
}

async function ensureUnsubscribeToken(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  subscriptionId: string,
) {
  const unsubscribeToken = crypto.randomBytes(32).toString("hex");
  const { error } = await supabase
    .from("subscriptions")
    .update({
      unsubscribe_token: unsubscribeToken,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) {
    console.error("SUBSCRIPTION UNSUBSCRIBE TOKEN UPDATE ERROR", {
      error,
      subscriptionId,
    });
    throw error;
  }

  return unsubscribeToken;
}

function toAbsoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function validateAirportDailyEmailEnvironment() {
  const hasResendKey = Boolean(process.env.RESEND_API_KEY);
  const emailFrom = process.env.EMAIL_FROM || "daily@in-connect.app";
  const emailReplyTo = process.env.EMAIL_REPLY_TO || "evgeny.rekling@gmail.com";

  console.info("AIRPORT DAILY EMAIL ENVIRONMENT", {
    emailFrom,
    emailReplyTo,
    hasResendKey,
  });

  if (!hasResendKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
}
