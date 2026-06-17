import { NextResponse } from "next/server";
import { sendAirportDailyTestEmail } from "@/lib/airport-daily-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_RECIPIENT = "evgeny.rekling@gmail.com";

export async function GET() {
  try {
    const result = await sendAirportDailyTestEmail({
      to: TEST_RECIPIENT,
    });

    return NextResponse.json({
      recipient: TEST_RECIPIENT,
      resendMessageId: result.id,
      slug: result.briefing.slug,
      success: true,
      title: result.briefing.title,
    });
  } catch (error) {
    console.error("AIRPORT DAILY TEST EMAIL FAILED", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        recipient: TEST_RECIPIENT,
        success: false,
      },
      { status: 500 },
    );
  }
}
