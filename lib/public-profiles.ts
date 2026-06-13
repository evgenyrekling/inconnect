import crypto from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type PublicProfileSection = {
  content: string;
  id: string;
  items: string[];
  order: number;
  title: string;
  visible: boolean;
};

export type PublicProfile = {
  authorityScore: number | null;
  company: string;
  displayName: string;
  expertise: string[];
  headline: string;
  id: string;
  industries: string[];
  interests: string[];
  isPublic: boolean;
  location: string;
  professionalArchetype: unknown;
  professionalRole: string;
  sections: PublicProfileSection[];
  slug: string;
  strengths: string[];
  summary: string;
  userKey: string;
  visibility: "public" | "unlisted" | "private" | string;
};

type PublicProfileRow = {
  authority_score: number | null;
  company: string | null;
  display_name: string | null;
  expertise: unknown;
  headline: string | null;
  id: string;
  industries: unknown;
  interests: unknown;
  is_public: boolean | null;
  location: string | null;
  professional_archetype: unknown;
  professional_role: string | null;
  sections: unknown;
  slug: string;
  strengths: unknown;
  summary: string | null;
  user_key: string | null;
  visibility: string | null;
};

type AssessmentRow = {
  analysis: unknown;
  professional_archetype: unknown;
  total_score: number | null;
  user_id: string | null;
  user_key: string | null;
};

export async function createPublicProfileFromLatestAssessment(userKey: string) {
  const supabase = getSupabaseAdminClient();
  const { data: existingProfile } = await supabase
    .from("public_profiles")
    .select("*")
    .eq("user_key", userKey)
    .maybeSingle<PublicProfileRow>();

  const { data: assessment, error } = await supabase
    .from("assessments")
    .select("analysis, professional_archetype, total_score, user_id, user_key")
    .eq("user_key", userKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AssessmentRow>();

  if (error) throw new Error(error.message || "Latest assessment lookup failed.");
  if (!assessment) throw new Error("No assessment found for this user.");

  const profilePayload = buildPublicProfilePayload(assessment, existingProfile?.slug);

  if (existingProfile) {
    const { data, error: updateError } = await supabase
      .from("public_profiles")
      .update({
        ...profilePayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingProfile.id)
      .select("*")
      .single<PublicProfileRow>();

    if (updateError) throw new Error(updateError.message || "Profile update failed.");
    return mapPublicProfileRow(data);
  }

  const slug = await ensureUniqueProfileSlug(profilePayload.slug);
  const { data, error: insertError } = await supabase
    .from("public_profiles")
    .insert({
      ...profilePayload,
      slug,
      visibility: "unlisted",
      is_public: false,
      owner_edit_token: crypto.randomBytes(24).toString("hex"),
    })
    .select("*")
    .single<PublicProfileRow>();

  if (insertError) throw new Error(insertError.message || "Profile insert failed.");
  return mapPublicProfileRow(data);
}

export async function getPublicProfileBySlug(slug: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<PublicProfileRow>();

  if (error) {
    console.error("Public profile lookup failed", { error, slug });
    return null;
  }

  return data ? mapPublicProfileRow(data) : null;
}

export async function getPublicProfiles() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("public_profiles")
      .select("*")
      .eq("visibility", "public")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .returns<PublicProfileRow[]>();

    if (error) {
      console.error("Public profiles directory lookup failed", error);
      return [];
    }

    return (data ?? []).map(mapPublicProfileRow);
  } catch (error) {
    if (!isMissingSupabaseConfigError(error)) {
      console.error("Public profiles directory fallback used", error);
    }
    return [];
  }
}

export async function getOwnerProfile(userKey: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("*")
    .eq("user_key", userKey)
    .maybeSingle<PublicProfileRow>();

  if (error) {
    console.error("Owner public profile lookup failed", { error, userKey });
    return null;
  }

  return data ? mapPublicProfileRow(data) : null;
}

export async function updateOwnerProfile(
  userKey: string,
  values: {
    displayName?: string;
    headline?: string;
    sections?: PublicProfileSection[];
    visibility?: string;
  },
) {
  const supabase = getSupabaseAdminClient();
  const visibility = normalizeVisibility(values.visibility);
  const { data, error } = await supabase
    .from("public_profiles")
    .update({
      display_name: values.displayName,
      headline: values.headline,
      is_public: visibility === "public",
      sections: values.sections,
      updated_at: new Date().toISOString(),
      visibility,
    })
    .eq("user_key", userKey)
    .select("*")
    .single<PublicProfileRow>();

  if (error) throw new Error(error.message || "Profile update failed.");
  return mapPublicProfileRow(data);
}

export async function deleteOwnerProfile(userKey: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("public_profiles").delete().eq("user_key", userKey);
  if (error) throw new Error(error.message || "Profile delete failed.");
}

