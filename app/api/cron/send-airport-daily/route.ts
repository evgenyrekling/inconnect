import { NextRequest, NextResponse } from "next/server";
import { sendLatestAirportDailyEmail } from "@/lib/airport-daily-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

  console.info("INConnect airport daily email cron started");

  if (process.env.AUTO_SEND_AIRPORT_DAILY !== "true") {
    return NextResponse.json({
      skipped: true,
      stage: "auto_send_disabled",
      reason: "AUTO_SEND_AIRPORT_DAILY is not true.",
      success: true,
    });
  }

  try {
    const result = await sendLatestAirportDailyEmail({ requireUnsent: true });
    console.info("INConnect airport daily email cron finished", result);
    return NextResponse.json({
      ...result,
      stage: "complete",
    });
  } catch (error) {
    console.error("AIRPORT DAILY EMAIL CRON FAILED", error);
    return NextResponse.json(
      {
        error: "Airport daily email cron failed.",
        details: error instanceof Error ? error.message : String(error),
        stage: "send_airport_daily",
        success: false,
      },
      { status: 500 },
    );
  }
}

function validateCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;

  const authorization = request.headers.get("authorization") ?? "";
  if (authorization === `Bearer ${secret}`) return null;

  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}
