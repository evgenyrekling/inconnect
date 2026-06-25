import { NextRequest, NextResponse } from "next/server";
import {
  calculateAutomationPotentialScore,
  getAutomationPotentialTier,
  getPassengerTier,
  getStrategicPriorityFromTier,
  normalizeAirportIataCode,
  normalizeAirportText,
  parseAirportYear,
  parsePassengerCount,
  type AutomationPotentialTier,
  type PassengerTier,
  type StrategicPriority,
} from "@/lib/airport-accounts";
import { getCsvValue, normalizeCsvHeader, parseCsvRows } from "@/lib/csv";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MasterAirportRow = {
  airportName: string;
  displayName: string;
  iataCode: string;
  icaoCode: string;
  ourairportsIdent: string;
  countryCode: string;
  countryName: string;
  regionCode: string;
  city: string;
  municipality: string;
  latitude: number | null;
  longitude: number | null;
  airportType: string;
  scheduledService: string;
  annualPassengers: number | null;
  passengerYear: number | null;
  passengerTier: PassengerTier;
  strategicPriority: StrategicPriority;
  automationPotentialScore: number | null;
  automationPotentialTier: AutomationPotentialTier;
  website: string;
  linkedinUrl: string;
  sourceIdentity: string;
  sourceTraffic: string;
  sourceUrl: string;
  automationScoreNotes: string;
  rowNumber: number;
};

type ExistingAirportAccount = {
  id: string;
  iata_code: string | null;
};

type ImportSummary = {
  belowFiveMillionPassengers: number;
  countries: number;
  created: number;
  duplicateIata: number;
  errors: string[];
  invalidIata: number;
  largeAirports: number;
  mediumAirports: number;
  megaHubs: number;
  missingTraffic: number;
  skipped: number;
  totalAirports: number;
  totalRows: number;
  updated: number;
};

