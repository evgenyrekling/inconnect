import { NextRequest, NextResponse } from "next/server";
import {
  createUserKey,
  normalizeEmail,
  normalizeLinkedInUrl,
} from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CsvContact = {
  company: string;
  email: string;
  industry: string;
  linkedinUrl: string;
  location: string;
  name: string;
  rowNumber: number;
  title: string;
};

type UserRow = {
  id: string;
  user_key: string;
  email: string;
  linkedin_url: string | null;
  normalized_email: string;
  normalized_linkedin_url: string | null;
  plan_type: string | null;
  is_admin: boolean | null;
};

type UserProfileRow = {
  id: string;
  user_id: string | null;
  user_key: string | null;
  name: string | null;
  email: string;
  linkedin_url: string | null;
  professional_role: string | null;
  current_company: string | null;
  location: string | null;
  industries: unknown;
};

type ImportSummary = {
  connectionsCreated: number;
  duplicatesSkipped: number;
  errors: string[];
  importedUsers: number;
  existingUsersUpdated: number;
  newUsersCreated: number;
  skippedMissingEmail: number;
  skippedMissingName: number;
  skippedRows: SkippedImportRow[];
  totalRowsProcessed: number;
};

type SkippedImportRow = {
  email: string;
  name: string;
  reason: "missing name" | "missing email" | "duplicate email";
  rowNumber: number;
};

