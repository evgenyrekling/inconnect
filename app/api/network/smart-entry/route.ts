import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getVerifiedInconnectUserFromRequest } from "@/lib/auth-server";
import {
  checkCompanyDuplicates,
  createManualCompanyAccount,
  getCompanyAccountById,
  getCompanyDetailUrl,
  type CompanyDuplicate,
} from "@/lib/company-accounts";
import { normalizeEmail } from "@/lib/identity";
import { parseProfessionalLinkedInUrl } from "@/lib/professionals";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type SmartEntryDraft = {
  companies?: SmartCompanyDraft[];
  links?: SmartLinkDraft[];
  professionals?: SmartProfessionalDraft[];
  relationships?: SmartLinkDraft[];
};

type SmartProfessionalDraft = {
  current_company?: string;
  current_title?: string;
  education_summary?: string;
  experience_summary?: string;
  full_name?: string;
  headline?: string;
  industry?: string;
  linkedin_url?: string;
  location?: string;
  notes?: string;
  phone?: string;
  professional_email?: string;
  profile_image_url?: string;
  skills?: string[] | string;
};

type SmartCompanyDraft = {
  city?: string;
  company_type?: string;
  country_name?: string;
  description?: string;
  display_name?: string;
  industry?: string;
  linkedin_url?: string;
  name?: string;
  notes?: string;
  use_existing_company_id?: string;
  website?: string;
};

type SmartLinkDraft = {
  company_index?: number;
  department?: string;
  is_primary?: boolean;
  professional_index?: number;
  relationship_type?: string;
  title?: string;
};

type ProfessionalRow = {
  display_name: string | null;
  id: string;
  slug: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          action?: "review" | "save";
          draft?: SmartEntryDraft;
        }
      | null;

    if (!body?.draft) {
      return NextResponse.json({ error: "Smart Entry draft is required." }, { status: 400 });
    }

    if (body.action === "review") {
      const owner = await getVerifiedInconnectUserFromRequest(request);
      const review = await reviewSmartEntryDraft(body.draft, owner);
      return NextResponse.json({ review });
    }

    const owner = await getVerifiedInconnectUserFromRequest(request);
    if (!owner) {
      return NextResponse.json(
        { error: "Verified email sign-in is required." },
        { status: 401 },
      );
    }

    const result = await saveSmartEntryDraft(body.draft, owner);
    revalidatePath("/network/accounts");
    revalidatePath("/network/professionals");
    for (const company of result.companies) {
      revalidatePath(company.url);
    }

    return NextResponse.json({
      message: "Saved to your network.",
      result,
    });
  } catch (error) {
    console.error("Smart Entry failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Smart Entry could not be saved." },
      { status: 500 },
    );
  }
}

async function reviewSmartEntryDraft(
  draft: SmartEntryDraft,
  owner: Awaited<ReturnType<typeof getVerifiedInconnectUserFromRequest>>,
) {
  const companyReviews = await Promise.all(
    (draft.companies ?? []).map(async (company, index) => {
      const duplicates = await checkCompanyDuplicates({
        city: company.city,
        companyName: company.display_name || company.name,
        companyType: company.company_type || "Other",
        country: company.country_name,
        description: company.description,
        industry: company.industry || "Unknown",
        linkedinUrl: company.linkedin_url,
        notes: company.notes,
        website: company.website,
      });
      return { duplicates, index };
    }),
  );

  const professionalReviews = owner
    ? await Promise.all(
        (draft.professionals ?? []).map(async (professional, index) => ({
          duplicate: await findProfessionalDuplicate(professional, owner),
          index,
        })),
      )
    : [];

  return {
    companies: companyReviews,
    professionals: professionalReviews,
  };
}

