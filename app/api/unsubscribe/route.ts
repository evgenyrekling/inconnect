import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionRow = {
  id: string;
  email: string;
  digest_type: string;
  is_active: boolean | null;
  unsubscribe_token: string | null;
};

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unsubscribe token is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, email, digest_type, is_active, unsubscribe_token")
      .eq("unsubscribe_token", token)
      .maybeSingle<SubscriptionRow>();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Unsubscribe link is invalid." }, { status: 404 });
    }

    return NextResponse.json({
      digestType: data.digest_type,
      email: data.email,
      isActive: Boolean(data.is_active),
    });
  } catch (error) {
    console.error("UNSUBSCRIBE LOOKUP FAILED", error);
    return NextResponse.json(
      { error: "Unsubscribe details could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    scope?: "all" | "digest";
    token?: string;
  } | null;
  const token = payload?.token?.trim() ?? "";
  const scope = payload?.scope === "all" ? "all" : "digest";

  if (!token) {
    return NextResponse.json({ error: "Unsubscribe token is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: subscription, error: lookupError } = await supabase
      .from("subscriptions")
      .select("id, email, digest_type, is_active, unsubscribe_token")
      .eq("unsubscribe_token", token)
      .maybeSingle<SubscriptionRow>();

    if (lookupError) throw lookupError;
    if (!subscription) {
      return NextResponse.json({ error: "Unsubscribe link is invalid." }, { status: 404 });
    }

    const timestamp = new Date().toISOString();
    let query = supabase
      .from("subscriptions")
      .update({
        is_active: false,
        unsubscribed_at: timestamp,
        updated_at: timestamp,
      })
      .eq("email", subscription.email);

    if (scope === "digest") {
      query = query.eq("digest_type", subscription.digest_type);
    }

    const { error: updateError } = await query;
    if (updateError) throw updateError;

    return NextResponse.json({
      digestType: subscription.digest_type,
      email: subscription.email,
      message:
        scope === "all"
          ? "You have been unsubscribed from all INConnect emails."
          : "You have been unsubscribed from this INConnect digest.",
      scope,
    });
  } catch (error) {
    console.error("UNSUBSCRIBE FAILED", error);
    return NextResponse.json(
      { error: "Unsubscribe request could not be completed." },
      { status: 500 },
    );
  }
}
