import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity";
import {
  generateAndStoreLidarDailyArticle,
  getLatestLidarAdminArticle,
  sendLatestLidarDailyEmail,
  updateLidarArticleStatus,
} from "@/lib/lidar-daily";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const email = normalizeEmail(request.nextUrl.searchParams.get("email") ?? "");
  if (!getAdminEmails().includes(email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const [latestArticle, subscriberCount] = await Promise.all([
      getLatestLidarAdminArticle(),
      getLidarSubscriberCount(),
    ]);
    return NextResponse.json({
      autoSendEnabled: isAutoSendLidarDailyEnabled(),
      latestArticle,
      subscriberCount,
    });
  } catch (error) {
    console.error("ADMIN LIDAR DAILY LOOKUP ERROR", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "LiDAR Daily admin data could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | { action?: string; articleId?: string; email?: string; sourceUrl?: string }
    | null;
  const email = normalizeEmail(payload?.email ?? "");
  if (!getAdminEmails().includes(email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    if (payload?.action === "generate") {
      const result = await generateAndStoreLidarDailyArticle({
        sourceUrl: payload.sourceUrl,
      });
      const message = result.article.published
        ? "Article published automatically and is ready for email delivery."
        : "Draft generated successfully. Publish manually or enable AUTO_SEND_LIDAR_DAILY.";
      return NextResponse.json({
        articleId: result.article.id,
        message,
        publishDecision: result.publishDecision,
        published: result.article.published,
        qualityScore: result.quality.score,
        slug: result.article.slug,
        status: result.article.status,
        success: true,
        title: result.article.title,
      });
    }

    if (payload?.action === "publish") {
      if (!payload.articleId) return missingArticleId();
      const article = await updateLidarArticleStatus(payload.articleId, "publish");
      return NextResponse.json({ article, success: true });
    }

    if (payload?.action === "unpublish") {
      if (!payload.articleId) return missingArticleId();
      const article = await updateLidarArticleStatus(payload.articleId, "unpublish");
      return NextResponse.json({ article, success: true });
    }

    if (payload?.action === "delete") {
      if (!payload.articleId) return missingArticleId();
      await updateLidarArticleStatus(payload.articleId, "delete");
      return NextResponse.json({ success: true });
    }

    if (payload?.action === "send_test") {
      const result = await sendLatestLidarDailyEmail({
        allowDraft: true,
        articleId: payload.articleId,
        testEmail: email,
      });
      return NextResponse.json(result);
    }

    if (payload?.action === "send_subscribers") {
      const result = await sendLatestLidarDailyEmail({
        articleId: payload.articleId,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unsupported admin action." }, { status: 400 });
  } catch (error) {
    console.error("ADMIN LIDAR DAILY ACTION ERROR", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "LiDAR Daily admin action failed.",
      },
      { status: 500 },
    );
  }
}

function missingArticleId() {
  return NextResponse.json({ error: "articleId is required." }, { status: 400 });
}

async function getLidarSubscriberCount() {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("digest_type", "lidar_daily")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

function isAutoSendLidarDailyEnabled() {
  return (process.env.AUTO_SEND_LIDAR_DAILY ?? "").trim().toLowerCase() === "true";
}
