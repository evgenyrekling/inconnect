import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { sendAirportDailyEmail } from "@/lib/email/resend";
import { generateAndStoreAirportBriefing } from "@/lib/airport-briefing-generator";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AirportBriefingRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  hero_image_url: string | null;
  published: boolean | null;
  published_at: string | null;
  generated_at: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  email: string;
  digest_type: string;
  is_active: boolean | null;
  unsubscribe_token: string | null;
};

export async function GET(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

  console.info("INConnect airport daily email cron started");

  try {
    const supabase = getSupabaseAdminClient();
    let generatedBriefingId = "";

    try {
      const generationResult = await generateAndStoreAirportBriefing({
        source: "cron",
      });
      generatedBriefingId = generationResult.briefing.id;
      console.info("INConnect airport daily email generated briefing", {
        briefingId: generatedBriefingId,
        slug: generationResult.briefing.slug,
      });
    } catch (generationError) {
      console.error("AIRPORT DAILY EMAIL GENERATION ERROR", {
        error: generationError instanceof Error ? generationError.message : String(generationError),
      });
      return NextResponse.json(
        {
          error: "Airport briefing could not be generated.",
          stage: "briefing_generation",
          details:
            generationError instanceof Error ? generationError.message : String(generationError),
        },
        { status: 500 },
      );
    }

    const { data: briefing, error: briefingError } = await supabase
      .from("airport_briefings")
      .select("id, slug, title, content, hero_image_url, published, published_at, generated_at, created_at")
      .eq("published", true)
      .eq("id", generatedBriefingId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("generated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<AirportBriefingRow>();

    if (briefingError) {
      console.error("AIRPORT DAILY EMAIL BRIEFING LOOKUP ERROR", briefingError);
      return NextResponse.json(
        { error: "Latest airport briefing could not be loaded.", stage: "briefing_lookup" },
        { status: 500 },
      );
    }

    if (!briefing) {
      return NextResponse.json(
        { error: "No published airport briefing found.", stage: "briefing_lookup" },
        { status: 404 },
      );
    }

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("subscriptions")
      .select("id, email, digest_type, is_active, unsubscribe_token")
      .eq("digest_type", "airport_automation_daily")
      .eq("is_active", true)
      .returns<SubscriptionRow[]>();

    if (subscriptionsError) {
      console.error("AIRPORT DAILY EMAIL SUBSCRIBER LOOKUP ERROR", subscriptionsError);
      return NextResponse.json(
        { error: "Airport subscribers could not be loaded.", stage: "subscriber_lookup" },
        { status: 500 },
      );
    }

    const subscribers = subscriptions ?? [];
    const readUrl = `${SITE_URL}/intelligence/airport-automation/${briefing.slug}`;
    const heroImageUrl = toAbsoluteUrl(briefing.hero_image_url || "/hero-professionals-collage.png");
    const results = [];

    for (const subscription of subscribers) {
      const unsubscribeToken =
        subscription.unsubscribe_token ||
        (await ensureUnsubscribeToken(supabase, subscription.id));
      const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${unsubscribeToken}`;

      try {
        const resendResult = await sendAirportDailyEmail({
          briefingText: briefing.content,
          heroImageUrl,
          readUrl,
          title: briefing.title,
          to: subscription.email,
          unsubscribeUrl,
        });

        await logEmailDelivery(supabase, {
          briefingId: briefing.id,
          digestType: "airport_automation_daily",
          email: subscription.email,
          resendEmailId: resendResult.id,
          status: "sent",
          subscriptionId: subscription.id,
        });

        results.push({ email: subscription.email, status: "sent" });
      } catch (sendError) {
        const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
        console.error("AIRPORT DAILY EMAIL SEND ERROR", {
          email: subscription.email,
          error: errorMessage,
          subscriptionId: subscription.id,
        });

        await logEmailDelivery(supabase, {
          briefingId: briefing.id,
          digestType: "airport_automation_daily",
          email: subscription.email,
          errorMessage,
          status: "failed",
          subscriptionId: subscription.id,
        });

        results.push({ email: subscription.email, error: errorMessage, status: "failed" });
      }
    }

    const sent = results.filter((result) => result.status === "sent").length;
    const failed = results.length - sent;
    console.info("INConnect airport daily email cron finished", {
      briefingId: briefing.id,
      failed,
      sent,
      subscribers: subscribers.length,
    });

    return NextResponse.json({
      briefingId: briefing.id,
      failed,
      sent,
      subscribers: subscribers.length,
      success: failed === 0,
      title: briefing.title,
    });
  } catch (error) {
    console.error("AIRPORT DAILY EMAIL CRON FAILED", error);
    return NextResponse.json(
      {
        error: "Airport daily email cron failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
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
    digest_type: values.digestType,
    email: values.email,
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

function validateCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;

  const authorization = request.headers.get("authorization") ?? "";
  if (authorization === `Bearer ${secret}`) return null;

  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

function toAbsoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}
