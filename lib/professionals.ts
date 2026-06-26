import crypto from "node:crypto";
import { normalizeLinkedInUrl } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type ProfessionalRelationshipType =
  | "employee"
  | "decision_maker"
  | "influencer"
  | "consultant"
  | "supplier_contact"
  | "partner_contact"
  | "former_employee"
  | "other";

export type ProfessionalProfile = {
  companyLinksCount: number;
  currentCompany: string;
  currentTitle: string;
  displayName: string;
  headline: string;
  id: string;
  industry: string;
  linkedinUrl: string;
  location: string;
  profileImageUrl: string;
  slug: string;
  source: string;
  updatedAt: string;
  visibility: string;
};

export type CompanySearchResult = {
  accountType: string;
  city: string;
  countryName: string;
  displayName: string;
  iataCode: string;
  icaoCode: string;
  id: string;
};

export type ProfessionalCompanyLink = {
  company: CompanySearchResult | null;
  companyId: string;
  createdAt: string;
  department: string;
  id: string;
  isPrimary: boolean;
  notes: string;
  professional: ProfessionalProfile | null;
  professionalId: string;
  relationshipType: ProfessionalRelationshipType;
  seniority: string;
  title: string;
};

type ProfessionalProfileRow = {
  company: string | null;
  current_company: string | null;
  current_title: string | null;
  display_name: string | null;
  headline: string | null;
  id: string;
  industry: string | null;
  linkedin_url: string | null;
  location: string | null;
  professional_role: string | null;
  profile_image_url: string | null;
  profile_photo_url: string | null;
  slug: string;
  source: string | null;
  updated_at: string | null;
  visibility: string | null;
};

type AccountRow = {
  account_type: string | null;
  city: string | null;
  country_name: string | null;
  display_name: string | null;
  iata_code: string | null;
  icao_code: string | null;
  id: string;
  name: string | null;
};

type ProfessionalCompanyLinkRow = {
  company_id: string;
  created_at: string | null;
  department: string | null;
  id: string;
  is_primary: boolean | null;
  notes: string | null;
  professional_id: string;
  relationship_type: string | null;
  seniority: string | null;
  title: string | null;
};

const PROFESSIONAL_SELECT = [
  "id",
  "slug",
  "display_name",
  "headline",
  "linkedin_url",
  "current_title",
  "current_company",
  "company",
  "professional_role",
  "location",
  "industry",
  "profile_image_url",
  "profile_photo_url",
  "source",
  "visibility",
  "updated_at",
].join(", ");

const ACCOUNT_SELECT = [
  "id",
  "account_type",
  "name",
  "display_name",
  "iata_code",
  "icao_code",
  "country_name",
  "city",
].join(", ");

const LINK_SELECT = [
  "id",
  "professional_id",
  "company_id",
  "relationship_type",
  "title",
  "department",
  "seniority",
  "is_primary",
  "notes",
  "created_at",
].join(", ");

export function parseProfessionalLinkedInUrl(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname !== "linkedin.com" && hostname !== "linkedin.cn") return null;

  const pathParts = parsed.pathname.split("/").filter(Boolean);
  if (pathParts[0]?.toLowerCase() !== "in" || !pathParts[1]) return null;

  const publicSlug = decodeURIComponent(pathParts[1]).trim().replace(/[^a-zA-Z0-9-]/g, "");
  if (!publicSlug) return null;

  const linkedinUrl = `https://www.linkedin.com/in/${publicSlug}/`;

  return {
    originalLinkedinUrl: normalizeOriginalLinkedInUrl(raw, parsed),
    linkedinUrl,
    normalizedLinkedinUrl: normalizeLinkedInUrl(linkedinUrl),
    publicSlug,
    suggestedName: suggestNameFromLinkedInSlug(publicSlug),
  };
}

export async function fetchLinkedInOpenGraphMetadata(linkedinUrl: string) {
  const parsed = parseProfessionalLinkedInUrl(linkedinUrl);
  if (!parsed) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(parsed.linkedinUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "Mozilla/5.0 (compatible; INConnectBot/1.0; +https://in-connect.app)",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const html = await response.text();
    const title = cleanMetadata(extractMeta(html, "og:title") || extractTitle(html));
    const description = cleanMetadata(extractMeta(html, "og:description"));
    const image = cleanMetadata(extractMeta(html, "og:image"));

    return {
      description,
      image,
      title: normalizeLinkedInTitle(title),
    };
  } catch {
    return null;
  }
}

