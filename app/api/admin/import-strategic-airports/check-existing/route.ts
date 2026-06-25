import { NextRequest, NextResponse } from "next/server";
import { normalizeAirportIataCode } from "@/lib/airport-accounts";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckExistingPayload = {
  adminEmail?: string;
  iataCodes?: string[];
};

const CHECK_EXISTING_BATCH_SIZE = 400;

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | CheckExistingPayload
    | null;
  const adminEmail = normalizeEmail(String(payload?.adminEmail ?? ""));

  if (!isAdminEmail(adminEmail)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const iataCodes = Array.from(
    new Set(
      (payload?.iataCodes ?? [])
        .map((iataCode) => normalizeAirportIataCode(String(iataCode)))
        .filter((iataCode) => /^[A-Z0-9]{3}$/.test(iataCode)),
    ),
  );

  if (iataCodes.length === 0) {
    return NextResponse.json({ existingIataCodes: [], success: true });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const existingIataCodes = new Set<string>();

    for (const iataChunk of chunkArray(iataCodes, CHECK_EXISTING_BATCH_SIZE)) {
      const { data, error } = await supabase
        .from("accounts")
        .select("iata_code")
        .eq("account_type", "airport")
        .in("iata_code", iataChunk)
        .returns<{ iata_code: string | null }[]>();

      if (error) throw new Error(error.message);

      for (const account of data ?? []) {
        if (account.iata_code) existingIataCodes.add(account.iata_code);
      }
    }

    return NextResponse.json({
      existingIataCodes: Array.from(existingIataCodes).sort(),
      success: true,
    });
  } catch (error) {
    console.error("CHECK EXISTING AIRPORT IATA FAILED", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Existing airport accounts could not be checked.",
      },
      { status: 500 },
    );
  }
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isAdminEmail(email: string) {
  return getAdminEmails().includes(email);
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}
