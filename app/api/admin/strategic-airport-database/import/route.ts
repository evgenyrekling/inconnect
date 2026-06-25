import { NextRequest, NextResponse } from "next/server";
import {
  calculateAutomationPotentialScore,
  getPassengerTier,
  getStrategicPriorityFromTier,
  normalizeAirportIataCode,
  normalizeAirportText,
  parseAirportYear,
  parsePassengerCount,
  type PassengerTier,
} from "@/lib/airport-accounts";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StrategicAirportImportInput = {
  adminEmail?: string;
  airports?: StrategicAirportInput[];
};

type StrategicAirportInput = {
  airportType?: string;
  city?: string;
  countryCode?: string;
  countryName?: string;
  iataCode?: string;
  icaoCode?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  municipality?: string;
  name?: string;
  ourairportsIdent?: string;
  passengerYear?: number | string | null;
  regionCode?: string;
  scheduledService?: string;
  sourceTraffic?: string;
  sourceUrl?: string;
  annualPassengers?: number | string | null;
};

type ExistingAirportAccount = {
  id: string;
  iata_code: string | null;
  status: string | null;
};

type StrategicAirportImportSummary = {
  countries: number;
  created: number;
  errors: string[];
  largeAirports: number;
  mediumAirports: number;
  megaHubs: number;
  highAutomationPotential: number;
  missingPassengerData: number;
  recalculatedScores: number;
  skipped: number;
  totalReceived: number;
  totalImported: number;
  updated: number;
  veryHighAutomationPotential: number;
};

const STRATEGIC_AIRPORT_BATCH_SIZE = 400;
const MIN_STRATEGIC_PASSENGERS = 5_000_000;

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | StrategicAirportImportInput
    | null;
  const adminEmail = normalizeEmail(String(payload?.adminEmail ?? ""));

  if (!isAdminEmail(adminEmail)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const airportInputs = Array.isArray(payload?.airports) ? payload.airports : [];
  if (airportInputs.length === 0) {
    return NextResponse.json(
      { error: "At least one merged airport record is required." },
      { status: 400 },
    );
  }

  try {
    const airports = airportInputs.map(normalizeStrategicAirportInput);
    const validAirports = airports.filter(isStrategicAirportImportable);
    const supabase = getSupabaseAdminClient();
    const existingAccounts = await getExistingAirportAccounts(
      supabase,
      validAirports.map((airport) => airport.iataCode),
    );
    const summary: StrategicAirportImportSummary = {
      countries: new Set(validAirports.map((airport) => airport.countryCode).filter(Boolean)).size,
      created: 0,
      errors: [],
      highAutomationPotential: 0,
      largeAirports: countTier(validAirports, "large_airport"),
      mediumAirports: countTier(validAirports, "medium_airport"),
      megaHubs: countTier(validAirports, "mega_hub"),
      missingPassengerData: airports.filter((airport) => airport.annualPassengers === null).length,
      recalculatedScores: 0,
      skipped: airports.length - validAirports.length,
      totalReceived: airports.length,
      totalImported: 0,
      updated: 0,
      veryHighAutomationPotential: 0,
    };
    const createPayloads: Record<string, unknown>[] = [];
    const updateJobs: { id: string; payload: Record<string, unknown> }[] = [];

    for (const airport of validAirports) {
      const existingAccount = existingAccounts.get(airport.iataCode);
      const accountPayload = createStrategicAirportPayload(airport, Boolean(existingAccount));

      if (existingAccount) {
        updateJobs.push({ id: existingAccount.id, payload: accountPayload });
      } else {
        createPayloads.push(accountPayload);
      }
    }

    for (const payloadChunk of chunkArray(createPayloads, STRATEGIC_AIRPORT_BATCH_SIZE)) {
      if (payloadChunk.length === 0) continue;
      const { error } = await supabase.from("accounts").insert(payloadChunk);
      if (error) {
        console.error("STRATEGIC AIRPORT INSERT ERROR", error);
        summary.errors.push(`Insert failed: ${error.message}`);
      } else {
        summary.created += payloadChunk.length;
        for (const payload of payloadChunk) {
          countAutomationTier(summary, String(payload.automation_potential_tier ?? ""));
        }
        summary.recalculatedScores += payloadChunk.length;
      }
    }

    for (const updateJob of updateJobs) {
      const { error } = await supabase
        .from("accounts")
        .update(updateJob.payload)
        .eq("id", updateJob.id);

      if (error) {
        console.error("STRATEGIC AIRPORT UPDATE ERROR", {
          accountId: updateJob.id,
          error,
        });
        summary.errors.push(
          `Update failed for ${String(updateJob.payload.iata_code)}: ${error.message}`,
        );
      } else {
        countAutomationTier(
          summary,
          String(updateJob.payload.automation_potential_tier ?? ""),
        );
        summary.recalculatedScores += 1;
        summary.updated += 1;
      }
    }

    summary.totalImported = summary.created + summary.updated;

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("STRATEGIC AIRPORT IMPORT FAILED", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Strategic Airport Database import failed.",
      },
      { status: 500 },
    );
  }
}