async function saveSmartEntryDraft(
  draft: SmartEntryDraft,
  owner: NonNullable<Awaited<ReturnType<typeof getVerifiedInconnectUserFromRequest>>>,
) {
  const companies = [];
  const professionals = [];
  const links = [];
  const companyIds: string[] = [];
  const professionalIds: string[] = [];

  for (const company of draft.companies ?? []) {
    let existingId = cleanText(company.use_existing_company_id);
    if (!existingId) {
      const duplicates = await checkCompanyDuplicates({
        city: company.city,
        companyName: company.display_name || company.name,
        companyType: company.company_type || "Other",
        country: company.country_name,
        description: company.description,
        industry: company.industry || "Unknown",
        linkedinUrl: company.linkedin_url,
        notes: company.notes,
        website: company.website,
      });
      existingId = duplicates.exactDuplicate?.id ?? "";
    }
    if (existingId) {
      const existing = await getCompanyAccountById(existingId);
      if (!existing) throw new Error("Selected existing company was not found.");
      companyIds.push(existing.id);
      companies.push({
        created: false,
        displayName: existing.displayName,
        id: existing.id,
        url: getCompanyDetailUrl(existing.id, existing.accountType, existing.iataCode),
      });
      continue;
    }

    const created = await createManualCompanyAccount({
      createdByEmail: owner.email,
      createdByUserId: owner.userId,
      input: {
        accountStatus: "prospect",
        city: company.city,
        companyName: company.display_name || company.name,
        companyType: company.company_type || "Other",
        country: company.country_name || "Unknown",
        description: company.description,
        industry: company.industry || "Unknown",
        linkedinUrl: company.linkedin_url,
        notes: company.notes,
        strategicPriority: "unrated",
        website: company.website,
      },
      sourceIdentity: "smart_entry",
    });
    companyIds.push(created.id);
    companies.push({
      created: true,
      displayName: created.displayName,
      id: created.id,
      url: `/network/companies/${created.id}`,
    });
  }

  for (const professional of draft.professionals ?? []) {
    const saved = await saveSmartEntryProfessional(professional, owner);
    professionalIds.push(saved.id);
    professionals.push({
      created: saved.created,
      displayName: saved.displayName,
      id: saved.id,
      url: `/network/professionals/${saved.id}`,
    });
  }

  for (const link of getDraftLinks(draft)) {
    const professionalId = professionalIds[Number(link.professional_index ?? -1)];
    const companyId = companyIds[Number(link.company_index ?? -1)];
    if (!professionalId || !companyId) continue;
    const savedLink = await createSmartEntryLink({
      companyId,
      department: link.department,
      isPrimary: link.is_primary ?? true,
      owner,
      professionalId,
      relationshipType: link.relationship_type || "employee",
      title: link.title,
    });
    links.push(savedLink);
  }

  return { companies, links, professionals };
}

async function saveSmartEntryProfessional(
  professional: SmartProfessionalDraft,
  owner: NonNullable<Awaited<ReturnType<typeof getVerifiedInconnectUserFromRequest>>>,
) {
  const displayName = cleanText(professional.full_name);
  if (!displayName) throw new Error("Professional full name is required.");

  const linkedin = cleanLinkedIn(professional.linkedin_url);
  const normalizedLinkedin = linkedin ? parseProfessionalLinkedInUrl(linkedin)?.normalizedLinkedinUrl ?? "" : "";
  const professionalEmail = cleanEmail(professional.professional_email);
  const normalizedProfessionalEmail = professionalEmail ? normalizeEmail(professionalEmail) : "";
  const duplicate = await findProfessionalDuplicate(professional, owner);
  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  const payload = {
    company: cleanText(professional.current_company),
    current_company: cleanText(professional.current_company),
    current_title: cleanText(professional.current_title),
    display_name: displayName,
    headline:
      cleanText(professional.headline) ||
      [cleanText(professional.current_title), cleanText(professional.current_company)]
        .filter(Boolean)
        .join(" at "),
    education_summary: cleanLongText(professional.education_summary),
    experience_summary: cleanLongText(professional.experience_summary),
    industries: cleanText(professional.industry) ? [cleanText(professional.industry)] : [],
    industry: cleanText(professional.industry),
    is_public: false,
    linkedin_url: linkedin || null,
    location: cleanText(professional.location),
    normalized_linkedin_url: normalizedLinkedin || null,
    normalized_professional_email: normalizedProfessionalEmail || null,
    notes: cleanLongText(professional.notes),
    owner_email: owner.email,
    owner_user_id: owner.userId,
    phone: cleanText(professional.phone),
    professional_email: professionalEmail || null,
    professional_role: cleanText(professional.current_title),
    profile_image_url: cleanUrl(professional.profile_image_url),
    profile_photo_url: cleanUrl(professional.profile_image_url),
    profile_type: "professional",
    skills: normalizeSkills(professional.skills),
    source: "smart_entry",
    summary: cleanText(professional.headline),
    updated_at: now,
    visibility: "private",
  };

  if (duplicate) {
    const { data, error } = await supabase
      .from("public_profiles")
      .update(payload)
      .eq("id", duplicate.id)
      .select("id, display_name, slug")
      .single<ProfessionalRow>();
    if (error) throw new Error(error.message);
    return {
      created: false,
      displayName: data.display_name || displayName,
      id: data.id,
      slug: data.slug,
    };
  }

  const { data, error } = await supabase
    .from("public_profiles")
    .insert({
      ...payload,
      expertise: [],
      interests: [],
      owner_edit_token: crypto.randomBytes(24).toString("hex"),
      slug: await ensureUniqueSlug(slugify(displayName)),
      strengths: [],
    })
    .select("id, display_name, slug")
    .single<ProfessionalRow>();

  if (error) throw new Error(error.message);
  return {
    created: true,
    displayName: data.display_name || displayName,
    id: data.id,
    slug: data.slug,
  };
}

