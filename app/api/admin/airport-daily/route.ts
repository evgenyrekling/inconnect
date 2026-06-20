import { NextRequest, NextResponse } from "next/server";
import {
  AirportBriefingGenerationError,
  generateAndStoreAirportBriefing,
} from "@/lib/airport-briefing-generator";
import {
  sendAirportDailyTestEmail,
  sendLatestAirportDailyEmail,
} from "@/lib/airport-daily-email";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AirportBriefingAdminRow = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  excerpt: string;
  hero_image_url: string | null;
  source_name: string | null;
  source_url: string | null;
  source_domain: string | null;
  source_image_url: string | null;
  image_attribution: string | null;
  summary: string | null;
  inconnect_view: string | null;
  quality_score: number | null;
  status: string | null;
  is_draft_candidate: boolean | null;
  auto_send_allowed: boolean | null;
  quality_rejection_reason: string | null;
  source_url_type: string | null;
  published: boolean | null;
  sent_at: string | null;
  published_at: string | null;
  generated_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const adminError = requireAdmin(request.nextUrl.searchParams.get("email") ?? "");
  if (adminError) return adminError;

  try {
    const supabase = getSupabaseAdminClient();
    const [latestResult, countResult] = await Promise.all([
      supabase
        .from("airport_briefings")
        .select(
          "id, slug, title, category, excerpt, hero_image_url, source_name, source_url, source_domain, source_image_url, image_attribution, summary, inconnect_view, quality_score, status, is_draft_candidate, auto_send_allowed, quality_rejection_reason, source_url_type, published, sent_at, published_at, generated_at, created_at",
        )
        .or("status.is.null,status.neq.rejected")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("generated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<AirportBriefingAdminRow>(),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("digest_type", "airport_automation_daily")
        .eq("is_active", true),
    ]);

    if (latestResult.error) {
      console.error("ADMIN AIRPORT DAILY LATEST LOOKUP ERROR", latestResult.error);
      throw new Error(latestResult.error.message);
    }

    if (countResult.error) {
      console.error("ADMIN AIRPORT DAILY SUBSCRIBER COUNT ERROR", countResult.error);
      throw new Error(countResult.error.message);
    }

    return NextResponse.json({
      latestBriefing: latestResult.data,
      subscriberCount: countResult.count ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Airport Daily admin data could not be loaded.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | {
        action?: string;
        briefingId?: string;
        email?: string;
      }
    | null;
  const adminError = requireAdmin(payload?.email ?? "");
  if (adminError) return adminError;

  try {
    const supabase = getSupabaseAdminClient();

    if (payload?.action === "generate") {
      const result = await generateAndStoreAirportBriefing({ source: "admin-manual" });
      return NextResponse.json({
        briefingId: result.briefing.id,
        slug: result.briefing.slug,
        success: true,
        title: result.briefing.title,
      });
    }

    if (payload?.action === "send_test") {
      const result = await sendAirportDailyTestEmail({
        briefingId: payload.briefingId,
        to: normalizeEmail(payload.email ?? ""),
      });
      return NextResponse.json({ emailId: result.id, success: true });
    }

    if (payload?.action === "send_subscribers") {
      const result = await sendLatestAirportDailyEmail({
        briefingId: payload.briefingId,
        requireUnsent: false,
      });
      return NextResponse.json(result);
    }

    if (payload?.action === "approve_send") {
      if (!payload.briefingId) {
        return NextResponse.json({ error: "briefingId is required." }, { status: 400 });
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("airport_briefings")
        .update({
          auto_send_allowed: true,
          is_draft_candidate: false,
          published: true,
          published_at: now,
          quality_rejection_reason: null,
          status: "published",
        })
        .eq("id", payload.briefingId);
      if (error) throw new Error(error.message);

      const result = await sendLatestAirportDailyEmail({
        briefingId: payload.briefingId,
        requireUnsent: false,
      });
      return NextResponse.json({
        ...result,
        approved: true,
      });
    }

    if (payload?.action === "reject") {
      if (!payload.briefingId) {
        return NextResponse.json({ error: "briefingId is required." }, { status: 400 });
      }
      const { error } = await supabase
        .from("airport_briefings")
        .update({
          auto_send_allowed: false,
          is_draft_candidate: false,
          published: false,
          quality_rejection_reason: "Rejected by admin review.",
          status: "rejected",
        })
        .eq("id", payload.briefingId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (payload?.action === "mark_sent") {
      if (!payload.briefingId) {
        return NextResponse.json({ error: "briefingId is required." }, { status: 400 });
      }
      const { error } = await supabase
        .from("airport_briefings")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", payload.briefingId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (payload?.action === "delete") {
      if (!payload.briefingId) {
        return NextResponse.json({ error: "briefingId is required." }, { status: 400 });
      }
      const { error } = await supabase
        .from("airport_briefings")
        .delete()
        .eq("id", payload.briefingId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported admin action." }, { status: 400 });
  } catch (error) {
    console.error("ADMIN AIRPORT DAILY ACTION ERROR", error);
    return NextResponse.json(
      {
        error:
          error instanceof AirportBriefingGenerationError
            ? error.message
            : "Airport Daily admin action failed.",
        stage:
          error instanceof AirportBriefingGenerationError ? error.stage : "admin_action",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function requireAdmin(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !getAdminEmails().includes(normalizedEmail)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  return null;
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}
