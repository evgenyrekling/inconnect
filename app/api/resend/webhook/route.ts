import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const eventType = getString(payload.type);
  const data =
    typeof payload.data === "object" && payload.data !== null
      ? (payload.data as Record<string, unknown>)
      : payload;
  const resendEmailId =
    getString(data.email_id) || getString(data.emailId) || getString(data.id);
  const statusUpdate = mapResendEvent(eventType);

  if (!resendEmailId || !statusUpdate.status) {
    return NextResponse.json({
      ignored: true,
      reason: "No delivery id or supported event type.",
    });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const timestamp = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: statusUpdate.status,
    };
    if (statusUpdate.timestampColumn) patch[statusUpdate.timestampColumn] = timestamp;

    const { error } = await supabase
      .from("email_deliveries")
      .update(patch)
      .eq("resend_email_id", resendEmailId);

    if (error) {
      console.error("RESEND WEBHOOK DELIVERY UPDATE ERROR", {
        error,
        eventType,
        resendEmailId,
      });
      return NextResponse.json(
        { error: "Delivery status could not be updated." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      resendEmailId,
      status: statusUpdate.status,
      success: true,
    });
  } catch (error) {
    console.error("RESEND WEBHOOK FAILED", error);
    return NextResponse.json(
      { error: "Webhook could not be processed." },
      { status: 500 },
    );
  }
}

function mapResendEvent(eventType: string) {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("delivered")) {
    return { status: "delivered", timestampColumn: "delivered_at" };
  }
  if (normalized.includes("opened")) {
    return { status: "opened", timestampColumn: "opened_at" };
  }
  if (normalized.includes("clicked")) {
    return { status: "clicked", timestampColumn: "clicked_at" };
  }
  if (normalized.includes("bounced")) {
    return { status: "bounced", timestampColumn: "bounced_at" };
  }
  return { status: "", timestampColumn: "" };
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
