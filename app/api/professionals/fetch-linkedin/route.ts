import { NextResponse } from "next/server";
import { fetchLinkedInPublicProfessionalData } from "@/lib/professionals";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    linkedin_url?: string;
    linkedinUrl?: string;
  } | null;
  const linkedinUrl = (body?.linkedin_url ?? body?.linkedinUrl ?? "").trim();
  const profile = await fetchLinkedInPublicProfessionalData(linkedinUrl);

  if (!profile) {
    return NextResponse.json(
      { error: "Please enter a valid public LinkedIn profile URL." },
      { status: 400 },
    );
  }

  return NextResponse.json(profile);
}