export async function getProfessionalProfiles() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select(PROFESSIONAL_SELECT)
    .order("updated_at", { ascending: false })
    .returns<ProfessionalProfileRow[]>();

  if (error) {
    console.error("PROFESSIONALS LOOKUP ERROR", error);
    return [];
  }

  const profiles = (data ?? []).map(mapProfessionalProfileRow);
  const counts = await getCompanyLinkCountsForProfessionals(profiles.map((profile) => profile.id));
  return profiles.map((profile) => ({
    ...profile,
    companyLinksCount: counts.get(profile.id) ?? 0,
  }));
}

export async function getProfessionalProfileById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select(PROFESSIONAL_SELECT)
    .eq("id", id)
    .maybeSingle<ProfessionalProfileRow>();

  if (error) {
    console.error("PROFESSIONAL LOOKUP ERROR", { error, id });
    return null;
  }

  return data ? mapProfessionalProfileRow(data) : null;
}

export async function getCompanyById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_SELECT)
    .eq("id", id)
    .maybeSingle<AccountRow>();

  if (error) {
    console.error("COMPANY LOOKUP ERROR", { error, id });
    return null;
  }

  return data ? mapCompanyRow(data) : null;
}

export async function searchCompanies(query: string, id?: string) {
  if (id) {
    const company = await getCompanyById(id);
    return company ? [company] : [];
  }

  const supabase = getSupabaseAdminClient();
  let request = supabase
    .from("accounts")
    .select(ACCOUNT_SELECT)
    .eq("is_active", true)
    .order("display_name", { ascending: true })
    .limit(25);

  const filter = query.trim();
  if (filter) {
    const escaped = filter.replace(/[,%]/g, "");
    request = request.or(
      [
        `display_name.ilike.%${escaped}%`,
        `name.ilike.%${escaped}%`,
        `iata_code.ilike.%${escaped}%`,
        `icao_code.ilike.%${escaped}%`,
        `country_name.ilike.%${escaped}%`,
        `city.ilike.%${escaped}%`,
      ].join(","),
    );
  }

  const { data, error } = await request.returns<AccountRow[]>();
  if (error) {
    console.error("COMPANY SEARCH ERROR", { error, query });
    return [];
  }

  return (data ?? []).map(mapCompanyRow);
}

export async function saveProfessionalFromLinkedInUrl(input: {
  currentCompany?: string;
  currentTitle?: string;
  displayName: string;
  headline?: string;
  industry?: string;
  linkedinUrl: string;
  location?: string;
  ownerEmail?: string;
  profileImageUrl?: string;
}) {
  const parsed = parseProfessionalLinkedInUrl(input.linkedinUrl);
  if (!parsed) throw new Error("A valid LinkedIn profile URL is required.");

  const supabase = getSupabaseAdminClient();
  const existing = await getProfessionalByNormalizedLinkedInUrl(parsed.normalizedLinkedinUrl);
  if (existing) {
    return { existing: true, profile: existing };
  }

  const displayName = cleanText(input.displayName) || parsed.suggestedName;
  if (!displayName) throw new Error("Full name is required.");

  const industry = cleanText(input.industry);
  const currentTitle = cleanText(input.currentTitle);
  const currentCompany = cleanText(input.currentCompany);
  const headline =
    cleanText(input.headline) ||
    [currentTitle, currentCompany].filter(Boolean).join(" at ");
  const slug = await ensureUniqueProfessionalSlug(slugify(displayName));
  const now = new Date().toISOString();
  const profileImageUrl = cleanUrl(input.profileImageUrl);

  const payload = {
    company: currentCompany,
    current_company: currentCompany,
    current_title: currentTitle,
    display_name: displayName,
    expertise: [],
    headline,
    industries: industry ? [industry] : [],
    industry,
    interests: [],
    is_public: false,
    linkedin_url: normalizeOriginalLinkedInUrl(input.linkedinUrl, new URL(parsed.linkedinUrl)),
    location: cleanText(input.location),
    normalized_linkedin_url: parsed.normalizedLinkedinUrl,
    owner_edit_token: crypto.randomBytes(24).toString("hex"),
    owner_email: cleanText(input.ownerEmail),
    professional_role: currentTitle,
    profile_image_url: profileImageUrl,
    profile_photo_url: profileImageUrl,
    slug,
    source: "linkedin_url",
    strengths: [],
    summary: headline,
    updated_at: now,
    visibility: "private",
  };

  const { data, error } = await supabase
    .from("public_profiles")
    .insert(payload)
    .select(PROFESSIONAL_SELECT)
    .single<ProfessionalProfileRow>();

  if (error) {
    if (error.code === "23505") {
      const duplicate = await getProfessionalByNormalizedLinkedInUrl(
        parsed.normalizedLinkedinUrl,
      );
      if (duplicate) return { existing: true, profile: duplicate };
    }
    console.error("PROFESSIONAL SAVE ERROR", { error, payload });
    throw new Error(error.message || "Professional could not be saved.");
  }

  return { existing: false, profile: mapProfessionalProfileRow(data) };
}

