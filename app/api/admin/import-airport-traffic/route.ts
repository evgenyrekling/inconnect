import { NextRequest, NextResponse } from "next/server";
import {
  calculateAutomationPotentialScore,
  getPassengerTier,
  getStrategicPriorityFromTier,
  normalizeAirportIataCode,
  normalizeAirportText,
  parseAirportYear,
  parsePassengerCount,
} from "@/lib/airport-accounts";
import { getCsvValue, normalizeCsvHeader, parseCsvRows } from "@/lib/csv";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AirportTrafficRow = {
  annualPassengers: number | null;
  iataCode: string;
  passengerYear: number | null;
  rowNumber: number;
  sourceTraffic: string;
  sourceUrl: string;
};

type ExistingAirportAccount = {
  airport_type: string | null;
  id: string;
  iata_code: string | null;
};

type AirportTrafficImportSummary = {
  errors: string[];
  highAutomationPotential: number;
  invalidRows: number;
  missingPassengerData: number;
  recalculatedScores: number;
  totalRows: number;
  unmatchedIataCodes: string[];
  updated: number;
  veryHighAutomationPotential: number;
};

const AIRPORT_TRAFFIC_BATCH_SIZE = 400;

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const adminEmail = normalizeEmail(String(formData?.get("adminEmail") ?? ""));

  if (!isAdminEmail(adminEmail)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const csvFile = formData?.get("file");
  if (!(csvFile instanceof File)) {
    return NextResponse.json({ error: "Airport traffic CSV is required." }, { status: 400 });
  }

  try {
    const rows = parseAirportTrafficCsv(await csvFile.text());
    const supabase = getSupabaseAdminClient();
    const existingAccounts = await getExistingAirportAccounts(
      supabase,
      rows.map((row) => row.iataCode),
    );
    const summary: AirportTrafficImportSummary = {
      errors: [],
      highAutomationPotential: 0,
      invalidRows: 0,
      missingPassengerData: 0,
      recalculatedScores: 0,
      totalRows: rows.length,
      unmatchedIataCodes: [],
      updated: 0,
      veryHighAutomationPotential: 0,
    };
    const unmatchedIataCodes = new Set<string>();

    for (const row of rows) {
      if (!row.iataCode || row.annualPassengers === null) {
        summary.invalidRows += 1;
        continue;
      }

      const existingAccount = existingAccounts.get(row.iataCode);
      if (!existingAccount) {
        unmatchedIataCodes.add(row.iataCode);
        continue;
      }

      const passengerTier = getPassengerTier(row.annualPassengers);
      const strategicPriority = getStrategicPriorityFromTier(passengerTier);
      const automationPotential = calculateAutomationPotentialScore({
        airportType: existingAccount.airport_type,
        annualPassengers: row.annualPassengers,
        passengerTier,
        strategicPriority,
      });
      const { error } = await supabase
        .from("accounts")
        .update({
          annual_passengers: row.annualPassengers,
          automation_potential_score: automationPotential.score,
          automation_potential_tier: automationPotential.tier,
          automation_score_notes: automationPotential.notes,
          passenger_tier: passengerTier,
          passenger_year: row.passengerYear,
          source_traffic: row.sourceTraffic || null,
          source_url: row.sourceUrl || null,
          strategic_priority: strategicPriority,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAccount.id);

      if (error) {
        console.error("AIRPORT TRAFFIC UPDATE ERROR", {
          error,
          iataCode: row.iataCode,
        });
        summary.errors.push(`${row.iataCode}: ${error.message}`);
      } else {
        summary.recalculatedScores += 1;
        if (automationPotential.tier === "very_high") {
          summary.veryHighAutomationPotential += 1;
        }
        if (automationPotential.tier === "high") {
          summary.highAutomationPotential += 1;
        }
        summary.updated += 1;
      }
    }

    summary.missingPassengerData = summary.invalidRows;
    summary.unmatchedIataCodes = Array.from(unmatchedIataCodes).sort();

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("AIRPORT TRAFFIC IMPORT FAILED", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Airport traffic could not be imported.",
      },
      { status: 500 },
    );
  }
}

function parseAirportTrafficCsv(csvText: string) {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return [];

  const header = rows[0].map(normalizeTrafficHeader);
  const dataRows = rows.slice(1);

  return dataRows.flatMap((row, index): AirportTrafficRow[] => {
    if (row.every((cell) => !cell.trim())) return [];

    return [
      {
        annualPassengers: parsePassengerCount(
          getCsvValue(row, header, "annual_passengers"),
        ),
        iataCode: normalizeAirportIataCode(getCsvValue(row, header, "iata_code")),
        passengerYear: parseAirportYear(getCsvValue(row, header, "passenger_year")),
        rowNumber: index + 2,
        sourceTraffic: normalizeAirportText(getCsvValue(row, header, "source_traffic"), 240),
        sourceUrl: normalizeAirportText(getCsvValue(row, header, "source_url"), 500),
      },
    ];
  });
}

async function getExistingAirportAccounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  iataCodes: string[],
) {
  const existingAccounts = new Map<string, ExistingAirportAccount>();
  const uniqueIataCodes = Array.from(new Set(iataCodes.filter(Boolean)));

  for (const iataChunk of chunkArray(uniqueIataCodes, AIRPORT_TRAFFIC_BATCH_SIZE)) {
    if (iataChunk.length === 0) continue;
    const { data, error } = await supabase
      .from("accounts")
      .select("airport_type, id, iata_code")
      .eq("account_type", "airport")
      .in("iata_code", iataChunk)
      .returns<ExistingAirportAccount[]>();

    if (error) throw new Error(`Airport account lookup failed: ${error.message}`);

    for (const account of data ?? []) {
      if (account.iata_code) existingAccounts.set(account.iata_code, account);
    }
  }

  return existingAccounts;
}

function normalizeTrafficHeader(value: string) {
  const normalizedHeader = normalizeCsvHeader(value);
  const aliases: Record<string, string> = {
    annual_pax: "annual_passengers",
    annual_passenger_count: "annual_passengers",
    annual_passengers: "annual_passengers",
    iata: "iata_code",
    iata_code: "iata_code",
    passengers: "annual_passengers",
    pax: "annual_passengers",
    passenger_year: "passenger_year",
    source: "source_traffic",
    source_traffic: "source_traffic",
    source_url: "source_url",
    traffic_source: "source_traffic",
    url: "source_url",
    year: "passenger_year",
  };

  return aliases[normalizedHeader] ?? normalizedHeader;
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
