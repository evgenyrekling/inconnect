import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  attachProfessionalToCompany,
  deleteProfessionalCompanyLink,
} from "@/lib/professionals";

export const runtime = "nodejs";

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

    const link = await attachProfessionalToCompany({
      companyId,
      createdByEmail: body?.createdByEmail,
      department: body?.department,
      isPrimary: body?.isPrimary,
      notes: body?.notes,
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

    await deleteProfessionalCompanyLink(id);
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
