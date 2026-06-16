import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity";
import { sendDigestEmail } from "@/lib/email/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getOrCreateUserByEmail } from "@/lib/user-profile-store";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    userKey?: string;
  } | null;
  const email = payload?.email?.trim() ?? "";
  const name = payload?.name?.trim() ?? "";
  const userKey = payload?.userKey?.trim() ?? "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const normalizedEmail = normalizeEmail(email);
    const isAdminUser = getAdminEmails().includes(normalizedEmail);
    await getOrCreateUserByEmail(supabase, {
      email,
      isAdminUser,
      name,
      planType: isAdminUser ? "admin" : "free",
      userKey: userKey || undefined,
    });

    const result = await sendDigestEmail({
      briefingText: "Your INConnect email system is working.",
      digestTitle: "INConnect Email Test",
      heroImageUrl: `${SITE_URL}/hero-professionals-collage.png`,
      readUrl: SITE_URL,
      subject: "INConnect Email Test",
      title: "INConnect Email Test",
      to: normalizedEmail,
    });

    return NextResponse.json({
      email: normalizedEmail,
      resendEmailId: result.id,
      success: true,
    });
  } catch (error) {
    console.error("INCONNECT TEST EMAIL FAILED", error);
    return NextResponse.json(
      {
        error: "Test email could not be sent.",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : "",
      },
      { status: 500 },
    );
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}