export async function attachProfessionalToCompany(input: {
  companyId: string;
  createdByEmail?: string;
  department?: string;
  isPrimary?: boolean;
  notes?: string;
  professionalId: string;
  relationshipType?: string;
  seniority?: string;
  title?: string;
}) {
  const relationshipType = normalizeRelationshipType(input.relationshipType);
  const payload = {
    company_id: input.companyId,
    created_by_email: cleanText(input.createdByEmail),
    department: cleanText(input.department),
    is_primary: Boolean(input.isPrimary),
    notes: cleanText(input.notes),
    professional_id: input.professionalId,
    relationship_type: relationshipType,
    seniority: cleanText(input.seniority),
    title: cleanText(input.title),
    updated_at: new Date().toISOString(),
  };
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("professional_company_links")
    .upsert(payload, { onConflict: "professional_id,company_id,relationship_type" })
    .select(LINK_SELECT)
    .single<ProfessionalCompanyLinkRow>();

  if (error) {
    console.error("PROFESSIONAL COMPANY LINK ERROR", { error, payload });
    throw new Error(error.message || "Professional could not be attached.");
  }

  return mapProfessionalCompanyLinkRow(data, null, null);
}

export async function deleteProfessionalCompanyLink(id: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("professional_company_links").delete().eq("id", id);
  if (error) {
    console.error("PROFESSIONAL COMPANY LINK DELETE ERROR", { error, id });
    throw new Error(error.message || "Company link could not be removed.");
  }
}

export async function getProfessionalCompanyLinksByProfessionalId(professionalId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("professional_company_links")
    .select(LINK_SELECT)
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false })
    .returns<ProfessionalCompanyLinkRow[]>();

  if (error) {
    console.error("PROFESSIONAL COMPANY LINKS LOOKUP ERROR", { error, professionalId });
    return [];
  }

  const companies = await getCompanyMap((data ?? []).map((link) => link.company_id));
  return (data ?? []).map((link) =>
    mapProfessionalCompanyLinkRow(link, companies.get(link.company_id) ?? null, null),
  );
}

export async function getProfessionalLinksForCompany(companyId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("professional_company_links")
    .select(LINK_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .returns<ProfessionalCompanyLinkRow[]>();

  if (error) {
    console.error("COMPANY PROFESSIONAL LINKS LOOKUP ERROR", { error, companyId });
    return [];
  }

  const professionals = await getProfessionalMap((data ?? []).map((link) => link.professional_id));
  return (data ?? []).map((link) =>
    mapProfessionalCompanyLinkRow(link, null, professionals.get(link.professional_id) ?? null),
  );
}

async function getProfessionalByNormalizedLinkedInUrl(normalizedLinkedinUrl: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select(PROFESSIONAL_SELECT)
    .eq("normalized_linkedin_url", normalizedLinkedinUrl)
    .maybeSingle<ProfessionalProfileRow>();

  if (error) {
    console.error("PROFESSIONAL LINKEDIN DUPLICATE LOOKUP ERROR", {
      error,
      normalizedLinkedinUrl,
    });
    return null;
  }

  return data ? mapProfessionalProfileRow(data) : null;
}

async function getCompanyLinkCountsForProfessionals(professionalIds: string[]) {
  const counts = new Map<string, number>();
  const ids = Array.from(new Set(professionalIds.filter(Boolean)));
  if (ids.length === 0) return counts;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("professional_company_links")
    .select("professional_id")
    .in("professional_id", ids)
    .returns<Array<{ professional_id: string }>>();

  if (error) {
    console.warn("Professional company link counts unavailable", error);
    return counts;
  }

  for (const row of data ?? []) {
    counts.set(row.professional_id, (counts.get(row.professional_id) ?? 0) + 1);
  }

  return counts;
}

async function getCompanyMap(companyIds: string[]) {
  const ids = Array.from(new Set(companyIds.filter(Boolean)));
  const map = new Map<string, CompanySearchResult>();
  if (ids.length === 0) return map;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_SELECT)
    .in("id", ids)
    .returns<AccountRow[]>();

  if (error) {
    console.error("COMPANY LINK MAP LOOKUP ERROR", error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id, mapCompanyRow(row));
  }

  return map;
}

