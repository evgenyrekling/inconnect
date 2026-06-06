import { NextRequest, NextResponse } from "next/server";
import { generateAndStoreBlogPost } from "@/lib/blog-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  try {
    const result = await generateAndStoreBlogPost();
    return NextResponse.json({
      ok: true,
      autoPublished: result.autoPublished,
      post: result.post,
      topic: result.topic,
    });
  } catch (error) {
    console.error("Daily blog generation failed", error);
    return NextResponse.json(
      {
        error: "Daily blog generation failed.",
        details: error instanceof Error ? error.message : String(error),
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
