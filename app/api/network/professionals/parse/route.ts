import { NextResponse } from "next/server";
import { fetchLinkedInPublicProfessionalData } from "@/lib/professionals";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    linkedinUrl?: string;
  } | null;
  const linkedinUrl = body?.linkedinUrl?.trim() ?? "";
  const profile = await fetchLinkedInPublicProfessionalData(linkedinUrl);

  if (!profile) {
    return NextResponse.json(
      { error: "Please enter a valid public LinkedIn profile URL." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    canonicalLinkedinUrl: profile.normalized_linkedin_url,
    confidence: profile.confidence,
    currentCompany: profile.current_company,
    currentTitle: profile.current_title,
    linkedinUrl: profile.linkedin_url,
    location: profile.location,
    metadataSource:
      profile.source === "linkedin_public_metadata" ? "open_graph" : "url",
    normalizedLinkedinUrl: profile.normalized_linkedin_url,
    profileImageUrl: profile.profile_image_url,
    publicSlug: profile.public_slug,
    source: profile.source,
    suggestedHeadline: profile.headline,
    suggestedName: profile.full_name,
  });
}
