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

export type AutomationPotentialTier =
  | "very_high"
  | "high"
  | "medium"
  | "low"
  | "very_low"
  | "unknown";

export type AirportAccount = {
  annualPassengers: number | null;
  airportType: string;
  automationPotentialScore: number | null;
  automationPotentialTier: AutomationPotentialTier;
  automationScoreNotes: string;
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
  openOpportunitiesCount: number;
  professionalsCount: number;
  regionCode: string;
  scheduledService: string;
  sourceIdentity: string;
  sourceTraffic: string;
  sourceUrl: string;
  status: AccountStatus;
  strategicPriority: StrategicPriority;
  updatedAt: string;
  website: string;
  linkedinUrl: string;
};

type AirportAccountRow = {
  annual_passengers: number | null;
  airport_type: string | null;
  automation_potential_score: number | null;
  automation_potential_tier: string | null;
  automation_score_notes: string | null;
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
  website: string | null;
  linkedin_url: string | null;
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

export const AUTOMATION_POTENTIAL_TIER_LABELS: Record<
  AutomationPotentialTier,
  string
> = {
  high: "High",
  low: "Low",
  medium: "Medium",
  unknown: "Unknown",
  very_high: "Very High",
  very_low: "Very Low",
};

const AIRPORT_ACCOUNT_SELECT = [
  "annual_passengers",
  "airport_type",
  "automation_potential_score",
  "automation_potential_tier",
  "automation_score_notes",
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
  "website",
  "linkedin_url",
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

  const accounts = (data ?? []).map(mapAirportAccountRow);
  const professionalCounts = await getProfessionalCountsForAccounts(
    accounts.map((account) => account.id),
  );

  return accounts.map((account) => ({
    ...account,
    professionalsCount: professionalCounts.get(account.id) ?? 0,
  }));
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

export function calculateAutomationPotentialScore({
  airportType,
  annualPassengers,
  passengerTier,
  strategicPriority,
}: {
  airportType: string | null | undefined;
  annualPassengers: number | null | undefined;
  passengerTier: PassengerTier;
  strategicPriority: StrategicPriority;
}) {
  let score = 20;
  const notes: string[] = [
    "Initial INConnect automation potential estimate.",
  ];

  if (passengerTier === "mega_hub") {
    score = 70;
    notes.push("Base score 70 from mega hub passenger tier.");
  } else if (passengerTier === "large_airport") {
    score = 55;
    notes.push("Base score 55 from large airport passenger tier.");
  } else if (passengerTier === "medium_airport") {
    score = 40;
    notes.push("Base score 40 from medium airport passenger tier.");
  } else {
    notes.push("Base score 20 because passenger tier is unknown.");
  }

  if (typeof annualPassengers === "number" && Number.isFinite(annualPassengers)) {
    if (annualPassengers >= 70_000_000) {
      score += 10;
      notes.push("+10 for 70M+ annual passengers.");
    } else if (annualPassengers >= 40_000_000) {
      score += 8;
      notes.push("+8 for 40M to 70M annual passengers.");
    } else if (annualPassengers >= 15_000_000) {
      score += 5;
      notes.push("+5 for 15M to 40M annual passengers.");
    }
  }

  if (strategicPriority === "strategic") {
    score += 5;
    notes.push("+5 for strategic priority.");
  } else if (strategicPriority === "high") {
    score += 3;
    notes.push("+3 for high strategic priority.");
  }

  if (airportType === "large_airport") {
    score += 5;
    notes.push("+5 for OurAirports large_airport type.");
  }

  notes.push(
    "Future factors can include cargo volume, hub airline status, international transfer share, modernization projects, BHS complexity, PBB count, terminal count, supplier presence, digital maturity, passenger growth, and regional investment activity.",
  );

  const cappedScore = Math.min(100, Math.max(0, score));

  return {
    notes: notes.join(" "),
    score: cappedScore,
    tier: getAutomationPotentialTier(cappedScore),
  };
}

export function getAutomationPotentialTier(
  score: number | null | undefined,
): AutomationPotentialTier {
  if (typeof score !== "number" || !Number.isFinite(score)) return "unknown";
  if (score >= 80) return "very_high";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "very_low";
}

export function formatAutomationPotentialScore(score: number | null) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "Unknown";
  return `${score} / 100`;
}

export function formatAirportPassengerCount(annualPassengers: number | null) {
  if (typeof annualPassengers !== "number" || !Number.isFinite(annualPassengers)) {
    return "No traffic data";
  }

  return `${new Intl.NumberFormat("en").format(annualPassengers)} annual passengers`;
}

export function formatCompactAirportPassengerCount(annualPassengers: number | null) {
  if (typeof annualPassengers !== "number" || !Number.isFinite(annualPassengers)) {
    return "No data";
  }

  if (annualPassengers >= 1_000_000) {
    return `${(annualPassengers / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (annualPassengers >= 1_000) {
    return `${(annualPassengers / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return new Intl.NumberFormat("en").format(annualPassengers);
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
    automationPotentialScore: row.automation_potential_score,
    automationPotentialTier: normalizeAutomationPotentialTier(
      row.automation_potential_tier,
      row.automation_potential_score,
    ),
    automationScoreNotes: row.automation_score_notes ?? "",
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
    openOpportunitiesCount: 0,
    ourairportsIdent: row.ourairports_ident ?? "",
    passengerTier: normalizePassengerTier(row.passenger_tier),
    passengerYear: row.passenger_year,
    professionalsCount: 0,
    regionCode: row.region_code ?? "",
    scheduledService: row.scheduled_service ?? "",
    sourceIdentity: row.source_identity ?? "",
    sourceTraffic: row.source_traffic ?? "",
    sourceUrl: row.source_url ?? "",
    status: normalizeAccountStatus(row.status),
    strategicPriority: normalizeStrategicPriority(row.strategic_priority),
    updatedAt: row.updated_at ?? "",
    website: row.website ?? "",
    linkedinUrl: row.linkedin_url ?? "",
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

function normalizeAutomationPotentialTier(
  value: string | null,
  score: number | null,
): AutomationPotentialTier {
  if (
    value === "very_high" ||
    value === "high" ||
    value === "medium" ||
    value === "low" ||
    value === "very_low" ||
    value === "unknown"
  ) {
    return value;
  }

  return getAutomationPotentialTier(score);
}

async function getProfessionalCountsForAccounts(accountIds: string[]) {
  const counts = new Map<string, number>();
  const ids = Array.from(new Set(accountIds.filter(Boolean)));
  if (ids.length === 0) return counts;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("professional_company_links")
    .select("company_id")
    .in("company_id", ids)
    .returns<Array<{ company_id: string }>>();

  if (error) {
    console.warn("Airport professional counts unavailable", error);
    return counts;
  }

  for (const row of data ?? []) {
    counts.set(row.company_id, (counts.get(row.company_id) ?? 0) + 1);
  }

  return counts;
}
