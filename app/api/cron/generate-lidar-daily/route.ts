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

  const autoSendValue = process.env.AUTO_SEND_LIDAR_DAILY ?? "";
  const autoSendEnabled = autoSendValue.trim().toLowerCase() === "true";
  console.info("LIDAR DAILY CRON START", {
    autoSendEnabled,
    autoSendValue,
  });

  try {
    const result = await generateAndStoreLidarDailyArticle();
    let emailResult = null;
    if (result.article.published && autoSendEnabled) {
      emailResult = await sendLatestLidarDailyEmail();
      console.info("LIDAR DAILY CRON EMAIL COMPLETE", {
        failed: emailResult.failed,
        sent: emailResult.sent,
        subscriberCount: emailResult.subscribers,
      });
    } else {
      console.info("LIDAR DAILY CRON EMAIL SKIPPED", {
        articleStatus: result.article.status,
        autoSendEnabled,
        published: result.article.published,
        reason: result.publishDecision.emailSkippedReason || "article was not published",
      });
    }

    return NextResponse.json({
      email: emailResult,
      publishDecision: result.publishDecision,
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
