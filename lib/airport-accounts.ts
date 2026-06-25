import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type PassengerTier =
  | "mega_hub"
  | "large_airport"
  | "medium_airport"
  | "unknown";

export type StrategicPriority = "strategic" | "high" | "medium" | "unrated";

export type AccountStatus =
  | "support"
  | "prospect"
  | "customer"
  | "partner"
  | "competitor"
  | "inactive";

export type AirportAccount = {
  annualPassengers: number | null;
  airportType: string;
  city: string;
  countryCode: string;
  countryName: string;
  displayName: string;
  iataCode: string;
  icaoCode: string;
  id: string;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  municipality: string;
  name: string;
  notes: string;
  ourairportsIdent: string;
  passengerTier: PassengerTier;
  passengerYear: number | null;
  regionCode: string;
  scheduledService: string;
  sourceIdentity: string;
  sourceTraffic: string;
  sourceUrl: string;
  status: AccountStatus;
  strategicPriority: StrategicPriority;
  updatedAt: string;
};

type AirportAccountRow = {
  annual_passengers: number | null;
  airport_type: string | null;
  city: string | null;
  country_code: string | null;
  country_name: string | null;
  display_name: string | null;
  iata_code: string | null;
  icao_code: string | null;
  id: string;
  is_active: boolean | null;
  latitude: number | null;
  longitude: number | null;
  municipality: string | null;
  name: string | null;
  notes: string | null;
  ourairports_ident: string | null;
  passenger_tier: string | null;
  passenger_year: number | null;
  region_code: string | null;
  scheduled_service: string | null;
  source_identity: string | null;
  source_traffic: string | null;
  source_url: string | null;
  status: string | null;
  strategic_priority: string | null;
  updated_at: string | null;
};

export const PASSENGER_TIER_LABELS: Record<PassengerTier, string> = {
  large_airport: "Large Airport, 15M to 40M",
  medium_airport: "Medium Airport, 5M to 15M",
  mega_hub: "Mega Hub, 40M+",
  unknown: "Unknown, no traffic data",
};

export const STRATEGIC_PRIORITY_LABELS: Record<StrategicPriority, string> = {
  high: "High",
  medium: "Medium",
  strategic: "Strategic",
  unrated: "Unrated",
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  competitor: "Competitor",
  customer: "Customer",
  inactive: "Inactive",
  partner: "Partner",
  prospect: "Prospect",
  support: "Support",
};

const AIRPORT_ACCOUNT_SELECT = [
  "annual_passengers",
  "airport_type",
  "city",
  "country_code",
  "country_name",
  "display_name",
  "iata_code",
  "icao_code",
  "id",
  "is_active",
  "latitude",
  "longitude",
  "municipality",
  "name",
  "notes",
  "ourairports_ident",
  "passenger_tier",
  "passenger_year",
  "region_code",
  "scheduled_service",
  "source_identity",
  "source_traffic",
  "source_url",
  "status",
  "strategic_priority",
  "updated_at",
].join(", ");

export async function getAirportAccounts() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(AIRPORT_ACCOUNT_SELECT)
    .eq("account_type", "airport")
    .eq("is_active", true)
    .order("annual_passengers", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })
    .returns<AirportAccountRow[]>();

  if (error) {
    console.error("AIRPORT ACCOUNTS LOOKUP ERROR", error);
    return [];
  }

  return (data ?? []).map(mapAirportAccountRow);
}

export async function getAirportAccountByIata(iataCode: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(AIRPORT_ACCOUNT_SELECT)
    .eq("account_type", "airport")
    .eq("is_active", true)
    .eq("iata_code", normalizeAirportIataCode(iataCode))
    .limit(1)
    .maybeSingle<AirportAccountRow>();

  if (error) {
    console.error("AIRPORT ACCOUNT LOOKUP ERROR", {
      error,
      iataCode,
    });
    return null;
  }

  return data ? mapAirportAccountRow(data) : null;
}

