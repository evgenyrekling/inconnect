import { NextRequest, NextResponse } from "next/server";
import {
  AirportBriefingGenerationError,
  generateAndStoreAirportBriefing,
} from "@/lib/airport-briefing-generator";
import { sendLatestAirportDailyEmail } from "@/lib/airport-daily-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

  console.info("AIRPORT DAILY START", {
    route: "/api/cron/airport-daily",
  });

  try {
    const generated = await generateAndStoreAirportBriefing({ source: "cron" });
    const shouldSend = process.env.AUTO_SEND_AIRPORT_DAILY === "true";
    const sendResult = shouldSend
      ? await sendLatestAirportDailyEmail({
          briefingId: generated.briefing.id,
          requireUnsent: false,
        })
      : null;

    return NextResponse.json({
      briefingId: generated.briefing.id,
      failed: sendResult?.failed ?? 0,
      sent: sendResult?.sent ?? 0,
      skippedEmail: !shouldSend,
      slug: generated.briefing.slug,
      stage: "complete",
      subscriberCount: sendResult?.subscribers ?? 0,
      success: true,
      title: generated.briefing.title,
    });
  } catch (error) {
    console.error("AIRPORT DAILY COMBINED CRON FAILED", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        stage:
          error instanceof AirportBriefingGenerationError
            ? error.stage
            : "airport_daily",
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
