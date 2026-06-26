import { NextResponse } from "next/server";
import { getVerifiedInconnectUserFromRequest } from "@/lib/auth-server";
import {
  claimProfessionalInvitation,
  getProfessionalInvitation,
  requestProfessionalRemoval,
} from "@/lib/professional-invitations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.trim() ?? "";
    const context = searchParams.get("context")?.trim() ?? "";
    if (!token) {
      return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });
    }

    const invitation = await getProfessionalInvitation(
      token,
      context === "remove" ? "removal_opened" : "claim_opened",
    );
    if (!invitation) {
      return NextResponse.json({ error: "Invitation was not found." }, { status: 404 });
    }

    return NextResponse.json({ invitation });
  } catch (error) {
    console.error("Professional invitation lookup failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invitation could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      action?: "claim" | "remove";
      token?: string;
    } | null;
    const token = body?.token?.trim() ?? "";
    if (!token) {
      return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });
    }

    if (body?.action === "remove") {
      await requestProfessionalRemoval(token);
      return NextResponse.json({
        message: "Removal request saved.",
        success: true,
      });
    }

    const verifiedUser = await getVerifiedInconnectUserFromRequest(request);
    if (!verifiedUser) {
      return NextResponse.json(
        { error: "Verified email sign-in is required." },
        { status: 401 },
      );
    }

    await claimProfessionalInvitation({
      token,
      verifiedEmail: verifiedUser.email,
      verifiedUserId: verifiedUser.userId,
    });
    return NextResponse.json({
      message: "Profile claimed.",
      success: true,
      user: {
        email: verifiedUser.email,
        userId: verifiedUser.userId,
        userKey: verifiedUser.userKey,
      },
    });
  } catch (error) {
    console.error("Professional invitation action failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invitation action failed." },
      { status: 500 },
    );
  }
}
