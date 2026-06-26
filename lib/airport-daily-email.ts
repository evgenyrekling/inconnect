import crypto from "node:crypto";
import { ResendEmailSendError, sendAirportDailyEmail } from "@/lib/email/resend";
import {
  getAirportDailyMissingSchemaField,
  isAirportDailyMissingSchemaError,
  validateAirportDailySchema,
} from "@/lib/airport-daily-schema";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { SITE_URL } from "@/lib/seo";

type AirportBriefingRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  hero_image_url: string | null;
  inconnect_view: string | null;
  auto_send_allowed?: boolean | null;
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
  skipped?: boolean;
  skipReason?: string;
  slug: string;
  subscribers: number;
  success: boolean;
  title: string;
};

export async function sendLatestAirportDailyEmail({
  briefingId,
  requireUnsent = true,
}: SendAirportDailyOptions = {}): Promise<AirportDailySendResult> {
  console.info("AIRPORT DAILY EMAIL START", {
    digest_type: "airport_automation_daily",
    requireUnsent,
  });
  const supabase = getSupabaseAdminClient();
  await validateAirportDailySchema(supabase, "send_airport_daily_email");
  validateAirportDailyEmailEnvironment();
  let briefingQuery = supabase
    .from("airport_briefings")
    .select(
      "id, slug, title, content, hero_image_url, summary, inconnect_view, source_url, auto_send_allowed, published, published_at, sent_at, generated_at, created_at",
    );

  if (briefingId) {
    briefingQuery = briefingQuery.eq("id", briefingId);
  } else {
    briefingQuery = briefingQuery
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("generated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data: briefing, error: briefingError } =
    await briefingQuery.maybeSingle<AirportBriefingRow>();

  if (briefingError) {
    if (isAirportDailyMissingSchemaError(briefingError)) {
      const missingField = getAirportDailyMissingSchemaField(briefingError);
      const skipReason = missingField
        ? `Airport Daily email skipped because schema field is missing: ${missingField}.`
        : "Airport Daily email skipped because airport_briefings schema is incomplete.";
      console.error("AIRPORT DAILY EMAIL SCHEMA MISMATCH", {
        error: briefingError,
        missingField,
        skipReason,
      });
      await logAirportEmailDeliveryDiagnostic(supabase, {
        errorMessage: skipReason,
        status: "skipped",
      });
      return createSkippedAirportDailySendResult(skipReason);
    }
    console.error("AIRPORT DAILY EMAIL BRIEFING LOOKUP ERROR", briefingError);
    throw new Error(briefingError.message || "Latest airport briefing could not be loaded.");
  }

  if (!briefing) {
    const skipReason = "No approved published airport briefing found for email delivery.";
    console.warn("AIRPORT DAILY EMAIL SKIP REASON", { skipReason });
    await logAirportEmailDeliveryDiagnostic(supabase, {
      errorMessage: skipReason,
      status: "skipped",
    });
    return createSkippedAirportDailySendResult(
      skipReason,
    );
  }

  console.info("AIRPORT BRIEFING FOUND", {
    briefing_id: briefing.id,
    slug: briefing.slug,
    title: briefing.title,
    auto_send_allowed: briefing.auto_send_allowed ?? null,
    published: briefing.published,
    sent_at: briefing.sent_at,
  });

  const briefingText = createEmailBriefingText(briefing).trim();
  const skipReason = getAirportEmailSkipReason({
    briefing,
    briefingText,
    requireUnsent,
  });
  if (skipReason) {
    console.warn("AIRPORT DAILY EMAIL SKIP REASON", {
      auto_send_allowed: briefing.auto_send_allowed ?? null,
      briefing_id: briefing.id,
      published: briefing.published,
      sent_at: briefing.sent_at,
      skipReason,
      slug: briefing.slug,
    });
    await logAirportEmailDeliveryDiagnostic(supabase, {
      briefingId: briefing.id,
      errorMessage: skipReason,
      status: "skipped",
    });
    return createSkippedAirportDailySendResult(skipReason, briefing);
  }

  if (!briefing.hero_image_url) {
    console.warn("AIRPORT DAILY EMAIL IMAGE MISSING", {
      briefing_id: briefing.id,
      fallbackImage: "/hero-professionals-collage.png",
      slug: briefing.slug,
    });
  }

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
  console.info("AIRPORT DAILY EMAIL SUBSCRIBERS LOADED", {
    digest_type: "airport_automation_daily",
  });
  console.info("AIRPORT DAILY EMAIL SUBSCRIBERS COUNT", {
    count: subscribers.length,
    digest_type: "airport_automation_daily",
  });
  if (process.env.NODE_ENV === "development") {
    console.info("AIRPORT DAILY EMAIL SUBSCRIBER EMAILS", {
      emails: subscribers.map((subscriber) =>
        normalizeEmail(subscriber.normalized_email || subscriber.email),
      ),
    });
  }

  if (subscribers.length === 0) {
    const noSubscribersReason = "No subscribers";
    console.warn("AIRPORT DAILY EMAIL SKIP REASON", {
      briefing_id: briefing.id,
      skipReason: noSubscribersReason,
      slug: briefing.slug,
    });
    await logAirportEmailDeliveryDiagnostic(supabase, {
      briefingId: briefing.id,
      errorMessage: noSubscribersReason,
      status: "skipped",
    });
    return createSkippedAirportDailySendResult(noSubscribersReason, briefing);
  }

  const readUrl = `${SITE_URL}/intelligence/airport-automation/${briefing.slug}`;
  const heroImageUrl = toAbsoluteUrl(briefing.hero_image_url || "/hero-professionals-collage.png");
  const results: AirportDailySendResult["results"] = [];
  let skippedDuplicates = 0;

  for (const subscription of subscribers) {
    const recipientEmail = normalizeEmail(subscription.normalized_email || subscription.email);
    if (!recipientEmail) {
      const errorMessage = "Subscriber email is empty.";
      console.error("AIRPORT EMAIL SEND FAILURE", {
        briefing_id: briefing.id,
        email: subscription.email,
        error: errorMessage,
        subscriptionId: subscription.id,
      });
      await logAirportEmailDeliveryDiagnostic(supabase, {
        briefingId: briefing.id,
        errorMessage,
        recipientEmail: subscription.email,
        status: "failed",
      });
      results.push({
        email: subscription.email,
        error: errorMessage,
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
      const duplicateReason = "Already sent today";
      console.info("AIRPORT EMAIL SEND SKIPPED DUPLICATE", {
        briefing_id: briefing.id,
        digest_type: "airport_automation_daily",
        reason: duplicateReason,
        recipient: recipientEmail,
      });
      await logAirportEmailDeliveryDiagnostic(supabase, {
        briefingId: briefing.id,
        errorMessage: duplicateReason,
        recipientEmail,
        status: "skipped",
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
        briefingText,
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
      await logAirportEmailDeliveryDiagnostic(supabase, {
        briefingId: briefing.id,
        providerMessageId: resendResult.id,
        recipientEmail,
        status: "sent",
      });

      console.info("AIRPORT EMAIL SEND SUCCESS", {
        briefing_id: briefing.id,
        provider: resendResult.provider,
        providerResponse: resendResult.providerResponse,
        recipient: recipientEmail,
        resendMessageId: resendResult.id,
        status: resendResult.status,
      });

      results.push({ email: recipientEmail, status: "sent" });
    } catch (sendError) {
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      const providerDetails = getResendProviderErrorDetails(sendError);
      console.error("AIRPORT EMAIL SEND FAILURE", {
        briefing_id: briefing.id,
        digest_type: "airport_automation_daily",
        email: recipientEmail,
        error: errorMessage,
        ...providerDetails,
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
      await logAirportEmailDeliveryDiagnostic(supabase, {
        briefingId: briefing.id,
        errorMessage: formatAirportEmailErrorMessage(errorMessage, providerDetails),
        recipientEmail,
        status: "failed",
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
  console.info("AIRPORT DAILY EMAIL START", {
    digest_type: "airport_automation_daily",
    recipient: normalizeEmail(to),
    test: true,
  });
  validateAirportDailyEmailEnvironment();
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("airport_briefings")
    .select(
      "id, slug, title, content, hero_image_url, summary, inconnect_view, source_url, auto_send_allowed, published, published_at, sent_at, generated_at, created_at",
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

  const briefingText = createEmailBriefingText(briefing).trim();
  if (!briefing.title?.trim()) {
    throw new Error("Missing title");
  }
  if (!briefingText) {
    throw new Error("Missing summary/content");
  }
  if (!briefing.hero_image_url) {
    console.warn("AIRPORT DAILY EMAIL IMAGE MISSING", {
      briefing_id: briefing.id,
      fallbackImage: "/hero-professionals-collage.png",
      slug: briefing.slug,
      test: true,
    });
  }

  console.info("AIRPORT EMAIL SEND START", {
    briefing_id: briefing.id,
    digest_type: "airport_automation_daily",
    recipient: normalizeEmail(to),
    slug: briefing.slug,
    test: true,
  });

  try {
    const result = await sendAirportDailyEmail({
      briefingText,
      heroImageUrl: toAbsoluteUrl(briefing.hero_image_url || "/hero-professionals-collage.png"),
      readUrl: `${SITE_URL}/intelligence/airport-automation/${briefing.slug}`,
      sourceUrl: briefing.source_url ?? undefined,
      title: briefing.title,
      to: normalizeEmail(to),
    });

    await logAirportEmailDeliveryDiagnostic(supabase, {
      briefingId: briefing.id,
      providerMessageId: result.id,
      recipientEmail: normalizeEmail(to),
      status: "sent",
    });

    console.info("AIRPORT EMAIL SEND SUCCESS", {
      briefing_id: briefing.id,
      provider: result.provider,
      providerResponse: result.providerResponse,
      recipient: normalizeEmail(to),
      resendMessageId: result.id,
      status: result.status,
      test: true,
    });

    return {
      ...result,
      briefing,
    };
  } catch (sendError) {
    const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
    const providerDetails = getResendProviderErrorDetails(sendError);
    console.error("AIRPORT EMAIL SEND FAILURE", {
      briefing_id: briefing.id,
      email: normalizeEmail(to),
      error: errorMessage,
      ...providerDetails,
      test: true,
    });
    await logAirportEmailDeliveryDiagnostic(supabase, {
      briefingId: briefing.id,
      errorMessage: formatAirportEmailErrorMessage(errorMessage, providerDetails),
      recipientEmail: normalizeEmail(to),
      status: "failed",
    });
    throw sendError;
  }
}

function createSkippedAirportDailySendResult(
  skipReason: string,
  briefing?: AirportBriefingRow,
): AirportDailySendResult {
  console.warn("AIRPORT DAILY EMAIL SKIPPED", { skipReason });
  return {
    briefingId: briefing?.id ?? "",
    failed: 0,
    results: [],
    sent: 0,
    skipped: true,
    skippedDuplicates: 0,
    skipReason,
    slug: briefing?.slug ?? "",
    subscribers: 0,
    success: true,
    title: briefing?.title ?? "Airport Daily email skipped",
  };
}

function getAirportEmailSkipReason({
  briefing,
  briefingText,
  requireUnsent,
}: {
  briefing: AirportBriefingRow;
  briefingText: string;
  requireUnsent: boolean;
}) {
  if (!briefing.published) return "Article marked draft";
  if (briefing.auto_send_allowed === false) return "auto_send_allowed = false";
  if (!briefing.title?.trim()) return "Missing title";
  if (!briefingText) return "Missing summary/content";
  if (requireUnsent && briefing.sent_at) return "Already sent today";
  return "";
}

async function logAirportEmailDeliveryDiagnostic(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  values: {
    briefingId?: string | null;
    errorMessage?: string | null;
    providerMessageId?: string | null;
    recipientEmail?: string | null;
    status: string;
  },
) {
  const { error } = await supabase.from("airport_email_delivery_log").insert({
    briefing_id: values.briefingId ?? null,
    error_message: values.errorMessage ?? null,
    provider: "resend",
    provider_message_id: values.providerMessageId ?? null,
    recipient_email: values.recipientEmail ? normalizeEmail(values.recipientEmail) : null,
    sent_at: new Date().toISOString(),
    status: values.status,
  });

  if (error) {
    console.error("AIRPORT EMAIL DELIVERY DIAGNOSTIC LOG ERROR", {
      error,
      status: values.status,
    });
  }
}

function getResendProviderErrorDetails(error: unknown) {
  if (error instanceof ResendEmailSendError) {
    return {
      httpStatus: error.httpStatus,
      provider: error.provider,
      providerCode: error.providerCode,
      providerResponse: error.providerResponse,
      recipient: error.recipient,
    };
  }

  return {};
}

function formatAirportEmailErrorMessage(
  errorMessage: string,
  providerDetails: ReturnType<typeof getResendProviderErrorDetails>,
) {
  const status =
    "httpStatus" in providerDetails && providerDetails.httpStatus
      ? `HTTP ${providerDetails.httpStatus}`
      : "";
  const code =
    "providerCode" in providerDetails && providerDetails.providerCode
      ? providerDetails.providerCode
      : "";
  return [errorMessage, status, code].filter(Boolean).join(" | ");
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