const MASTER_AIRPORT_REQUIRED_COLUMNS = [
  "airport_name",
  "display_name",
  "iata_code",
  "icao_code",
  "ourairports_ident",
  "country_code",
  "country_name",
  "region_code",
  "city",
  "municipality",
  "latitude",
  "longitude",
  "airport_type",
  "scheduled_service",
  "annual_passengers",
  "passenger_year",
  "passenger_tier",
  "strategic_priority",
  "automation_potential_score",
  "automation_potential_tier",
  "website",
  "linkedin_url",
  "source_identity",
  "source_traffic",
  "source_url",
];
const MASTER_AIRPORT_BATCH_SIZE = 400;

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const adminEmail = normalizeEmail(String(formData?.get("adminEmail") ?? ""));
  const allowUnknownTraffic = String(formData?.get("allowUnknownTraffic") ?? "") === "true";

  if (!isAdminEmail(adminEmail)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const csvFile = formData?.get("file");
  if (!(csvFile instanceof File)) {
    return NextResponse.json(
      { error: "inconnect_airports_master.csv is required." },
      { status: 400 },
    );
  }

  try {
    const parsed = parseMasterAirportCsv(await csvFile.text());
    if (parsed.missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: "Master CSV is missing required columns.",
          details: parsed.missingColumns.join(", "),
        },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdminClient();
    const seenIataCodes = new Set<string>();
    const rowsToImport: MasterAirportRow[] = [];
    const rowErrors: string[] = [];
    const skipped = {
      belowFiveMillionPassengers: 0,
      duplicateIata: 0,
      invalidIata: 0,
      missingTraffic: 0,
    };

    for (const row of parsed.rows) {
      const validation = validateMasterAirportRow(row, {
        allowUnknownTraffic,
        seenIataCodes,
      });

      if (!validation.importable) {
        skipped[validation.reason] += 1;
        if (validation.reason === "invalidIata") {
          rowErrors.push(`Row ${row.rowNumber}: invalid or missing iata_code`);
        }
        continue;
      }

      seenIataCodes.add(row.iataCode);
      rowsToImport.push(row);
    }

    const existingAccounts = await getExistingAirportAccounts(
      supabase,
      rowsToImport.map((row) => row.iataCode),
    );
    const summary: ImportSummary = {
      belowFiveMillionPassengers: skipped.belowFiveMillionPassengers,
      countries: new Set(rowsToImport.map((row) => row.countryCode).filter(Boolean)).size,
      created: 0,
      duplicateIata: skipped.duplicateIata,
      errors: rowErrors,
      invalidIata: skipped.invalidIata,
      largeAirports: countTier(rowsToImport, "large_airport"),
      mediumAirports: countTier(rowsToImport, "medium_airport"),
      megaHubs: countTier(rowsToImport, "mega_hub"),
      missingTraffic: skipped.missingTraffic,
      skipped: Object.values(skipped).reduce((total, count) => total + count, 0),
      totalAirports: rowsToImport.length,
      totalRows: parsed.rows.length,
      updated: 0,
    };
    const createPayloads: Record<string, unknown>[] = [];
    const updateJobs: { id: string; payload: Record<string, unknown> }[] = [];

    for (const row of rowsToImport) {
      const existingAccount = existingAccounts.get(row.iataCode);
      const payload = createMasterAirportPayload(row, Boolean(existingAccount));

      if (existingAccount) {
        updateJobs.push({ id: existingAccount.id, payload });
      } else {
        createPayloads.push(payload);
      }
    }

    for (const payloadChunk of chunkArray(createPayloads, MASTER_AIRPORT_BATCH_SIZE)) {
      if (payloadChunk.length === 0) continue;
      const { error } = await supabase.from("accounts").insert(payloadChunk);
      if (error) {
        console.error("MASTER AIRPORT INSERT ERROR", error);
        summary.errors.push(`Insert failed: ${error.message}`);
      } else {
        summary.created += payloadChunk.length;
      }
    }

    for (const updateJob of updateJobs) {
      const { error } = await supabase
        .from("accounts")
        .update(updateJob.payload)
        .eq("id", updateJob.id);

      if (error) {
        console.error("MASTER AIRPORT UPDATE ERROR", {
          accountId: updateJob.id,
          error,
        });
        summary.errors.push(
          `Update failed for ${String(updateJob.payload.iata_code)}: ${error.message}`,
        );
      } else {
        summary.updated += 1;
      }
    }

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("MASTER AIRPORT IMPORT FAILED", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Strategic airport master CSV could not be imported.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | { adminEmail?: string }
    | null;
  const adminEmail = normalizeEmail(String(payload?.adminEmail ?? ""));

  if (!isAdminEmail(adminEmail)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("accounts")
      .delete()
      .eq("account_type", "airport")
      .eq("is_seeded", true)
      .eq("status", "prospect")
      .select("id");

    if (error) {
      console.error("CLEAR IMPORTED TEST AIRPORTS ERROR", error);
      return NextResponse.json(
        {
          details: error.message,
          error: "Imported test airports could not be cleared.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      deleted: data?.length ?? 0,
      success: true,
    });
  } catch (error) {
    console.error("CLEAR IMPORTED TEST AIRPORTS FAILED", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Imported test airports could not be cleared.",
      },
      { status: 500 },
    );
  }
}

function parseMasterAirportCsv(csvText: string) {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return { missingColumns: MASTER_AIRPORT_REQUIRED_COLUMNS, rows: [] };
  }

  const header = rows[0].map(normalizeCsvHeader);
  const missingColumns = MASTER_AIRPORT_REQUIRED_COLUMNS.filter(
    (column) => !header.includes(column),
  );

  if (missingColumns.length > 0) return { missingColumns, rows: [] };

  return {
    missingColumns,
    rows: rows.slice(1).flatMap((row, index): MasterAirportRow[] => {
      if (row.every((cell) => !cell.trim())) return [];
      return [parseMasterAirportRow(row, header, index + 2)];
    }),
  };
}

function parseMasterAirportRow(
  row: string[],
  header: string[],
  rowNumber: number,
): MasterAirportRow {
  const parsedAnnualPassengers = parsePassengerCount(
    getCsvValue(row, header, "annual_passengers"),
  );
  const annualPassengers =
    typeof parsedAnnualPassengers === "number" &&
    Number.isFinite(parsedAnnualPassengers) &&
    parsedAnnualPassengers > 0
      ? parsedAnnualPassengers
      : null;
  const providedPassengerTier =
    annualPassengers === null
      ? null
      : normalizePassengerTierInput(getCsvValue(row, header, "passenger_tier"));
  const passengerTier = providedPassengerTier ?? getPassengerTier(annualPassengers);
  const providedStrategicPriority =
    annualPassengers === null
      ? null
      : normalizeStrategicPriorityInput(getCsvValue(row, header, "strategic_priority"));
  const strategicPriority =
    providedStrategicPriority ?? getStrategicPriorityFromTier(passengerTier);
  const automationScore = parseAutomationScore(
    getCsvValue(row, header, "automation_potential_score"),
  );
  const calculatedAutomation = calculateAutomationPotentialScore({
    airportType: getCsvValue(row, header, "airport_type"),
    annualPassengers,
    passengerTier,
    strategicPriority,
  });
  const finalAutomationScore = automationScore ?? calculatedAutomation.score;
  const providedAutomationTier = normalizeAutomationTierInput(
    getCsvValue(row, header, "automation_potential_tier"),
  );
  const automationPotentialTier =
    providedAutomationTier ?? getAutomationPotentialTier(finalAutomationScore);

  return {
    airportName: normalizeAirportText(getCsvValue(row, header, "airport_name"), 240),
    airportType: normalizeAirportText(getCsvValue(row, header, "airport_type"), 80),
    annualPassengers,
    automationPotentialScore: finalAutomationScore,
    automationPotentialTier,
    automationScoreNotes:
      automationScore === null
        ? calculatedAutomation.notes
        : "Initial INConnect automation potential estimate imported from inconnect_airports_master.csv.",
    city: normalizeAirportText(getCsvValue(row, header, "city"), 180),
    countryCode: normalizeAirportText(getCsvValue(row, header, "country_code"), 8).toUpperCase(),
    countryName: normalizeAirportText(getCsvValue(row, header, "country_name"), 160),
    displayName:
      normalizeAirportText(getCsvValue(row, header, "display_name"), 240) ||
      normalizeAirportText(getCsvValue(row, header, "airport_name"), 240),
    iataCode: normalizeAirportIataCode(getCsvValue(row, header, "iata_code")),
    icaoCode: normalizeAirportText(getCsvValue(row, header, "icao_code"), 12).toUpperCase(),
    latitude: parseCoordinate(getCsvValue(row, header, "latitude")),
    linkedinUrl: normalizeAirportText(getCsvValue(row, header, "linkedin_url"), 500),
    longitude: parseCoordinate(getCsvValue(row, header, "longitude")),
    municipality: normalizeAirportText(getCsvValue(row, header, "municipality"), 180),
    ourairportsIdent: normalizeAirportText(getCsvValue(row, header, "ourairports_ident"), 80),
    passengerTier,
    passengerYear: parseAirportYear(getCsvValue(row, header, "passenger_year")),
    regionCode: normalizeAirportText(getCsvValue(row, header, "region_code"), 40),
    rowNumber,
    scheduledService: normalizeAirportText(getCsvValue(row, header, "scheduled_service"), 20).toLowerCase(),
    sourceIdentity: normalizeAirportText(getCsvValue(row, header, "source_identity"), 240),
    sourceTraffic: normalizeAirportText(getCsvValue(row, header, "source_traffic"), 240),
    sourceUrl: normalizeAirportText(getCsvValue(row, header, "source_url"), 500),
    strategicPriority,
    website: normalizeAirportText(getCsvValue(row, header, "website"), 500),
  };
}

function createMasterAirportPayload(row: MasterAirportRow, isExistingAccount: boolean) {
  const payload: Record<string, unknown> = {
    account_type: "airport",
    airport_type: row.airportType || null,
    annual_passengers: row.annualPassengers,
    automation_potential_score: row.automationPotentialScore,
    automation_potential_tier: row.automationPotentialTier,
    automation_score_notes: row.automationScoreNotes,
    city: row.city || row.municipality || null,
    country_code: row.countryCode || null,
    country_name: row.countryName || row.countryCode || null,
    display_name: row.displayName || row.airportName,
    iata_code: row.iataCode,
    icao_code: row.icaoCode || null,
    is_active: true,
    is_seeded: true,
    latitude: row.latitude,
    linkedin_url: row.linkedinUrl || null,
    longitude: row.longitude,
    municipality: row.municipality || null,
    name: row.airportName || row.displayName,
    ourairports_ident: row.ourairportsIdent || null,
    passenger_tier: row.passengerTier,
    passenger_year: row.passengerYear,
    region_code: row.regionCode || null,
    scheduled_service: row.scheduledService || null,
    source_identity: row.sourceIdentity || "inconnect_airports_master.csv",
    source_traffic: row.sourceTraffic || null,
    source_url: row.sourceUrl || null,
    strategic_priority: row.strategicPriority,
    updated_at: new Date().toISOString(),
    website: row.website || null,
  };

  if (!isExistingAccount) {
    payload.created_at = new Date().toISOString();
    payload.status = "prospect";
  }

  return payload;
}

function validateMasterAirportRow(
  row: MasterAirportRow,
  {
    allowUnknownTraffic,
    seenIataCodes,
  }: {
    allowUnknownTraffic: boolean;
    seenIataCodes: Set<string>;
  },
):
  | { importable: true }
  | {
      importable: false;
      reason:
        | "belowFiveMillionPassengers"
        | "duplicateIata"
        | "invalidIata"
        | "missingTraffic";
    } {
  if (!isValidIataCode(row.iataCode)) {
    return { importable: false, reason: "invalidIata" };
  }

  if (seenIataCodes.has(row.iataCode)) {
    return { importable: false, reason: "duplicateIata" };
  }

  if (
    row.annualPassengers === null ||
    !Number.isFinite(row.annualPassengers) ||
    row.annualPassengers <= 0
  ) {
    return allowUnknownTraffic
      ? { importable: true }
      : { importable: false, reason: "missingTraffic" };
  }

  if (row.annualPassengers < 5_000_000) {
    return { importable: false, reason: "belowFiveMillionPassengers" };
  }

  return { importable: true };
}

async function getExistingAirportAccounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  iataCodes: string[],
) {
  const existingAccounts = new Map<string, ExistingAirportAccount>();
  const uniqueIataCodes = Array.from(new Set(iataCodes.filter(Boolean)));

  for (const iataChunk of chunkArray(uniqueIataCodes, MASTER_AIRPORT_BATCH_SIZE)) {
    if (iataChunk.length === 0) continue;
    const { data, error } = await supabase
      .from("accounts")
      .select("id, iata_code")
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

function countTier(airports: MasterAirportRow[], tier: PassengerTier) {
  return airports.filter((airport) => airport.passengerTier === tier).length;
}

function normalizePassengerTierInput(value: string) {
  const normalizedValue = normalizeAirportText(value, 80)
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z_]/g, "");
  if (
    normalizedValue === "mega_hub" ||
    normalizedValue === "large_airport" ||
    normalizedValue === "medium_airport" ||
    normalizedValue === "unknown"
  ) {
    return normalizedValue as PassengerTier;
  }

  return null;
}

function normalizeStrategicPriorityInput(value: string) {
  const normalizedValue = normalizeAirportText(value, 80).toLowerCase();
  if (
    normalizedValue === "strategic" ||
    normalizedValue === "high" ||
    normalizedValue === "medium" ||
    normalizedValue === "unrated"
  ) {
    return normalizedValue as StrategicPriority;
  }

  return null;
}

function normalizeAutomationTierInput(value: string) {
  const normalizedValue = normalizeAirportText(value, 80)
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z_]/g, "");
  if (
    normalizedValue === "very_high" ||
    normalizedValue === "high" ||
    normalizedValue === "medium" ||
    normalizedValue === "low" ||
    normalizedValue === "very_low" ||
    normalizedValue === "unknown"
  ) {
    return normalizedValue as AutomationPotentialTier;
  }

  return null;
}

function parseAutomationScore(value: string) {
  const score = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(score)) return null;
  return Math.min(100, Math.max(0, score));
}

function isValidIataCode(value: string) {
  return /^[A-Z0-9]{3}$/.test(value);
}

function parseCoordinate(value: string) {
  const coordinate = Number.parseFloat(value.trim());
  return Number.isFinite(coordinate) ? coordinate : null;
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
