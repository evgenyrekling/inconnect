import { NextRequest, NextResponse } from "next/server";
import {
  getPassengerTier,
  getStrategicPriorityFromTier,
  normalizeAirportIataCode,
  normalizeAirportText,
} from "@/lib/airport-accounts";
import { getCsvValue, normalizeCsvHeader, parseCsvRows } from "@/lib/csv";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AirportImportRow = {
  airportType: string;
  city: string;
  countryCode: string;
  countryName: string;
  homeLink: string;
  iataCode: string;
  icaoCode: string;
  latitude: number | null;
  longitude: number | null;
  municipality: string;
  name: string;
  ourairportsIdent: string;
  regionCode: string;
  rowNumber: number;
  scheduledService: string;
  wikipediaLink: string;
};

type ExistingAirportAccount = {
  id: string;
  iata_code: string | null;
  source_traffic: string | null;
  source_url: string | null;
};

type AirportImportSummary = {
  created: number;
  errors: string[];
  skipped: number;
  skippedByCountryFilter: number;
  skippedByImportRule: number;
  totalRows: number;
  updated: number;
};

const AIRPORT_IMPORT_BATCH_SIZE = 400;

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const adminEmail = normalizeEmail(String(formData?.get("adminEmail") ?? ""));

  if (!isAdminEmail(adminEmail)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const csvFile = formData?.get("file");
  if (!(csvFile instanceof File)) {
    return NextResponse.json({ error: "OurAirports airports.csv is required." }, { status: 400 });
  }

  try {
    const countryFilter = parseCountryFilter(String(formData?.get("countryCodes") ?? ""));
    const rows = parseOurAirportsCsv(await csvFile.text());
    const importableRows = rows.filter((row) => shouldImportAirport(row));
    const countryFilteredRows =
      countryFilter.size > 0
        ? importableRows.filter((row) => countryFilter.has(row.countryCode))
        : importableRows;
    const supabase = getSupabaseAdminClient();
    const existingAccounts = await getExistingAirportAccounts(
      supabase,
      countryFilteredRows.map((row) => row.iataCode),
    );
    const summary: AirportImportSummary = {
      created: 0,
      errors: [],
      skipped: rows.length - countryFilteredRows.length,
      skippedByCountryFilter: importableRows.length - countryFilteredRows.length,
      skippedByImportRule: rows.length - importableRows.length,
      totalRows: rows.length,
      updated: 0,
    };
    const createPayloads: Record<string, unknown>[] = [];
    const updateJobs: { id: string; payload: Record<string, unknown> }[] = [];

    for (const row of countryFilteredRows) {
      const existingAccount = existingAccounts.get(row.iataCode);
      const payload = createAirportAccountPayload(row, existingAccount);

      if (existingAccount) {
        updateJobs.push({ id: existingAccount.id, payload });
      } else {
        createPayloads.push(payload);
      }
    }

    for (const payloadChunk of chunkArray(createPayloads, AIRPORT_IMPORT_BATCH_SIZE)) {
      if (payloadChunk.length === 0) continue;
      const { error } = await supabase.from("accounts").insert(payloadChunk);
      if (error) {
        console.error("AIRPORT IMPORT INSERT ERROR", error);
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
        console.error("AIRPORT IMPORT UPDATE ERROR", {
          accountId: updateJob.id,
          error,
        });
        summary.errors.push(`Update failed for ${String(updateJob.payload.iata_code)}: ${error.message}`);
      } else {
        summary.updated += 1;
      }
    }

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("AIRPORT IMPORT FAILED", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Airport accounts could not be imported.",
      },
      { status: 500 },
    );
  }
}

