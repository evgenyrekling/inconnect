import { NextRequest, NextResponse } from "next/server";
import { checkAirportDailySources } from "@/lib/airport-briefing-generator";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AirportDailySourcePayload = {
  action?: string;
  airportSource?: Partial<AirportDailySourceRow>;
  email?: string;
  sourceId?: string;
};

type AirportDailySourceRow = {
  id: string;
  source_name: string;
  source_url: string;
  source_type: string | null;
  category: string | null;
  priority: string | null;
  is_active: boolean | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_successful_story_title: string | null;
  last_successful_story_url: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function GET(request: NextRequest) {
  const adminError = requireAdmin(request.nextUrl.searchParams.get("email") ?? "");
  if (adminError) return adminError;

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("airport_daily_sources")
      .select(
        "id, source_name, source_url, source_type, category, priority, is_active, last_checked_at, last_success_at, last_successful_story_title, last_successful_story_url, notes, created_at, updated_at",
      )
      .order("is_active", { ascending: false })
      .order("priority", { ascending: true })
      .order("source_name", { ascending: true })
      .returns<AirportDailySourceRow[]>();

    if (error) {
      console.error("ADMIN AIRPORT SOURCES LIST ERROR", error);
      return NextResponse.json(
        { error: "Airport sources could not be loaded.", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ sources: data ?? [] });
  } catch (error) {
    console.error("ADMIN AIRPORT SOURCES LIST FAILED", error);
    return NextResponse.json(
      {
        error: "Airport sources could not be loaded.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as AirportDailySourcePayload | null;
  const adminError = requireAdmin(payload?.email ?? "");
  if (adminError) return adminError;

  try {
    const supabase = getSupabaseAdminClient();
    const action = payload?.action ?? "";

    if (action === "check_all") {
      const result = await checkAirportDailySources();
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "test") {
      if (!payload?.sourceId) {
        return NextResponse.json({ error: "sourceId is required." }, { status: 400 });
      }
      const result = await checkAirportDailySources({ sourceId: payload.sourceId });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "delete") {
      if (!payload?.sourceId) {
        return NextResponse.json({ error: "sourceId is required." }, { status: 400 });
      }
      const { error } = await supabase
        .from("airport_daily_sources")
        .delete()
        .eq("id", payload.sourceId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (action === "toggle") {
      if (!payload?.sourceId || typeof payload.airportSource?.is_active !== "boolean") {
        return NextResponse.json(
          { error: "sourceId and is_active are required." },
          { status: 400 },
        );
      }
      const { error } = await supabase
        .from("airport_daily_sources")
        .update({
          is_active: payload.airportSource.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.sourceId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (action === "create" || action === "update") {
      const sourcePayload = buildAirportSourcePayload(payload?.airportSource);
      if (!sourcePayload.source_name || !sourcePayload.source_url) {
        return NextResponse.json(
          { error: "Source name and source URL are required." },
          { status: 400 },
        );
      }

      if (action === "update") {
        if (!payload?.sourceId) {
          return NextResponse.json({ error: "sourceId is required." }, { status: 400 });
        }
        const { data, error } = await supabase
          .from("airport_daily_sources")
          .update({
            ...sourcePayload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.sourceId)
          .select(
            "id, source_name, source_url, source_type, category, priority, is_active, last_checked_at, last_success_at, last_successful_story_title, last_successful_story_url, notes, created_at, updated_at",
          )
          .single<AirportDailySourceRow>();
        if (error) throw new Error(error.message);
        return NextResponse.json({ source: data, success: true });
      }

      const timestamp = new Date().toISOString();
      const { data, error } = await supabase
        .from("airport_daily_sources")
        .insert({
          ...sourcePayload,
          created_at: timestamp,
          updated_at: timestamp,
        })
        .select(
          "id, source_name, source_url, source_type, category, priority, is_active, last_checked_at, last_success_at, last_successful_story_title, last_successful_story_url, notes, created_at, updated_at",
        )
        .single<AirportDailySourceRow>();
      if (error) throw new Error(error.message);
      return NextResponse.json({ source: data, success: true });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error("ADMIN AIRPORT SOURCES ACTION ERROR", error);
    return NextResponse.json(
      {
        error: "Airport source action failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function buildAirportSourcePayload(source?: Partial<AirportDailySourceRow>) {
  return {
    category: normalizeOption(source?.category, [
      "baggage",
      "passenger_processing",
      "GSE",
      "security",
      "robotics",
      "AI",
      "cargo",
      "smart_airport",
    ]),
    is_active: source?.is_active ?? true,
    notes: typeof source?.notes === "string" ? source.notes.trim() : null,
    priority: normalizeOption(source?.priority, ["high", "medium", "low"]) || "medium",
    source_name: typeof source?.source_name === "string" ? source.source_name.trim() : "",
    source_type: normalizeOption(source?.source_type, [
      "airport",
      "airline",
      "supplier",
      "industry_media",
    ]),
    source_url: normalizeUrl(source?.source_url ?? ""),
  };
}

function normalizeOption(value: unknown, allowedValues: string[]) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return allowedValues.includes(trimmed) ? trimmed : null;
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return "";
    }
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