async function getProfessionalMap(professionalIds: string[]) {
  const ids = Array.from(new Set(professionalIds.filter(Boolean)));
  const map = new Map<string, ProfessionalProfile>();
  if (ids.length === 0) return map;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select(PROFESSIONAL_SELECT)
    .in("id", ids)
    .returns<ProfessionalProfileRow[]>();

  if (error) {
    console.error("PROFESSIONAL LINK MAP LOOKUP ERROR", error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id, mapProfessionalProfileRow(row));
  }

  return map;
}

async function ensureUniqueProfessionalSlug(value: string) {
  const supabase = getSupabaseAdminClient();
  const baseSlug = value || `professional-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const { data } = await supabase
      .from("public_profiles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function mapProfessionalProfileRow(row: ProfessionalProfileRow): ProfessionalProfile {
  return {
    companyLinksCount: 0,
    currentCompany: row.current_company ?? row.company ?? "",
    currentTitle: row.current_title ?? row.professional_role ?? "",
    displayName: row.display_name ?? "INConnect Professional",
    headline: row.headline ?? "",
    id: row.id,
    industry: row.industry ?? "",
    linkedinUrl: row.linkedin_url ?? "",
    location: row.location ?? "",
    profileImageUrl: row.profile_image_url ?? row.profile_photo_url ?? "",
    slug: row.slug,
    source: row.source ?? "",
    updatedAt: row.updated_at ?? "",
    visibility: row.visibility ?? "private",
  };
}

function mapCompanyRow(row: AccountRow): CompanySearchResult {
  return {
    accountType: row.account_type ?? "",
    city: row.city ?? "",
    countryName: row.country_name ?? "",
    displayName: row.display_name ?? row.name ?? "Company",
    iataCode: row.iata_code ?? "",
    icaoCode: row.icao_code ?? "",
    id: row.id,
  };
}

function mapProfessionalCompanyLinkRow(
  row: ProfessionalCompanyLinkRow,
  company: CompanySearchResult | null,
  professional: ProfessionalProfile | null,
): ProfessionalCompanyLink {
  return {
    company,
    companyId: row.company_id,
    createdAt: row.created_at ?? "",
    department: row.department ?? "",
    id: row.id,
    isPrimary: Boolean(row.is_primary),
    notes: row.notes ?? "",
    professional,
    professionalId: row.professional_id,
    relationshipType: normalizeRelationshipType(row.relationship_type),
    seniority: row.seniority ?? "",
    title: row.title ?? "",
  };
}

function normalizeRelationshipType(value: unknown): ProfessionalRelationshipType {
  if (
    value === "employee" ||
    value === "decision_maker" ||
    value === "influencer" ||
    value === "consultant" ||
    value === "supplier_contact" ||
    value === "partner_contact" ||
    value === "former_employee" ||
    value === "other"
  ) {
    return value;
  }

  return "employee";
}

function suggestNameFromLinkedInSlug(slug: string) {
  const parts = slug
    .split("-")
    .filter((part) => part && !/^\d+$/.test(part) && !/^[a-f0-9]{8,}$/i.test(part))
    .slice(0, 4);

  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeLinkedInTitle(title: string) {
  return title
    .replace(/\s+\|\s+LinkedIn.*$/i, "")
    .replace(/\s+-\s+LinkedIn.*$/i, "")
    .trim();
}

function extractMeta(html: string, property: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }

  return "";
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : "";
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanMetadata(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function cleanUrl(value: unknown) {
  const text = cleanText(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeOriginalLinkedInUrl(raw: string, parsed: URL) {
  const original = raw.trim();
  if (!original) return parsed.toString();
  if (/^https?:\/\//i.test(original)) return original;
  return `https://${original.replace(/^\/+/, "")}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
