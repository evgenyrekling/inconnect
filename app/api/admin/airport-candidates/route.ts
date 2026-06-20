import { NextRequest, NextResponse } from "next/server";
import {
  AirportBriefingGenerationError,
  generateAndStoreAirportBriefing,
} from "@/lib/airport-briefing-generator";
import { sendAirportDailyTestEmail } from "@/lib/airport-daily-email";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AirportDailyCandidateRow = {
  id: string;
  title: string;
  source_url: string;
  source_name: string | null;
  source_image_url: string | null;
  category: string | null;
  notes: string | null;
  status: string | null;
  priority: string | null;
  selected_for_digest: boolean | null;
  used_at: string | null;
  created_by_email: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AirportCandidatePayload = {
  action?: string;
  candidate?: Partial<AirportDailyCandidateRow>;
  candidateId?: string;
  email?: string;
};

const CANDIDATE_SELECT =
  "id, title, source_url, source_name, source_image_url, category, notes, status, priority, selected_for_digest, used_at, created_by_email, created_at, updated_at";

export async function GET(request: NextRequest) {
  const adminError = requireAdmin(request.nextUrl.searchParams.get("email") ?? "");
  if (adminError) return adminError;

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("airport_daily_candidates")
      .select(CANDIDATE_SELECT)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .returns<AirportDailyCandidateRow[]>();

    if (error) {
      console.error("ADMIN AIRPORT CANDIDATES LIST ERROR", error);
      return NextResponse.json(
        { error: "Airport candidates could not be loaded.", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ candidates: data ?? [] });
  } catch (error) {
    console.error("ADMIN AIRPORT CANDIDATES LIST FAILED", error);
    return NextResponse.json(
      {
        error: "Airport candidates could not be loaded.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as AirportCandidatePayload | null;
  const adminEmail = normalizeEmail(payload?.email ?? "");
  const adminError = requireAdmin(adminEmail);
  if (adminError) return adminError;

  try {
    const supabase = getSupabaseAdminClient();
    const action = payload?.action ?? "";
    const candidateId = payload?.candidateId ?? "";

    if (action === "create" || action === "update") {
      const candidatePayload = buildCandidatePayload(payload?.candidate, adminEmail);
      if (!candidatePayload.title || !candidatePayload.source_url) {
        return NextResponse.json(
          { error: "Title and source URL are required." },
          { status: 400 },
        );
      }

      if (action === "update") {
        if (!candidateId) {
          return NextResponse.json({ error: "candidateId is required." }, { status: 400 });
        }
        const { data, error } = await supabase
          .from("airport_daily_candidates")
          .update({
            ...candidatePayload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", candidateId)
          .select(CANDIDATE_SELECT)
          .single<AirportDailyCandidateRow>();
        if (error) throw new Error(error.message);
        return NextResponse.json({ candidate: data, success: true });
      }

      const timestamp = new Date().toISOString();
      const { data, error } = await supabase
        .from("airport_daily_candidates")
        .insert({
          ...candidatePayload,
          created_at: timestamp,
          updated_at: timestamp,
        })
        .select(CANDIDATE_SELECT)
        .single<AirportDailyCandidateRow>();
      if (error) throw new Error(error.message);
      return NextResponse.json({ candidate: data, success: true });
    }

    if (["approve", "reject", "mark_used"].includes(action)) {
      if (!candidateId) {
        return NextResponse.json({ error: "candidateId is required." }, { status: 400 });
      }
      const timestamp = new Date().toISOString();
      const status =
        action === "approve" ? "approved" : action === "reject" ? "rejected" : "used";
      const updatePayload: Record<string, unknown> = {
        status,
        updated_at: timestamp,
      };
      if (action === "mark_used") {
        updatePayload.selected_for_digest = true;
        updatePayload.used_at = timestamp;
      }
      const { error } = await supabase
        .from("airport_daily_candidates")
        .update(updatePayload)
        .eq("id", candidateId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      if (!candidateId) {
        return NextResponse.json({ error: "candidateId is required." }, { status: 400 });
      }
      const { error } = await supabase
        .from("airport_daily_candidates")
        .delete()
        .eq("id", candidateId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (action === "generate" || action === "send_test") {
      if (!candidateId) {
        return NextResponse.json({ error: "candidateId is required." }, { status: 400 });
      }
      const result = await generateAndStoreAirportBriefing({
        candidateId,
        source: "admin-manual",
      });
      if (action === "send_test") {
        const emailResult = await sendAirportDailyTestEmail({
          briefingId: result.briefing.id,
          to: adminEmail,
        });
        return NextResponse.json({
          briefingId: result.briefing.id,
          emailId: emailResult.id,
          slug: result.briefing.slug,
          success: true,
          title: result.briefing.title,
        });
      }
      return NextResponse.json({
        briefingId: result.briefing.id,
        slug: result.briefing.slug,
        success: true,
        title: result.briefing.title,
      });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error("ADMIN AIRPORT CANDIDATES ACTION ERROR", error);
    return NextResponse.json(
      {
        error:
          error instanceof AirportBriefingGenerationError
            ? error.message
            : "Airport candidate action failed.",
        stage:
          error instanceof AirportBriefingGenerationError ? error.stage : "admin_action",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function buildCandidatePayload(
  candidate: Partial<AirportDailyCandidateRow> | undefined,
  adminEmail: string,
) {
  return {
    category: normalizeOption(candidate?.category, [
      "baggage",
      "passenger_processing",
      "GSE",
      "security",
      "robotics",
      "AI",
      "cargo",
      "smart_airport",
    ]),
    created_by_email: adminEmail,
    notes: typeof candidate?.notes === "string" ? candidate.notes.trim() : null,
    priority: normalizeOption(candidate?.priority, ["high", "medium", "low"]) || "medium",
    source_image_url:
      typeof candidate?.source_image_url === "string"
        ? normalizeUrl(candidate.source_image_url, true)
        : null,
    source_name:
      typeof candidate?.source_name === "string" ? candidate.source_name.trim() || null : null,
    source_url: normalizeUrl(candidate?.source_url ?? ""),
    status: normalizeOption(candidate?.status, ["pending", "approved", "rejected", "used"]) ||
      "pending",
    title: typeof candidate?.title === "string" ? candidate.title.trim() : "",
  };
}

function normalizeOption(value: unknown, allowedValues: string[]) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return allowedValues.includes(trimmed) ? trimmed : null;
}

function normalizeUrl(value: string, optional = false) {
  const trimmed = value.trim();
  if (!trimmed) return optional ? null : "";
  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return optional ? null : "";
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