export async function getAirportAccountById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(AIRPORT_ACCOUNT_SELECT)
    .eq("account_type", "airport")
    .eq("is_active", true)
    .eq("id", id)
    .limit(1)
    .maybeSingle<AirportAccountRow>();

  if (error) {
    console.error("AIRPORT ACCOUNT LOOKUP ERROR", {
      error,
      id,
    });
    return null;
  }

  return data ? mapAirportAccountRow(data) : null;
}

export function getPassengerTier(
  annualPassengers: number | null | undefined,
): PassengerTier {
  if (typeof annualPassengers !== "number" || !Number.isFinite(annualPassengers)) {
    return "unknown";
  }

  if (annualPassengers >= 40_000_000) return "mega_hub";
  if (annualPassengers >= 15_000_000) return "large_airport";
  if (annualPassengers >= 5_000_000) return "medium_airport";
  return "unknown";
}

export function getStrategicPriorityFromTier(
  passengerTier: PassengerTier,
): StrategicPriority {
  if (passengerTier === "mega_hub") return "strategic";
  if (passengerTier === "large_airport") return "high";
  if (passengerTier === "medium_airport") return "medium";
  return "unrated";
}

export function formatAirportPassengerCount(annualPassengers: number | null) {
  if (typeof annualPassengers !== "number" || !Number.isFinite(annualPassengers)) {
    return "No traffic data";
  }

  return `${new Intl.NumberFormat("en").format(annualPassengers)} annual passengers`;
}

export function normalizeAirportIataCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}

export function normalizeAirportText(value: string, maxLength = 240) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function parsePassengerCount(value: string) {
  const normalizedValue = value.replace(/[,\s]/g, "").trim();
  if (!normalizedValue) return null;
  const passengers = Number.parseInt(normalizedValue, 10);
  return Number.isFinite(passengers) && passengers >= 0 ? passengers : null;
}

export function parseAirportYear(value: string) {
  const year = Number.parseInt(value.trim(), 10);
  const currentYear = new Date().getFullYear() + 1;
  if (!Number.isFinite(year) || year < 1900 || year > currentYear) return null;
  return year;
}

export function formatAirportAccountDate(value: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function mapAirportAccountRow(row: AirportAccountRow): AirportAccount {
  return {
    annualPassengers: row.annual_passengers,
    airportType: row.airport_type ?? "",
    city: row.city ?? "",
    countryCode: row.country_code ?? "",
    countryName: row.country_name ?? "",
    displayName: row.display_name ?? row.name ?? "",
    iataCode: row.iata_code ?? "",
    icaoCode: row.icao_code ?? "",
    id: row.id,
    isActive: row.is_active ?? true,
    latitude: row.latitude,
    longitude: row.longitude,
    municipality: row.municipality ?? "",
    name: row.name ?? "",
    notes: row.notes ?? "",
    ourairportsIdent: row.ourairports_ident ?? "",
    passengerTier: normalizePassengerTier(row.passenger_tier),
    passengerYear: row.passenger_year,
    regionCode: row.region_code ?? "",
    scheduledService: row.scheduled_service ?? "",
    sourceIdentity: row.source_identity ?? "",
    sourceTraffic: row.source_traffic ?? "",
    sourceUrl: row.source_url ?? "",
    status: normalizeAccountStatus(row.status),
    strategicPriority: normalizeStrategicPriority(row.strategic_priority),
    updatedAt: row.updated_at ?? "",
  };
}

function normalizePassengerTier(value: string | null): PassengerTier {
  if (
    value === "mega_hub" ||
    value === "large_airport" ||
    value === "medium_airport" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function normalizeStrategicPriority(value: string | null): StrategicPriority {
  if (
    value === "strategic" ||
    value === "high" ||
    value === "medium" ||
    value === "unrated"
  ) {
    return value;
  }

  return "unrated";
}

function normalizeAccountStatus(value: string | null): AccountStatus {
  if (
    value === "support" ||
    value === "prospect" ||
    value === "customer" ||
    value === "partner" ||
    value === "competitor" ||
    value === "inactive"
  ) {
    return value;
  }

  return "prospect";
}
