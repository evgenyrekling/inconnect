import { NextResponse } from "next/server";
import { getVerifiedInconnectUserFromRequest } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getVerifiedInconnectUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Verified email sign-in is required." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      user: {
        email: user.email,
        emailVerified: true,
        linkedinUrl: "",
        name: user.name,
        normalizedEmail: user.normalizedEmail,
        supabaseAuthUserId: user.supabaseAuthUserId,
        userId: user.userId,
        userKey: user.userKey,
      },
    });
  } catch (error) {
    console.error("INConnect auth sync failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Verified session could not be synced.",
      },
      { status: 500 },
    );
  }
}
