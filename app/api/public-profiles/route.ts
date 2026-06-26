import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getVerifiedInconnectUserFromRequest } from "@/lib/auth-server";
import {
  createPublicProfileFromLatestAssessment,
  deleteOwnerProfile,
  deleteOwnerProfileBySlug,
  getEditableProfileBySlug,
  getOwnerProfile,
  updateOwnerProfile,
  updateOwnerProfileBySlug,
} from "@/lib/public-profiles";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim();
  const slug = searchParams.get("slug")?.trim();
  const userKey = searchParams.get("userKey")?.trim();
  if (slug) {
    if (!userKey && !email) {
      return NextResponse.json({ error: "userKey or email is required." }, { status: 400 });
    }
    const profile = await getEditableProfileBySlug(slug, { email, userKey });
    return NextResponse.json({ profile });
  }
  if (!userKey && !email) {
    return NextResponse.json({ error: "userKey or email is required." }, { status: 400 });
  }

  const profile = await getOwnerProfile({ email, userKey });
  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  try {
    const verifiedUser = await getVerifiedInconnectUserFromRequest(request);
    if (!verifiedUser) {
      return NextResponse.json(
        { error: "Verified email sign-in is required." },
        { status: 401 },
      );
    }

    const profile = await createPublicProfileFromLatestAssessment(verifiedUser.userKey);
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
      company?: string;
      displayName?: string;
      email?: string;
      headline?: string;
      location?: string;
      professionalRole?: string;
      sections?: unknown;
      slug?: string;
      summary?: string;
      userKey?: string;
      visibility?: string;
    } | null;
    const email = body?.email?.trim();
    const slug = body?.slug?.trim();
    const userKey = body?.userKey?.trim();
    const verifiedUser = await getVerifiedInconnectUserFromRequest(request);
    if (!verifiedUser) {
      return NextResponse.json(
        { error: "Verified email sign-in is required." },
        { status: 401 },
      );
    }

    const values = {
      company: body?.company,
      displayName: body?.displayName,
      headline: body?.headline,
      location: body?.location,
      professionalRole: body?.professionalRole,
      sections: Array.isArray(body?.sections) ? body.sections : undefined,
      summary: body?.summary,
      visibility: body?.visibility,
    };
    const profile = slug
      ? await updateOwnerProfileBySlug(
          slug,
          { email: verifiedUser.email, userKey: verifiedUser.userKey },
          values,
        )
      : await updateOwnerProfile(
          { email: verifiedUser.email, userKey: verifiedUser.userKey },
          values,
        );
    revalidatePath(`/p/${profile.slug}`);
    revalidatePath("/network/profile");
    revalidatePath("/network/profiles");
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
    const email = searchParams.get("email")?.trim();
    const slug = searchParams.get("slug")?.trim();
    const userKey = searchParams.get("userKey")?.trim();
    const verifiedUser = await getVerifiedInconnectUserFromRequest(request);
    if (!verifiedUser) {
      return NextResponse.json(
        { error: "Verified email sign-in is required." },
        { status: 401 },
      );
    }

    if (slug) {
      await deleteOwnerProfileBySlug(slug, {
        email: verifiedUser.email,
        userKey: verifiedUser.userKey,
      });
    } else {
      await deleteOwnerProfile({
        email: verifiedUser.email,
        userKey: verifiedUser.userKey,
      });
    }
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
