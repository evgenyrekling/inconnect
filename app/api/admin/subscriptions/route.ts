import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionRow = {
  id: string;
  user_id: string | null;
  email: string;
  digest_type: string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string | null;
};

const DIGEST_LABELS: Record<string, string> = {
  airport_automation_daily: "Airport Automation Daily",
  linkedin_daily: "LinkedIn Daily",
  smart_mobility_daily: "Smart Mobility Daily",
  industrial_automation_daily: "Industrial Automation Daily",
};

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email") ?? "";
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, user_id, email, digest_type, is_active, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<SubscriptionRow[]>();

    if (error) {
      console.error("ADMIN SUBSCRIPTIONS LIST ERROR", error);
      return NextResponse.json(
        { error: "Subscriptions could not be loaded.", details: error.message },
        { status: 500 },
      );
    }

    const subscriptions = data ?? [];
    const digestCounts = Object.entries(DIGEST_LABELS).map(([digestType, label]) => {
      const digestRows = subscriptions.filter((row) => row.digest_type === digestType);
      const activeCount = digestRows.filter((row) => row.is_active).length;
      const inactiveCount = digestRows.length - activeCount;
      const totalCount = digestRows.length;

      return {
        activeCount,
        digestType,
        inactiveCount,
        label,
        totalCount,
        unsubscribeRate:
          totalCount === 0 ? 0 : Math.round((inactiveCount / totalCount) * 1000) / 10,
      };
    });

    return NextResponse.json({
      digestCounts,
      recentSubscriptions: subscriptions.slice(0, 30),
    });
  } catch (error) {
    console.error("ADMIN SUBSCRIPTIONS LIST FAILED", error);
    return NextResponse.json(
      {
        error: "Subscriptions could not be loaded.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
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
