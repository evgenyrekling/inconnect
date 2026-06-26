import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getVerifiedInconnectUserFromRequest } from "@/lib/auth-server";
import { createAndSendProfessionalInvitation } from "@/lib/professional-invitations";
import {
  getProfessionalProfileById,
  getProfessionalProfiles,
  saveProfessionalFromLinkedInUrl,
} from "@/lib/professionals";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const owner = await getVerifiedInconnectUserFromRequest(request);
  if (!owner) {
    return NextResponse.json(
      { error: "Verified email sign-in is required.", professionals: [] },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim() ?? "";
  if (id) {
    const professional = await getProfessionalProfileById(id, {
      ownerEmail: owner.email,
      ownerUserId: owner.userId,
    });
    return NextResponse.json({ professional });
  }

  const professionals = await getProfessionalProfiles({
    ownerEmail: owner.email,
    ownerUserId: owner.userId,
  });
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
      professionalEmail?: string;
      profileImageUrl?: string;
      sendInvitation?: boolean;
    } | null;

    const displayName = body?.displayName?.trim() ?? "";
    const linkedinUrl = body?.linkedinUrl?.trim() ?? "";

    if (!displayName || !linkedinUrl) {
      return NextResponse.json(
        { error: "Full name and LinkedIn URL are required." },
        { status: 400 },
      );
    }

    const owner = await getVerifiedInconnectUserFromRequest(request);
    if (!owner) {
      return NextResponse.json(
        { error: "Verified email sign-in is required." },
        { status: 401 },
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
      ownerEmail: owner.email,
      ownerUserId: owner.userId,
      professionalEmail: body?.professionalEmail,
      profileImageUrl: body?.profileImageUrl,
    });

    let invitation:
      | Awaited<ReturnType<typeof createAndSendProfessionalInvitation>>
      | null = null;
    if (body?.sendInvitation) {
      try {
        invitation = await createAndSendProfessionalInvitation({
          ownerEmail: owner.email,
          ownerName: owner.name,
          ownerUserId: owner.userId,
          professional: result.profile,
        });
      } catch (invitationError) {
        console.error("Professional invitation send failed", invitationError);
        invitation = {
          message:
            invitationError instanceof Error
              ? `Professional saved, but invitation was not sent: ${invitationError.message}`
              : "Professional saved, but invitation was not sent.",
          sent: false,
          status: "failed",
        };
      }
    }

    revalidatePath("/network/professionals");
    revalidatePath("/network/profiles");

    return NextResponse.json({ ...result, invitation });
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