const MAX_ERROR_COUNT = 80;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const adminEmail = normalizeEmail(String(formData?.get("adminEmail") ?? ""));

  if (!isAdminEmail(adminEmail)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const csvFile = formData?.get("file");
  if (!(csvFile instanceof File)) {
    return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
  }

  try {
    const csvText = await csvFile.text();
    const contacts = parseContactsCsv(csvText);
    const supabase = getSupabaseAdminClient();
    const adminUser = await ensureAdminUser(supabase, adminEmail);
    const summary: ImportSummary = {
      connectionsCreated: 0,
      duplicatesSkipped: 0,
      errors: [],
      importedUsers: 0,
      existingUsersUpdated: 0,
      newUsersCreated: 0,
      skippedMissingEmail: 0,
      skippedMissingName: 0,
      skippedRows: [],
      totalRowsProcessed: contacts.length,
    };
    const seenEmails = new Set<string>();

    for (const contact of contacts) {
      const normalizedContactEmail = normalizeEmail(contact.email);
      const contactName = cleanText(contact.name, 180);

      if (!contactName) {
        summary.skippedMissingName += 1;
        addSkippedRow(summary, contact, "missing name");
        continue;
      }

      if (!isValidEmail(normalizedContactEmail)) {
        summary.skippedMissingEmail += 1;
        addSkippedRow(summary, contact, "missing email");
        continue;
      }

      if (seenEmails.has(normalizedContactEmail)) {
        summary.duplicatesSkipped += 1;
        addSkippedRow(summary, contact, "duplicate email");
        continue;
      }
      seenEmails.add(normalizedContactEmail);

      if (normalizedContactEmail === adminEmail) {
        summary.duplicatesSkipped += 1;
        addSkippedRow(summary, contact, "duplicate email");
        continue;
      }

      try {
        const { created, updated, user } = await upsertImportedUser(
          supabase,
          contact,
          normalizedContactEmail,
        );

        if (created) summary.newUsersCreated += 1;
        if (!created && updated) summary.existingUsersUpdated += 1;

        const profileUpdated = await upsertImportedUserProfile(
          supabase,
          contact,
          user,
        );
        if (!created && profileUpdated && !updated) {
          summary.existingUsersUpdated += 1;
        }

        const connectionCreated = await createProfessionalConnection(
          supabase,
          adminUser.id,
          user.id,
        );

        if (connectionCreated) {
          summary.connectionsCreated += 1;
        } else {
          summary.duplicatesSkipped += 1;
        }
        summary.importedUsers += 1;
      } catch (error) {
        console.error("CONTACT IMPORT ROW ERROR", {
          contact: {
            email: normalizedContactEmail,
            linkedinUrl: contact.linkedinUrl,
          },
          error,
        });
        addImportError(
          summary,
          `${normalizedContactEmail}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("CONTACT IMPORT FAILED", error);
    return NextResponse.json(
      {
        error: "Contacts could not be imported.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

async function ensureAdminUser(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  adminEmail: string,
) {
  const existingAdmin = await findUserByNormalizedEmail(supabase, adminEmail);
  const timestamp = new Date().toISOString();

  if (existingAdmin) {
    const patch: Record<string, unknown> = {};
    if (!existingAdmin.is_admin) patch.is_admin = true;
    if (existingAdmin.plan_type !== "admin") patch.plan_type = "admin";

    if (Object.keys(patch).length === 0) return existingAdmin;

    patch.updated_at = timestamp;
    const { data, error } = await supabase
      .from("users")
      .update(patch)
      .eq("id", existingAdmin.id)
      .select(
        "id, user_key, email, linkedin_url, normalized_email, normalized_linkedin_url, plan_type, is_admin",
      )
      .single<UserRow>();

    if (error) throw new Error(`Admin user could not be updated: ${error.message}`);
    return data;
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      email: adminEmail,
      is_admin: true,
      linkedin_url: null,
      normalized_email: adminEmail,
      normalized_linkedin_url: null,
      plan_type: "admin",
      updated_at: timestamp,
      user_key: createUserKey(adminEmail),
    })
    .select(
      "id, user_key, email, linkedin_url, normalized_email, normalized_linkedin_url, plan_type, is_admin",
    )
    .single<UserRow>();

  if (error) throw new Error(`Admin user could not be created: ${error.message}`);
  return data;
}

async function upsertImportedUser(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  contact: CsvContact,
  normalizedContactEmail: string,
) {
  const existingUser = await findUserByNormalizedEmail(supabase, normalizedContactEmail);
  const timestamp = new Date().toISOString();
  const linkedinUrl = cleanText(contact.linkedinUrl, 500);
  const normalizedLinkedInUrl = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : "";

  if (existingUser) {
    const patch: Record<string, unknown> = {};
    if (!existingUser.linkedin_url && linkedinUrl) {
      patch.linkedin_url = linkedinUrl;
      patch.normalized_linkedin_url = normalizedLinkedInUrl || null;
    }

    if (Object.keys(patch).length === 0) {
      return { created: false, updated: false, user: existingUser };
    }

    patch.updated_at = timestamp;
    const { data, error } = await supabase
      .from("users")
      .update(patch)
      .eq("id", existingUser.id)
      .select(
        "id, user_key, email, linkedin_url, normalized_email, normalized_linkedin_url, plan_type, is_admin",
      )
      .single<UserRow>();

    if (error) throw new Error(`User update failed: ${error.message}`);
    return { created: false, updated: true, user: data };
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      email: contact.email.trim(),
      is_admin: false,
      linkedin_url: linkedinUrl || null,
      normalized_email: normalizedContactEmail,
      normalized_linkedin_url: normalizedLinkedInUrl || null,
      plan_type: "imported",
      updated_at: timestamp,
      user_key: createUserKey(normalizedContactEmail),
    })
    .select(
      "id, user_key, email, linkedin_url, normalized_email, normalized_linkedin_url, plan_type, is_admin",
    )
    .single<UserRow>();

  if (error) throw new Error(`User creation failed: ${error.message}`);
  return { created: true, updated: false, user: data };
}

async function upsertImportedUserProfile(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  contact: CsvContact,
  user: UserRow,
) {
  const normalizedContactEmail = normalizeEmail(contact.email);
  const { data: existingProfile, error: lookupError } = await supabase
    .from("user_profiles")
    .select(
      "id, user_id, user_key, name, email, linkedin_url, professional_role, current_company, location, industries",
    )
    .eq("email", normalizedContactEmail)
    .limit(1)
    .maybeSingle<UserProfileRow>();

  if (lookupError) {
    throw new Error(`Profile lookup failed: ${lookupError.message}`);
  }

  const profilePayload = createProfileImportPayload(contact, user);

  if (!existingProfile) {
    const { error } = await supabase.from("user_profiles").insert(profilePayload);
    if (error) throw new Error(`Profile creation failed: ${error.message}`);
    return true;
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (!existingProfile.user_id) patch.user_id = user.id;
  if (!existingProfile.user_key) patch.user_key = user.user_key;
  if (!existingProfile.name && profilePayload.name) patch.name = profilePayload.name;
  if (!existingProfile.linkedin_url && profilePayload.linkedin_url) {
    patch.linkedin_url = profilePayload.linkedin_url;
  }
  if (!existingProfile.current_company && profilePayload.current_company) {
    patch.current_company = profilePayload.current_company;
  }
  if (!existingProfile.professional_role && profilePayload.professional_role) {
    patch.professional_role = profilePayload.professional_role;
  }
  if (!existingProfile.location && profilePayload.location) {
    patch.location = profilePayload.location;
  }
  if (
    isEmptyJsonArray(existingProfile.industries) &&
    Array.isArray(profilePayload.industries) &&
    profilePayload.industries.length > 0
  ) {
    patch.industries = profilePayload.industries;
  }
  if (!existingProfile.email) patch.email = normalizedContactEmail;
  if (Object.keys(patch).length > 1) patch.profile_source = "csv_import";

  if (Object.keys(patch).length === 1) return false;

  const { error } = await supabase
    .from("user_profiles")
    .update(patch)
    .eq("id", existingProfile.id);

  if (error) throw new Error(`Profile update failed: ${error.message}`);
  return true;
}

function createProfileImportPayload(contact: CsvContact, user: UserRow) {
  const industry = cleanText(contact.industry, 120);
  return {
    current_company: cleanText(contact.company, 180) || null,
    email: normalizeEmail(contact.email),
    industries: industry ? [industry] : [],
    linkedin_url: cleanText(contact.linkedinUrl, 500) || null,
    location: cleanText(contact.location, 180) || null,
    name: cleanText(contact.name, 180) || null,
    professional_role: cleanText(contact.title, 180) || null,
    profile_source: "csv_import",
    updated_at: new Date().toISOString(),
    user_id: user.id,
    user_key: user.user_key,
  };
}

async function createProfessionalConnection(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  sourceUserId: string,
  targetUserId: string,
) {
  if (sourceUserId === targetUserId) return false;

  const { data: existingConnection, error: lookupError } = await supabase
    .from("professional_connections")
    .select("id")
    .eq("source_user_id", sourceUserId)
    .eq("target_user_id", targetUserId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (lookupError) {
    throw new Error(`Connection lookup failed: ${lookupError.message}`);
  }

  if (existingConnection) return false;

  const { error } = await supabase.from("professional_connections").insert({
    connection_type: "linkedin",
    source: "csv_import",
    source_user_id: sourceUserId,
    status: "connected",
    target_user_id: targetUserId,
  });

  if (!error) return true;
  if (getSupabaseErrorCode(error) === "23505") return false;
  throw new Error(`Connection creation failed: ${error.message}`);
}

async function findUserByNormalizedEmail(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  normalizedEmail: string,
) {
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, user_key, email, linkedin_url, normalized_email, normalized_linkedin_url, plan_type, is_admin",
    )
    .eq("normalized_email", normalizedEmail)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<UserRow>();

  if (error) throw new Error(`User lookup failed: ${error.message}`);
  return data;
}

function parseContactsCsv(csvText: string) {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return [];

  const header = rows[0].map((column) => normalizeHeader(column));
  const hasHeader = looksLikeHeader(header, rows[0]);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const rowNumberOffset = hasHeader ? 2 : 1;

  return dataRows.flatMap((row, index) => {
    if (row.every((cell) => !cell.trim())) return [];
    const email = extractEmail(getCsvValue(row, header, "email")) || findEmailInRow(row);

    return [
      {
        company: getCsvValue(row, header, "company"),
        email,
        industry: getCsvValue(row, header, "industry"),
        linkedinUrl: getCsvValue(row, header, "linkedin_url"),
        location: getCsvValue(row, header, "location"),
        name: inferContactName(row, header),
        rowNumber: index + rowNumberOffset,
        title: getCsvValue(row, header, "title"),
      },
    ];
  });
}

function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim()));
}

function getCsvValue(row: string[], header: string[], column: string) {
  const index = header.indexOf(column);
  return index >= 0 ? cleanText(row[index] ?? "", 500) : "";
}

function looksLikeHeader(header: string[], firstRow: string[]) {
  const recognizedHeaders = new Set([
    "company",
    "email",
    "first_name",
    "industry",
    "last_name",
    "linkedin_url",
    "location",
    "name",
    "title",
  ]);

  if (firstRow.some((cell) => EMAIL_PATTERN.test(cell))) return false;
  return header.some((column) => recognizedHeaders.has(column));
}

function normalizeHeader(value: string) {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[\s/.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliases: Record<string, string> = {
    business_email: "email",
    company: "company",
    company_name: "company",
    email: "email",
    email_1: "email",
    email_address: "email",
    email_address_work: "email",
    e_mail: "email",
    first_name: "first_name",
    firstname: "first_name",
    full_name: "name",
    industry: "industry",
    last_name: "last_name",
    lastname: "last_name",
    linkedin: "linkedin_url",
    linkedin_profile: "linkedin_url",
    linkedin_url: "linkedin_url",
    location: "location",
    mail: "email",
    name: "name",
    position: "title",
    primary_email: "email",
    surname: "last_name",
    title: "title",
    work_email: "email",
  };

  return aliases[normalizedValue] ?? normalizedValue;
}

function findEmailInRow(row: string[]) {
  for (const cell of row) {
    const email = extractEmail(cell);
    if (email) return email;
  }

  return "";
}

function extractEmail(value: string) {
  const match = value.match(EMAIL_PATTERN);
  return match ? cleanText(match[0], 500) : "";
}

function inferContactName(row: string[], header: string[]) {
  const firstName = getCsvValue(row, header, "first_name");
  const lastName = getCsvValue(row, header, "last_name");
  const headerName =
    getCsvValue(row, header, "name") ||
    cleanText([firstName, lastName].filter(Boolean).join(" "), 180);

  if (headerName) return headerName;

  const nameParts: string[] = [];
  for (const cell of row) {
    const candidate = cleanText(cell.replace(EMAIL_PATTERN, " "), 80);
    if (!candidate || !looksLikeNameCell(candidate)) continue;
    nameParts.push(candidate);
    if (nameParts.length >= 2) break;
  }

  return cleanText(nameParts.join(" "), 180);
}

function looksLikeNameCell(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) return false;
  if (EMAIL_PATTERN.test(normalizedValue)) return false;
  if (/^\+?[\d\s().-]+$/.test(normalizedValue)) return false;
  if (/^\d+(?:\.\d+)?e\+?\d+$/i.test(normalizedValue)) return false;
  if (/^(mr|mrs|ms|dr|prof)\.?$/i.test(normalizedValue)) return false;
  if (/https?:\/\//i.test(normalizedValue)) return false;
  return /[a-z]/i.test(normalizedValue);
}

function isEmptyJsonArray(value: unknown) {
  return !Array.isArray(value) || value.length === 0;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function cleanText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function addImportError(summary: ImportSummary, message: string) {
  if (summary.errors.length < MAX_ERROR_COUNT) {
    summary.errors.push(message);
  }
}

function addSkippedRow(
  summary: ImportSummary,
  contact: CsvContact,
  reason: SkippedImportRow["reason"],
) {
  summary.skippedRows.push({
    email: cleanText(contact.email, 500),
    name: cleanText(contact.name, 180),
    reason,
    rowNumber: contact.rowNumber,
  });
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

function getSupabaseErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}
