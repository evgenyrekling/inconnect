import { NextRequest, NextResponse } from "next/server";
import { sendAirportDailyTestEmail } from "@/lib/airport-daily-email";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeliveryLogRow = {
  id: string;
  briefing_id: string | null;
  recipient_email: string | null;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
};

type AirportBriefingSummaryRow = {
  id: string;
  slug: string;
  title: string;
};

type SubscriptionRow = {
  id: string;
  email: string;
  normalized_email: string | null;
};

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email") ?? "";
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const [deliveryResult, subscriberResult] = await Promise.all([
      supabase
        .from("airport_email_delivery_log")
        .select(
          "id, briefing_id, recipient_email, status, provider, provider_message_id, error_message, sent_at",
        )
        .order("sent_at", { ascending: false })
        .limit(150)
        .returns<DeliveryLogRow[]>(),
      supabase
        .from("subscriptions")
        .select("id, email, normalized_email")
        .eq("digest_type", "airport_automation_daily")
        .eq("is_active", true)
        .order("email", { ascending: true })
        .returns<SubscriptionRow[]>(),
    ]);

    if (deliveryResult.error) {
      console.error("ADMIN AIRPORT EMAIL DELIVERY LOG ERROR", deliveryResult.error);
      return NextResponse.json(
        {
          details: deliveryResult.error.message,
          error: "Airport email delivery log could not be loaded.",
        },
        { status: 500 },
      );
    }

    if (subscriberResult.error) {
      console.error("ADMIN AIRPORT EMAIL SUBSCRIBERS ERROR", subscriberResult.error);
      return NextResponse.json(
        {
          details: subscriberResult.error.message,
          error: "Airport Daily subscribers could not be loaded.",
        },
        { status: 500 },
      );
    }

    const deliveryRows = deliveryResult.data ?? [];
    const briefingIds = Array.from(
      new Set(deliveryRows.map((row) => row.briefing_id).filter(Boolean) as string[]),
    );
    const briefingMap = await loadBriefingMap(briefingIds);

    return NextResponse.json({
      deliveries: deliveryRows.map((row) => {
        const briefing = row.briefing_id ? briefingMap.get(row.briefing_id) : null;
        return {
          articleSlug: briefing?.slug ?? "",
          articleTitle: briefing?.title ?? "",
          briefingId: row.briefing_id,
          date: row.sent_at,
          error: row.error_message,
          id: row.id,
          provider: row.provider ?? "resend",
          providerMessageId: row.provider_message_id,
          recipient: row.recipient_email,
          status: row.status,
        };
      }),
      subscribers: (subscriberResult.data ?? []).map((subscriber) => ({
        email: normalizeEmail(subscriber.normalized_email || subscriber.email),
        id: subscriber.id,
      })),
    });
  } catch (error) {
    console.error("ADMIN AIRPORT EMAIL DELIVERY FAILED", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Airport email delivery data could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | {
        briefingId?: string;
        email?: string;
        recipientEmail?: string;
      }
    | null;

  if (!isAdminEmail(payload?.email ?? "")) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const recipientEmail = normalizeEmail(payload?.recipientEmail ?? "");
  if (!recipientEmail) {
    return NextResponse.json({ error: "Recipient email is required." }, { status: 400 });
  }

  try {
    const subscriber = await findActiveAirportSubscriber(recipientEmail);
    if (!subscriber) {
      return NextResponse.json(
        { error: "Selected recipient is not an active Airport Automation Daily subscriber." },
        { status: 400 },
      );
    }

    console.info("ADMIN AIRPORT DAILY MANUAL RESEND START", {
      recipient: recipientEmail,
    });

    const result = await sendAirportDailyTestEmail({
      briefingId: payload?.briefingId,
      to: recipientEmail,
    });

    console.info("ADMIN AIRPORT DAILY MANUAL RESEND COMPLETE", {
      recipient: recipientEmail,
      resendMessageId: result.id,
      slug: result.briefing.slug,
    });

    return NextResponse.json({
      recipient: recipientEmail,
      resendMessageId: result.id,
      slug: result.briefing.slug,
      success: true,
      title: result.briefing.title,
    });
  } catch (error) {
    console.error("ADMIN AIRPORT DAILY MANUAL RESEND FAILED", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Airport Daily resend failed.",
      },
      { status: 500 },
    );
  }
}

async function loadBriefingMap(briefingIds: string[]) {
  const briefingMap = new Map<string, AirportBriefingSummaryRow>();
  if (briefingIds.length === 0) return briefingMap;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("airport_briefings")
    .select("id, slug, title")
    .in("id", briefingIds)
    .returns<AirportBriefingSummaryRow[]>();

  if (error) {
    console.error("ADMIN AIRPORT EMAIL BRIEFING SUMMARY ERROR", error);
    return briefingMap;
  }

  for (const briefing of data ?? []) {
    briefingMap.set(briefing.id, briefing);
  }
  return briefingMap;
}

async function findActiveAirportSubscriber(email: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, email, normalized_email")
    .eq("digest_type", "airport_automation_daily")
    .eq("is_active", true)
    .returns<SubscriptionRow[]>();

  if (error) throw new Error(error.message);

  return (data ?? []).find(
    (subscriber) => normalizeEmail(subscriber.normalized_email || subscriber.email) === email,
  );
}

function isAdminEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  return getAdminEmails().includes(normalizedEmail);
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}