async function createSmartEntryLink({
  companyId,
  department,
  isPrimary,
  owner,
  professionalId,
  relationshipType,
  title,
}: {
  companyId: string;
  department?: string;
  isPrimary: boolean;
  owner: NonNullable<Awaited<ReturnType<typeof getVerifiedInconnectUserFromRequest>>>;
  professionalId: string;
  relationshipType: string;
  title?: string;
}) {
  const supabase = getSupabaseAdminClient();
  const payload = {
    company_id: companyId,
    created_by_email: owner.email,
    department: cleanText(department),
    is_primary: isPrimary,
    owner_email: owner.email,
    owner_user_id: owner.userId,
    professional_id: professionalId,
    relationship_type: cleanText(relationshipType) || "employee",
    title: cleanText(title),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("professional_company_links")
    .upsert(payload, { onConflict: "professional_id,company_id,relationship_type" })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);
  return data;
}

async function findProfessionalDuplicate(
  professional: SmartProfessionalDraft,
  owner: NonNullable<Awaited<ReturnType<typeof getVerifiedInconnectUserFromRequest>>>,
) {
  const linkedin = cleanLinkedIn(professional.linkedin_url);
  const normalizedLinkedin = linkedin ? parseProfessionalLinkedInUrl(linkedin)?.normalizedLinkedinUrl ?? "" : "";
  const professionalEmail = cleanEmail(professional.professional_email);
  const normalizedProfessionalEmail = professionalEmail ? normalizeEmail(professionalEmail) : "";
  if (!normalizedLinkedin && !normalizedProfessionalEmail) {
    return findProfessionalNameCompanyDuplicate(professional, owner);
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("public_profiles")
    .select("id, display_name, slug")
    .eq("profile_type", "professional")
    .eq("owner_user_id", owner.userId)
    .neq("visibility", "removed");

  if (normalizedLinkedin && normalizedProfessionalEmail) {
    query = query.or(
      `normalized_linkedin_url.eq.${normalizedLinkedin},normalized_professional_email.eq.${normalizedProfessionalEmail}`,
    );
  } else if (normalizedLinkedin) {
    query = query.eq("normalized_linkedin_url", normalizedLinkedin);
  } else {
    query = query.eq("normalized_professional_email", normalizedProfessionalEmail);
  }

  const { data, error } = await query.limit(1).maybeSingle<ProfessionalRow>();
  if (error) {
    console.error("SMART ENTRY PROFESSIONAL DUPLICATE LOOKUP ERROR", error);
    return null;
  }
  return data;
}

async function findProfessionalNameCompanyDuplicate(
  professional: SmartProfessionalDraft,
  owner: NonNullable<Awaited<ReturnType<typeof getVerifiedInconnectUserFromRequest>>>,
) {
  const displayName = cleanText(professional.full_name);
  const currentCompany = cleanText(professional.current_company);
  if (!displayName || !currentCompany) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, display_name, slug")
    .eq("profile_type", "professional")
    .eq("owner_user_id", owner.userId)
    .eq("display_name", displayName)
    .eq("current_company", currentCompany)
    .neq("visibility", "removed")
    .limit(1)
    .maybeSingle<ProfessionalRow>();

  if (error) {
    console.error("SMART ENTRY PROFESSIONAL NAME/COMPANY DUPLICATE LOOKUP ERROR", error);
    return null;
  }
  return data;
}

function getDraftLinks(draft: SmartEntryDraft) {
  return draft.links ?? draft.relationships ?? [];
}

async function ensureUniqueSlug(base: string) {
  const supabase = getSupabaseAdminClient();
  let slug = base || `professional-${Date.now()}`;
  const root = slug;
  let suffix = 2;
  while (true) {
    const { data } = await supabase
      .from("public_profiles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle<{ id: string }>();
    if (!data) return slug;
    slug = `${root}-${suffix}`;
    suffix += 1;
  }
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 220) : "";
}

function cleanLongText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 4000) : "";
}

function cleanEmail(value: unknown) {
  const email = cleanText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function cleanUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function cleanLinkedIn(value: unknown) {
  const url = cleanUrl(value);
  return parseProfessionalLinkedInUrl(url)?.originalLinkedinUrl || "";
}

function normalizeSkills(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 30);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((item) => cleanText(item))
      .filter(Boolean)
      .slice(0, 30);
  }
  return [];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
