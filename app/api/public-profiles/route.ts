import { NextResponse } from "next/server";
import {
  createPublicProfileFromLatestAssessment,
  deleteOwnerProfile,
  getOwnerProfile,
  updateOwnerProfile,
} from "@/lib/public-profiles";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userKey = searchParams.get("userKey")?.trim();
  if (!userKey) {
    return NextResponse.json({ error: "userKey is required." }, { status: 400 });
  }

  const profile = await getOwnerProfile(userKey);
  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { userKey?: string } | null;
    const userKey = body?.userKey?.trim();
    if (!userKey) {
      return NextResponse.json({ error: "userKey is required." }, { status: 400 });
    }

    const profile = await createPublicProfileFromLatestAssessment(userKey);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Public profile creation failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Public profile could not be created.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      displayName?: string;
      headline?: string;
      sections?: unknown;
      userKey?: string;
      visibility?: string;
    } | null;
    const userKey = body?.userKey?.trim();
    if (!userKey) {
      return NextResponse.json({ error: "userKey is required." }, { status: 400 });
    }

    const profile = await updateOwnerProfile(userKey, {
      displayName: body?.displayName,
      headline: body?.headline,
      sections: Array.isArray(body?.sections) ? body.sections : undefined,
      visibility: body?.visibility,
    });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Public profile update failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Public profile could not be updated.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userKey = searchParams.get("userKey")?.trim();
    if (!userKey) {
      return NextResponse.json({ error: "userKey is required." }, { status: 400 });
    }

    await deleteOwnerProfile(userKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Public profile delete failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Public profile could not be deleted.",
      },
      { status: 500 },
    );
  }
}
