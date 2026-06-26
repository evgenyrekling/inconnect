import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getVerifiedInconnectUserFromRequest } from "@/lib/auth-server";
import {
  attachProfessionalToCompany,
  deleteProfessionalCompanyLink,
  getProfessionalCompanyLinksByProfessionalId,
  getProfessionalLinksForCompany,
} from "@/lib/professionals";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const owner = await getVerifiedInconnectUserFromRequest(request);
  if (!owner) {
    return NextResponse.json(
      { error: "Verified email sign-in is required.", links: [] },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId")?.trim() ?? "";
  const professionalId = searchParams.get("professionalId")?.trim() ?? "";

  if (companyId) {
    const links = await getProfessionalLinksForCompany(companyId, {
      ownerEmail: owner.email,
      ownerUserId: owner.userId,
    });
    return NextResponse.json({ links });
  }

  if (professionalId) {
    const links = await getProfessionalCompanyLinksByProfessionalId(professionalId, {
      ownerEmail: owner.email,
      ownerUserId: owner.userId,
    });
    return NextResponse.json({ links });
  }

  return NextResponse.json({ links: [] });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      companyId?: string;
      createdByEmail?: string;
      department?: string;
      isPrimary?: boolean;
      notes?: string;
      professionalId?: string;
      relationshipType?: string;
      seniority?: string;
      title?: string;
    } | null;

    const professionalId = body?.professionalId?.trim() ?? "";
    const companyId = body?.companyId?.trim() ?? "";
    if (!professionalId || !companyId) {
      return NextResponse.json(
        { error: "Professional and company are required." },
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

    const link = await attachProfessionalToCompany({
      companyId,
      createdByEmail: owner.email,
      department: body?.department,
      isPrimary: body?.isPrimary,
      notes: body?.notes,
      ownerEmail: owner.email,
      ownerUserId: owner.userId,
      professionalId,
      relationshipType: body?.relationshipType,
      seniority: body?.seniority,
      title: body?.title,
    });

    revalidatePath(`/network/professionals/${professionalId}`);
    revalidatePath(`/network/accounts/airports/${companyId}`);
    revalidatePath("/network/accounts/airports");
    revalidatePath("/network/professionals");

    return NextResponse.json({ link });
  } catch (error) {
    console.error("Professional company attach failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Professional could not be attached.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ error: "Link id is required." }, { status: 400 });
    }

    const owner = await getVerifiedInconnectUserFromRequest(request);
    if (!owner) {
      return NextResponse.json(
        { error: "Verified email sign-in is required." },
        { status: 401 },
      );
    }

    await deleteProfessionalCompanyLink(id, {
      ownerEmail: owner.email,
      ownerUserId: owner.userId,
    });
    revalidatePath("/network/professionals");
    revalidatePath("/network/accounts/airports");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Professional company link delete failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Company link could not be removed.",
      },
      { status: 500 },
    );
  }
}
