import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getVerifiedInconnectUserFromRequest } from "@/lib/auth-server";
import {
  checkCompanyDuplicates,
  createManualCompanyAccount,
  type CompanyAccountInput,
} from "@/lib/company-accounts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const owner = await getVerifiedInconnectUserFromRequest(request);
    if (!owner) {
      return NextResponse.json(
        { error: "Verified email sign-in is required." },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | (CompanyAccountInput & {
          checkOnly?: boolean;
          createAnyway?: boolean;
        })
      | null;

    if (!body) {
      return NextResponse.json({ error: "Company payload is required." }, { status: 400 });
    }

    const duplicates = await checkCompanyDuplicates(body);
    if (body.checkOnly) {
      return NextResponse.json({ duplicates });
    }

    if (duplicates.exactDuplicate) {
      return NextResponse.json(
        {
          duplicateType: "exact",
          duplicates,
          error: "A company with this website or LinkedIn URL already exists.",
        },
        { status: 409 },
      );
    }

    if (duplicates.possibleDuplicates.length > 0 && !body.createAnyway) {
      return NextResponse.json(
        {
          duplicateType: "possible",
          duplicates,
          error: "Possible duplicate found.",
        },
        { status: 409 },
      );
    }

    const company = await createManualCompanyAccount({
      createdByEmail: owner.email,
      createdByUserId: owner.userId,
      input: body,
    });

    revalidatePath("/network/accounts");
    revalidatePath("/network/accounts/airports");
    revalidatePath(`/network/companies/${company.id}`);

    return NextResponse.json({
      company,
      message: `${company.displayName} created successfully.`,
      url: `/network/companies/${company.id}`,
    });
  } catch (error) {
    console.error("Manual company creation failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Company could not be created.",
      },
      { status: 500 },
    );
  }
}