function buildPublicProfilePayload(assessment: AssessmentRow, existingSlug?: string | null) {
  const analysis = asRecord(assessment.analysis);
  const snapshot = asRecord(analysis.profileSnapshot);
  const displayName = cleanPublicText(getString(snapshot.name), "INConnect Professional");
  const professionalRole = cleanPublicText(getString(snapshot.currentRole), "");
  const company = cleanPublicText(getString(snapshot.currentCompany), "");
  const location = cleanPublicText(getString(snapshot.location), "");
  const industries = getStringArray(snapshot.topIndustries || analysis.keyExpertiseDomains).slice(0, 6);
  const expertise = getStringArray(analysis.keyExpertiseDomains || snapshot.topSkills).slice(0, 8);
  const strengths = [
    ...getStringArray(analysis.topCompetencies).slice(0, 5),
    ...getStringArray(analysis.positiveHighlights).slice(0, 3),
  ].slice(0, 8);
  const archetype = assessment.professional_archetype || analysis.professionalArchetype || null;
  const archetypeRecord = asRecord(archetype);
  const headline =
    cleanPublicText(getString(analysis.corePositioning), "") ||
    [professionalRole, industries[0], expertise[0]].filter(Boolean).join(" | ");
  const summary =
    cleanPublicText(getString(analysis.marketPosition), "") ||
    cleanPublicText(getString(analysis.whatMakesYouUnique), "") ||
    `${displayName} brings visible expertise across ${expertise.slice(0, 3).join(", ")}.`;
  const sections: PublicProfileSection[] = [
    section("summary", "Professional Summary", summary, [], 1),
    section("expertise", "Expertise", "Core areas where this professional is building visible authority.", expertise, 2),
    section("industries", "Industries", "Industry context connected to this profile.", industries, 3),
    section("strengths", "Strengths", "Positive public strengths identified from the assessment.", strengths, 4),
    section(
      "archetype",
      "Professional Archetype",
      [getString(archetypeRecord.animal), getString(archetypeRecord.label), getString(archetypeRecord.explanation)]
        .filter(Boolean)
        .join(" - "),
      [],
      5,
    ),
    section("interests", "Interests", "Professional interests will expand as INConnect Network grows.", [], 6),
    section("thought-leadership", "Thought Leadership", cleanPublicText(getString(analysis.whatMakesYouUnique), ""), [], 7),
    section("business-focus", "Business Focus", cleanPublicText(getString(analysis.businessImpact), "Future business focus will be added by the profile owner."), [], 8),
    section("connect", "Contact / Connect CTA", "Connection requests through INConnect are coming soon.", [], 9),
  ];

  return {
    authority_score: assessment.total_score,
    company,
    display_name: displayName,
    expertise,
    headline: headline.slice(0, 260),
    industries,
    interests: [],
    location,
    professional_archetype: archetype,
    professional_role: professionalRole,
    sections,
    slug: existingSlug || slugify(displayName),
    strengths,
    summary,
    user_id: assessment.user_id,
    user_key: assessment.user_key,
  };
}

async function ensureUniqueProfileSlug(value: string) {
  const supabase = getSupabaseAdminClient();
  const baseSlug = slugify(value) || `profile-${Date.now()}`;
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

function mapPublicProfileRow(row: PublicProfileRow): PublicProfile {
  return {
    authorityScore: row.authority_score,
    company: row.company ?? "",
    displayName: row.display_name ?? "INConnect Professional",
    expertise: getStringArray(row.expertise),
    headline: row.headline ?? "",
    id: row.id,
    industries: getStringArray(row.industries),
    interests: getStringArray(row.interests),
    isPublic: Boolean(row.is_public),
    location: row.location ?? "",
    professionalArchetype: row.professional_archetype,
    professionalRole: row.professional_role ?? "",
    sections: normalizeSections(row.sections),
    slug: row.slug,
    strengths: getStringArray(row.strengths),
    summary: row.summary ?? "",
    userKey: row.user_key ?? "",
    visibility: row.visibility ?? "unlisted",
  };
}

function normalizeSections(value: unknown): PublicProfileSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = asRecord(item);
      return {
        content: getString(record.content),
        id: getString(record.id) || `section-${index + 1}`,
        items: getStringArray(record.items),
        order: Number(record.order) || index + 1,
        title: getString(record.title) || "Section",
        visible: typeof record.visible === "boolean" ? record.visible : true,
      };
    })
    .sort((a, b) => a.order - b.order);
}

function section(
  id: string,
  title: string,
  content: string,
  items: string[],
  order: number,
): PublicProfileSection {
  return { content, id, items, order, title, visible: true };
}

function normalizeVisibility(value?: string) {
  return value === "public" || value === "private" || value === "unlisted"
    ? value
    : "unlisted";
}

function cleanPublicText(value: string, fallback = "") {
  const text = value.trim();
  if (!text || /^not clearly/i.test(text)) return fallback;
  return text;
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => getString(item)).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isMissingSupabaseConfigError(error: unknown) {
  return error instanceof Error && error.message.includes("Supabase server configuration is missing");
}