function parseOurAirportsCsv(csvText: string) {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return [];

  const header = rows[0].map(normalizeCsvHeader);
  const dataRows = rows.slice(1);

  return dataRows.flatMap((row, index): AirportImportRow[] => {
    if (row.every((cell) => !cell.trim())) return [];
    const iataCode = normalizeAirportIataCode(getCsvValue(row, header, "iata_code"));
    const countryCode = normalizeAirportText(getCsvValue(row, header, "iso_country"), 8).toUpperCase();
    const municipality = normalizeAirportText(getCsvValue(row, header, "municipality"), 180);
    const ourairportsIdent = normalizeAirportText(getCsvValue(row, header, "ident"), 80);

    return [
      {
        airportType: normalizeAirportText(getCsvValue(row, header, "type"), 80),
        city: municipality,
        countryCode,
        countryName: getCountryName(countryCode),
        homeLink: normalizeAirportText(getCsvValue(row, header, "home_link"), 500),
        iataCode,
        icaoCode:
          normalizeAirportText(getCsvValue(row, header, "gps_code"), 12).toUpperCase() ||
          inferIcaoCode(ourairportsIdent),
        latitude: parseCoordinate(getCsvValue(row, header, "latitude_deg")),
        longitude: parseCoordinate(getCsvValue(row, header, "longitude_deg")),
        municipality,
        name: normalizeAirportText(getCsvValue(row, header, "name"), 240),
        ourairportsIdent,
        regionCode: normalizeAirportText(getCsvValue(row, header, "iso_region"), 40),
        rowNumber: index + 2,
        scheduledService: normalizeAirportText(getCsvValue(row, header, "scheduled_service"), 20).toLowerCase(),
        wikipediaLink: normalizeAirportText(getCsvValue(row, header, "wikipedia_link"), 500),
      },
    ];
  });
}

function shouldImportAirport(row: AirportImportRow) {
  return (
    Boolean(row.iataCode) &&
    row.scheduledService === "yes" &&
    (row.airportType === "large_airport" || row.airportType === "medium_airport")
  );
}

function createAirportAccountPayload(
  row: AirportImportRow,
  existingAccount?: ExistingAirportAccount,
) {
  const passengerTier = getPassengerTier(null);
  const payload: Record<string, unknown> = {
    account_type: "airport",
    airport_type: row.airportType,
    city: row.city || row.municipality || null,
    country_code: row.countryCode || null,
    country_name: row.countryName || row.countryCode || null,
    display_name: row.name,
    iata_code: row.iataCode,
    icao_code: row.icaoCode || null,
    is_active: true,
    is_seeded: true,
    latitude: row.latitude,
    longitude: row.longitude,
    municipality: row.municipality || null,
    name: row.name,
    ourairports_ident: row.ourairportsIdent || null,
    region_code: row.regionCode || null,
    scheduled_service: row.scheduledService,
    source_identity: "OurAirports airports.csv",
    updated_at: new Date().toISOString(),
  };

  if (!existingAccount) {
    payload.annual_passengers = null;
    payload.automation_potential_score = null;
    payload.automation_potential_tier = "unknown";
    payload.automation_score_notes =
      "Initial INConnect automation potential estimate. Passenger traffic is missing; upload traffic enrichment to calculate score.";
    payload.created_at = new Date().toISOString();
    payload.passenger_year = null;
    payload.passenger_tier = passengerTier;
    payload.source_traffic = null;
    payload.source_url = getOurAirportsSourceUrl(row);
    payload.status = "prospect";
    payload.strategic_priority = getStrategicPriorityFromTier(passengerTier);
  } else if (!existingAccount.source_url && !existingAccount.source_traffic) {
    payload.source_url = getOurAirportsSourceUrl(row);
  }

  return payload;
}

async function getExistingAirportAccounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  iataCodes: string[],
) {
  const existingAccounts = new Map<string, ExistingAirportAccount>();
  const uniqueIataCodes = Array.from(new Set(iataCodes.filter(Boolean)));

  for (const iataChunk of chunkArray(uniqueIataCodes, AIRPORT_IMPORT_BATCH_SIZE)) {
    if (iataChunk.length === 0) continue;
    const { data, error } = await supabase
      .from("accounts")
      .select("id, iata_code, source_traffic, source_url")
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

function parseCountryFilter(value: string) {
  return new Set(
    value
      .split(",")
      .map((item) => normalizeAirportText(item, 8).toUpperCase())
      .filter(Boolean),
  );
}

function getOurAirportsSourceUrl(row: AirportImportRow) {
  if (row.homeLink) return row.homeLink;
  if (row.wikipediaLink) return row.wikipediaLink;
  if (row.ourairportsIdent) {
    return `https://ourairports.com/airports/${encodeURIComponent(row.ourairportsIdent)}/`;
  }
  return "https://ourairports.com/data/";
}

function getCountryName(countryCode: string) {
  if (!countryCode) return "";
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return displayNames.of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}

function inferIcaoCode(ident: string) {
  const normalizedIdent = ident.trim().toUpperCase();
  return /^[A-Z]{4}$/.test(normalizedIdent) ? normalizedIdent : "";
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