function normalizeStrategicAirportInput(input: StrategicAirportInput) {
  const annualPassengers =
    typeof input.annualPassengers === "number"
      ? input.annualPassengers
      : parsePassengerCount(String(input.annualPassengers ?? ""));
  const passengerYear =
    typeof input.passengerYear === "number"
      ? input.passengerYear
      : parseAirportYear(String(input.passengerYear ?? ""));
  const iataCode = normalizeAirportIataCode(String(input.iataCode ?? ""));
  const passengerTier = getPassengerTier(annualPassengers);
  const countryCode = normalizeAirportText(String(input.countryCode ?? ""), 8).toUpperCase();

  return {
    annualPassengers,
    airportType: normalizeAirportText(String(input.airportType ?? ""), 80),
    city: normalizeAirportText(String(input.city ?? input.municipality ?? ""), 180),
    countryCode,
    countryName:
      normalizeAirportText(String(input.countryName ?? ""), 160) ||
      getCountryName(countryCode),
    iataCode,
    icaoCode: normalizeAirportText(String(input.icaoCode ?? ""), 12).toUpperCase(),
    latitude: parseNullableCoordinate(input.latitude),
    longitude: parseNullableCoordinate(input.longitude),
    municipality: normalizeAirportText(String(input.municipality ?? ""), 180),
    name: normalizeAirportText(String(input.name ?? ""), 240),
    ourairportsIdent: normalizeAirportText(String(input.ourairportsIdent ?? ""), 80),
    passengerTier,
    passengerYear,
    regionCode: normalizeAirportText(String(input.regionCode ?? ""), 40),
    scheduledService: normalizeAirportText(String(input.scheduledService ?? ""), 20).toLowerCase(),
    sourceTraffic: normalizeAirportText(String(input.sourceTraffic ?? ""), 240),
    sourceUrl: normalizeAirportText(String(input.sourceUrl ?? ""), 500),
    strategicPriority: getStrategicPriorityFromTier(passengerTier),
  };
}

function isStrategicAirportImportable(
  airport: ReturnType<typeof normalizeStrategicAirportInput>,
) {
  return (
    Boolean(airport.iataCode) &&
    airport.scheduledService === "yes" &&
    (airport.airportType === "large_airport" || airport.airportType === "medium_airport") &&
    typeof airport.annualPassengers === "number" &&
    airport.annualPassengers >= MIN_STRATEGIC_PASSENGERS
  );
}

function createStrategicAirportPayload(
  airport: ReturnType<typeof normalizeStrategicAirportInput>,
  isExistingAccount: boolean,
) {
  const automationPotential = calculateAutomationPotentialScore({
    airportType: airport.airportType,
    annualPassengers: airport.annualPassengers,
    passengerTier: airport.passengerTier,
    strategicPriority: airport.strategicPriority,
  });
  const payload: Record<string, unknown> = {
    account_type: "airport",
    airport_type: airport.airportType,
    annual_passengers: airport.annualPassengers,
    automation_potential_score: automationPotential.score,
    automation_potential_tier: automationPotential.tier,
    automation_score_notes: automationPotential.notes,
    city: airport.city || airport.municipality || null,
    country_code: airport.countryCode || null,
    country_name: airport.countryName || airport.countryCode || null,
    display_name: airport.name,
    iata_code: airport.iataCode,
    icao_code: airport.icaoCode || null,
    is_active: true,
    is_seeded: true,
    latitude: airport.latitude,
    longitude: airport.longitude,
    municipality: airport.municipality || null,
    name: airport.name,
    ourairports_ident: airport.ourairportsIdent || null,
    passenger_tier: airport.passengerTier,
    passenger_year: airport.passengerYear,
    region_code: airport.regionCode || null,
    scheduled_service: airport.scheduledService,
    source_identity: "OurAirports airports.csv",
    source_traffic: airport.sourceTraffic || null,
    source_url: airport.sourceUrl || null,
    strategic_priority: airport.strategicPriority,
    updated_at: new Date().toISOString(),
  };

  if (!isExistingAccount) {
    payload.created_at = new Date().toISOString();
    payload.status = "prospect";
  }

  return payload;
}

function countAutomationTier(
  summary: StrategicAirportImportSummary,
  automationTier: string,
) {
  if (automationTier === "very_high") summary.veryHighAutomationPotential += 1;
  if (automationTier === "high") summary.highAutomationPotential += 1;
}

async function getExistingAirportAccounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  iataCodes: string[],
) {
  const existingAccounts = new Map<string, ExistingAirportAccount>();
  const uniqueIataCodes = Array.from(new Set(iataCodes.filter(Boolean)));

  for (const iataChunk of chunkArray(uniqueIataCodes, STRATEGIC_AIRPORT_BATCH_SIZE)) {
    if (iataChunk.length === 0) continue;
    const { data, error } = await supabase
      .from("accounts")
      .select("id, iata_code, status")
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

function countTier(
  airports: ReturnType<typeof normalizeStrategicAirportInput>[],
  tier: PassengerTier,
) {
  return airports.filter((airport) => airport.passengerTier === tier).length;
}

function parseNullableCoordinate(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const coordinate = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(coordinate) ? coordinate : null;
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
