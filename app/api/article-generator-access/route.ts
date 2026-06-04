import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as unknown;
  const email = getEmail(payload);

  if (!email) {
    return NextResponse.json(
      { error: "A valid email address is required.", isAdmin: false },
      { status: 400 },
    );
  }

  return NextResponse.json({ isAdmin: getAdminEmails().includes(email) });
}

function getEmail(value: unknown) {
  if (typeof value !== "object" || value === null) return "";
  const email = "email" in value && typeof value.email === "string" ? value.email : "";
  const normalizedEmail = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ? normalizedEmail : "";
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}
