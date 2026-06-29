import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const COMPANY_TYPE_OPTIONS = [
  "Airport Operator",
  "Airline",
  "Technology Supplier",
  "System Integrator",
  "Distributor",
  "Ground Handler",
  "Cargo Operator",
  "Consultant",
  "Authority",
  "OEM",
  "Other",
] as const;

export const STRATEGIC_PRIORITY_OPTIONS = [
  "strategic",
  "high",
  "medium",
  "low",
  "unrated",
] as const;

export const ACCOUNT_STATUS_OPTIONS = [
  "prospect",
  "customer",
  "partner",
  "competitor",
  "inactive",
] as const;

export type CompanyType = (typeof COMPANY_TYPE_OPTIONS)[number];
export type CompanyStrategicPriority = (typeof STRATEGIC_PRIORITY_OPTIONS)[number];
export type CompanyAccountStatus = (typeof ACCOUNT_STATUS_OPTIONS)[number];

export type CompanyAccount = {
  accountType: string;
  city: string;
  companyType: string;
  countryName: string;
  createdAt: string;
  description: string;
  displayName: string;
  iataCode: string;
  icaoCode: string;
  id: string;
  industry: string;
  isSeeded: boolean;
  linkedinUrl: string;
  name: string;
  notes: string;
  sourceIdentity: string;
  status: string;
  strategicPriority: string;
  updatedAt: string;
  website: string;
};

export type CompanyAccountInput = {
  accountStatus?: string;
  city?: string;
  companyName?: string;
  companyType?: string;
  country?: string;
  description?: string;
  industry?: string;
  linkedinUrl?: string;
  notes?: string;
  strategicPriority?: string;
  website?: string;
};

export type CompanyDuplicate = {
  companyType: string;
  displayName: string;
  id: string;
  matchReason: string;
  url: string;
};

type AccountRow = {
  account_type: string | null;
  city: string | null;
  company_type: string | null;
  country_name: string | null;
  created_at: string | null;
  description: string | null;
  display_name: string | null;
  iata_code: string | null;
  icao_code: string | null;
  id: string;
  industry: string | null;
  is_seeded: boolean | null;
  linkedin_url: string | null;
  name: string | null;
  notes: string | null;
  source_identity: string | null;
  status: string | null;
  strategic_priority: string | null;
  updated_at: string | null;
  website: string | null;
};

const COMPANY_ACCOUNT_SELECT = [
  "id",
  "account_type",
  "name",
  "display_name",
  "company_type",
  "industry",
  "country_name",
  "city",
  "website",
  "linkedin_url",
  "description",
  "notes",
  "strategic_priority",
  "status",
  "source_identity",
  "is_seeded",
  "iata_code",
  "icao_code",
  "created_at",
  "updated_at",
].join(", ");

export async function getCompanyAccounts() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(COMPANY_ACCOUNT_SELECT)
    .eq("is_active", true)
    .order("display_name", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .returns<AccountRow[]>();

  if (error) {
    console.error("COMPANY ACCOUNTS LOOKUP ERROR", error);
    return [];
  }

  return (data ?? []).map(mapCompanyAccountRow);
}

export async function getCompanyAccountById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(COMPANY_ACCOUNT_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle<AccountRow>();

  if (error) {
    console.error("COMPANY ACCOUNT LOOKUP ERROR", { error, id });
    return null;
  }

  return data ? mapCompanyAccountRow(data) : null;
}

