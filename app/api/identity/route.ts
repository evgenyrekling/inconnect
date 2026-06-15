import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getOrCreateUserByEmail } from "@/lib/user-profile-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
  } | null;
  const email = body?.email?.trim() ?? "";
  const name = body?.name?.trim() ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const normalizedEmail = normalizeEmail(email);
    const isAdminUser = getAdminEmails().includes(normalizedEmail);
    const { user } = await getOrCreateUserByEmail(supabase, {
      email,
      isAdminUser,
      name,
      planType: isAdminUser ? "admin" : "free",
    });

    return NextResponse.json({
      user: {
        email: user.email,
        linkedinUrl: user.linkedin_url ?? "",
        name: user.name ?? name,
        normalizedEmail: user.normalized_email,
        userId: user.id,
        userKey: user.user_key,
      },
    });
  } catch (error) {
    console.error("INConnect identity creation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Identity could not be created." },
      { status: 500 },
    );
  }
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}
