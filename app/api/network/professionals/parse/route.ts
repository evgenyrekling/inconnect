import { NextResponse } from "next/server";
import {
  fetchLinkedInOpenGraphMetadata,
  parseProfessionalLinkedInUrl,
} from "@/lib/professionals";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    linkedinUrl?: string;
  } | null;
  const linkedinUrl = body?.linkedinUrl?.trim() ?? "";
  const parsed = parseProfessionalLinkedInUrl(linkedinUrl);

  if (!parsed) {
    return NextResponse.json(
      { error: "Please enter a valid public LinkedIn profile URL." },
      { status: 400 },
    );
  }

  const metadata = await fetchLinkedInOpenGraphMetadata(parsed.linkedinUrl);

  return NextResponse.json({
    canonicalLinkedinUrl: parsed.linkedinUrl,
    linkedinUrl: parsed.originalLinkedinUrl,
    metadataSource: metadata ? "open_graph" : "url",
    normalizedLinkedinUrl: parsed.normalizedLinkedinUrl,
    profileImageUrl: metadata?.image ?? "",
    publicSlug: parsed.publicSlug,
    suggestedHeadline: metadata?.description ?? "",
    suggestedName: metadata?.title || parsed.suggestedName,
  });
}