export async function checkCompanyDuplicates(input: CompanyAccountInput) {
  const normalizedName = normalizeCompanyName(input.companyName ?? "");
  const websiteDomain = normalizeDomain(input.website ?? "");
  const normalizedLinkedInUrl = normalizeUrl(input.linkedinUrl ?? "");
  if (!normalizedName && !websiteDomain && !normalizedLinkedInUrl) {
    return { exactDuplicate: null, possibleDuplicates: [] as CompanyDuplicate[] };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, account_type, display_name, name, company_type, website, linkedin_url, iata_code")
    .eq("is_active", true)
    .limit(2000)
    .returns<
      Array<{
        account_type: string | null;
        company_type: string | null;
        display_name: string | null;
        iata_code: string | null;
        id: string;
        linkedin_url: string | null;
        name: string | null;
        website: string | null;
      }>
    >();

  if (error) {
    console.error("COMPANY DUPLICATE LOOKUP ERROR", { error, input });
    return { exactDuplicate: null, possibleDuplicates: [] as CompanyDuplicate[] };
  }

  const possibleDuplicates: CompanyDuplicate[] = [];
  let exactDuplicate: CompanyDuplicate | null = null;

  for (const row of data ?? []) {
    const rowName = row.display_name || row.name || "";
    const rowDuplicate = {
      companyType: row.company_type || getFallbackCompanyType(row.account_type, row.iata_code),
      displayName: rowName,
      id: row.id,
      matchReason: "",
      url: getCompanyDetailUrl(row.id, row.account_type, row.iata_code),
    };

    if (websiteDomain && normalizeDomain(row.website ?? "") === websiteDomain) {
      exactDuplicate = { ...rowDuplicate, matchReason: "Exact website domain match" };
      break;
    }

    if (normalizedLinkedInUrl && normalizeUrl(row.linkedin_url ?? "") === normalizedLinkedInUrl) {
      exactDuplicate = { ...rowDuplicate, matchReason: "Exact LinkedIn URL match" };
      break;
    }

    if (normalizedName && normalizeCompanyName(rowName) === normalizedName) {
      possibleDuplicates.push({
        ...rowDuplicate,
        matchReason: "Similar company name",
      });
    }
  }

  return {
    exactDuplicate,
    possibleDuplicates: possibleDuplicates.slice(0, 5),
  };
}

export async function createManualCompanyAccount({
  createdByEmail,
  createdByUserId,
  input,
  sourceIdentity = "manual",
}: {
  createdByEmail: string;
  createdByUserId: string;
  input: CompanyAccountInput;
  sourceIdentity?: "manual" | "smart_entry";
}) {
  const companyName = cleanText(input.companyName);
  const companyType = cleanOption(input.companyType, COMPANY_TYPE_OPTIONS, "Other");
  const industry = cleanText(input.industry);
  const country = cleanText(input.country);

  if (!companyName) throw new Error("Company name is required.");
  if (!industry) throw new Error("Industry is required.");
  if (!country) throw new Error("Country is required.");
  if (!companyType) throw new Error("Company type is required.");

  const now = new Date().toISOString();
  const payload = {
    account_type: "company",
    city: cleanText(input.city) || null,
    company_type: companyType,
    country_name: country,
    created_by_email: normalizeEmail(createdByEmail),
    created_by_user_id: createdByUserId || null,
    description: cleanLongText(input.description) || null,
    display_name: companyName,
    industry,
    is_active: true,
    is_seeded: false,
    linkedin_url: cleanUrl(input.linkedinUrl) || null,
    name: companyName,
    notes: cleanLongText(input.notes) || null,
    source_identity: sourceIdentity,
    status: cleanOption(input.accountStatus, ACCOUNT_STATUS_OPTIONS, "prospect"),
    strategic_priority: cleanOption(input.strategicPriority, STRATEGIC_PRIORITY_OPTIONS, "unrated"),
    updated_at: now,
    website: cleanUrl(input.website) || null,
  };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .insert(payload)
    .select(COMPANY_ACCOUNT_SELECT)
    .single<AccountRow>();

  if (error) {
    console.error("MANUAL COMPANY CREATE ERROR", { error, payload });
    throw new Error(error.message);
  }

  return mapCompanyAccountRow(data);
}

export function mapCompanyAccountRow(row: AccountRow): CompanyAccount {
  return {
    accountType: row.account_type ?? "",
    city: row.city ?? "",
    companyType: row.company_type || getFallbackCompanyType(row.account_type, row.iata_code),
    countryName: row.country_name ?? "",
    createdAt: row.created_at ?? "",
    description: row.description ?? "",
    displayName: row.display_name || row.name || "",
    iataCode: row.iata_code ?? "",
    icaoCode: row.icao_code ?? "",
    id: row.id,
    industry: row.industry ?? "",
    isSeeded: Boolean(row.is_seeded),
    linkedinUrl: row.linkedin_url ?? "",
    name: row.name ?? "",
    notes: row.notes ?? "",
    sourceIdentity: row.source_identity ?? "",
    status: row.status ?? "prospect",
    strategicPriority: row.strategic_priority ?? "unrated",
    updatedAt: row.updated_at ?? row.created_at ?? "",
    website: row.website ?? "",
  };
}

export function getCompanyDetailUrl(id: string, accountType?: string | null, iataCode?: string | null) {
  if (accountType === "airport" || iataCode) return `/network/accounts/airports/${id}`;
  return `/network/companies/${id}`;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 180) : "";
}

function cleanLongText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 4000) : "";
}

function cleanUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function cleanOption<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return allowed.includes(String(value)) ? (String(value) as T[number]) : fallback;
}

function normalizeCompanyName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(inc|incorporated|ltd|limited|llc|gmbh|ag|sa|sas|bv|plc|corp|corporation|co|company)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeUrl(value: string) {
  const cleaned = cleanUrl(value);
  if (!cleaned) return "";
  try {
    const url = new URL(cleaned);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return cleaned.toLowerCase().replace(/\/+$/, "");
  }
}

function normalizeDomain(value: string) {
  const cleaned = cleanUrl(value);
  if (!cleaned) return "";
  try {
    return new URL(cleaned).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function getFallbackCompanyType(accountType?: string | null, iataCode?: string | null) {
  if (accountType === "airport" || iataCode) return "Airport Operator";
  return "Company";
}
