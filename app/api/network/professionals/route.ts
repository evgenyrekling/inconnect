import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  getProfessionalProfiles,
  saveProfessionalFromLinkedInUrl,
} from "@/lib/professionals";

export const runtime = "nodejs";

export async function GET() {
  const professionals = await getProfessionalProfiles();
  return NextResponse.json({ professionals });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      currentCompany?: string;
      currentTitle?: string;
      displayName?: string;
      headline?: string;
      industry?: string;
      linkedinUrl?: string;
      location?: string;
      ownerEmail?: string;
      profileImageUrl?: string;
    } | null;

    const displayName = body?.displayName?.trim() ?? "";
    const linkedinUrl = body?.linkedinUrl?.trim() ?? "";

    if (!displayName || !linkedinUrl) {
      return NextResponse.json(
        { error: "Full name and LinkedIn URL are required." },
        { status: 400 },
      );
    }

    const result = await saveProfessionalFromLinkedInUrl({
      currentCompany: body?.currentCompany,
      currentTitle: body?.currentTitle,
      displayName,
      headline: body?.headline,
      industry: body?.industry,
      linkedinUrl,
      location: body?.location,
      ownerEmail: body?.ownerEmail,
      profileImageUrl: body?.profileImageUrl,
    });

    revalidatePath("/network/professionals");
    revalidatePath("/network/profiles");

    return NextResponse.json(result);
  } catch (error) {
    console.error("Professional save failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Professional could not be saved.",
      },
      { status: 500 },
    );
  }
}
