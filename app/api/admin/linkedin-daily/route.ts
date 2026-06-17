import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity";
import {
  sendLatestLinkedInDailyEmail,
  sendLinkedInDailyTestEmail,
} from "@/lib/linkedin-daily-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | { action?: string; email?: string }
    | null;

  const email = normalizeEmail(payload?.email ?? "");
  if (!getAdminEmails().includes(email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    if (payload?.action === "send_test") {
      const result = await sendLinkedInDailyTestEmail(email);
      return NextResponse.json({
        recipient: email,
        resendMessageId: result.id,
        slug: result.post.slug,
        success: true,
        title: result.post.title,
      });
    }

    if (payload?.action === "send_subscribers") {
      const result = await sendLatestLinkedInDailyEmail();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unsupported admin action." }, { status: 400 });
  } catch (error) {
    console.error("ADMIN LINKEDIN DAILY ACTION ERROR", error);
    return NextResponse.json(
      {
        error: "LinkedIn Daily admin action failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}
