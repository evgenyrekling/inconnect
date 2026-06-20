import { NextRequest, NextResponse } from "next/server";
import {
  AirportBriefingGenerationError,
  generateAndStoreAirportBriefing,
} from "@/lib/airport-briefing-generator";
import { normalizeEmail } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  console.info("INConnect airport briefing cron started");
  return generateAirportBriefingResponse("cron");
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = normalizeEmail(typeof payload?.email === "string" ? payload.email : "");

  if (!getAdminEmails().includes(email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  console.info("INConnect manual airport briefing trigger started", { email });
  return generateAirportBriefingResponse("admin-manual");
}

async function generateAirportBriefingResponse(source: "admin-manual" | "cron") {
  try {
    const result = await generateAndStoreAirportBriefing({ source });
    return NextResponse.json({
      success: true,
      title: result.briefing.title,
      slug: result.briefing.slug,
      published: result.briefing.published,
      autoSendAllowed: result.briefing.auto_send_allowed ?? false,
      qualityRejectionReason: result.briefing.quality_rejection_reason ?? null,
      qualityScore: result.briefing.quality_score ?? null,
      sourceUrlType: result.briefing.source_url_type ?? null,
      status: result.briefing.status ?? null,
    });
  } catch (error) {
    console.error("Daily airport briefing generation failed", error);
    if (
      error instanceof AirportBriefingGenerationError &&
      error.stage === "source_selection"
    ) {
      return NextResponse.json({
        success: false,
        stage: error.stage,
        error: error.message,
      });
    }
    return NextResponse.json(
      {
        success: false,
        stage:
          error instanceof AirportBriefingGenerationError
            ? error.stage
            : "unknown",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}
