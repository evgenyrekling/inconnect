import { NextRequest, NextResponse } from "next/server";
import {
  BlogGenerationError,
  generateAndStoreBlogPost,
} from "@/lib/blog-generator";
import { normalizeEmail } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  console.info("INConnect blog cron started");
  return generatePublishedBlogResponse("cron");
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = normalizeEmail(typeof payload?.email === "string" ? payload.email : "");

  if (!getAdminEmails().includes(email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  console.info("INConnect manual blog publish trigger started", { email });
  return generatePublishedBlogResponse("admin-manual");
}

async function generatePublishedBlogResponse(source: "admin-manual" | "cron") {
  try {
    const result = await generateAndStoreBlogPost({ publish: true, source });
    return NextResponse.json({
      success: true,
      title: result.post.title,
      slug: result.post.slug,
      published: result.post.published,
    });
  } catch (error) {
    console.error("Daily blog generation failed", error);
    return NextResponse.json(
      {
        success: false,
        stage: error instanceof BlogGenerationError ? error.stage : "unknown",
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
