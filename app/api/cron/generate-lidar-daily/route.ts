import { NextRequest, NextResponse } from "next/server";
import {
  generateAndStoreLidarDailyArticle,
  sendLatestLidarDailyEmail,
} from "@/lib/lidar-daily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

  console.info("LIDAR DAILY CRON START");

  try {
    const result = await generateAndStoreLidarDailyArticle();
    let emailResult = null;
    if (result.article.published && process.env.AUTO_SEND_LIDAR_DAILY === "true") {
      emailResult = await sendLatestLidarDailyEmail();
    }

    return NextResponse.json({
      email: emailResult,
      published: result.article.published,
      qualityScore: result.quality.score,
      slug: result.article.slug,
      stage: "complete",
      success: true,
      title: result.article.title,
    });
  } catch (error) {
    console.error("LIDAR DAILY CRON FAILED", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "LiDAR Daily generation failed.",
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
