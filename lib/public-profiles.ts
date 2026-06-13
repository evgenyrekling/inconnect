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
  ai_response: unknown;
  authority_score: number | null;
  core_positioning: string | null;
  created_at: string;
  expertise_domains: unknown;
  market_position: string | null;
  positioning_snapshot: unknown;
  professional_archetype: unknown;
  share_text: string | null;
  top_competencies: unknown;
  user_id: string | null;
  user_key: string | null;
};

type UserRow = {
  email: string | null;
  id: string;
  linkedin_url: string | null;
  user_key: string;
};

type UserProfileRow = {
  current_company: string | null;
  email: string | null;
  expertise_domains: unknown;
  industries: unknown;
  interests: unknown;
  latest_authority_score: number | null;
  location: string | null;
  name: string | null;
  professional_archetype: unknown;
  professional_role: string | null;
  top_skills: unknown;
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

  const { data: user } = await supabase
    .from("users")
    .select("id, user_key, email, linkedin_url")
    .eq("user_key", userKey)
    .maybeSingle<UserRow>();

  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select(
      "user_id, user_key, name, email, professional_role, current_company, location, industries, interests, top_skills, expertise_domains, professional_archetype, latest_authority_score",
    )
    .eq("user_key", userKey)
    .maybeSingle<UserProfileRow>();

  const { data: assessment, error } = await supabase
    .from("assessments")
    .select(
      "user_id, user_key, authority_score, market_position, core_positioning, positioning_snapshot, professional_archetype, top_competencies, expertise_domains, ai_response, share_text, created_at",
    )
    .or(
      [
        `user_key.eq.${userKey}`,
        user?.id ? `user_id.eq.${user.id}` : "",
      ]
        .filter(Boolean)
        .join(","),
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AssessmentRow>();

  if (error) throw new Error(error.message || "Latest assessment lookup failed.");
  if (!assessment) throw new Error("No assessment found for this user.");

  const profilePayload = buildPublicProfilePayload({
    assessment,
    existingSlug: existingProfile?.slug,
    user: user ?? null,
    userProfile: userProfile ?? null,
  });

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
    company?: string;
    displayName?: string;
    headline?: string;
    location?: string;
    professionalRole?: string;
    sections?: PublicProfileSection[];
    summary?: string;
    visibility?: string;
  },
) {
  const supabase = getSupabaseAdminClient();
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof values.company === "string") updatePayload.company = values.company.trim();
  if (typeof values.displayName === "string") updatePayload.display_name = values.displayName.trim();
  if (typeof values.headline === "string") updatePayload.headline = values.headline.trim();
  if (typeof values.location === "string") updatePayload.location = values.location.trim();
  if (typeof values.professionalRole === "string") {
    updatePayload.professional_role = values.professionalRole.trim();
  }
  if (Array.isArray(values.sections)) updatePayload.sections = values.sections;
  if (typeof values.summary === "string") updatePayload.summary = values.summary.trim();
  if (typeof values.visibility === "string") {
    const visibility = normalizeVisibility(values.visibility);
    updatePayload.is_public = visibility === "public";
    updatePayload.visibility = visibility;
  }

  const { data, error } = await supabase
    .from("public_profiles")
    .update(updatePayload)
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

function buildPublicProfilePayload({
  assessment,
  existingSlug,
  user,
  userProfile,
}: {
  assessment: AssessmentRow;
  existingSlug?: string | null;
  user: UserRow | null;
  userProfile: UserProfileRow | null;
}) {
  const aiResponse = asRecord(assessment.ai_response);
  const snapshot = asRecord(assessment.positioning_snapshot || aiResponse.profileSnapshot);
  const displayName = cleanPublicText(
    getString(userProfile?.name) || getString(snapshot.name),
    "INConnect Professional",
  );
  const professionalRole = cleanPublicText(
    getString(userProfile?.professional_role) || getString(snapshot.currentRole),
    "",
  );
  const company = cleanPublicText(
    getString(userProfile?.current_company) || getString(snapshot.currentCompany),
    "",
  );
  const location = cleanPublicText(
    getString(userProfile?.location) || getString(snapshot.location),
    "",
  );
  const industries = uniqueStrings([
    ...getStringArray(userProfile?.industries),
    ...getStringArray(snapshot.topIndustries),
    ...getStringArray(aiResponse.keyExpertiseDomains),
  ]).slice(0, 6);
  const expertise = uniqueStrings([
    ...getStringArray(assessment.expertise_domains),
    ...getStringArray(userProfile?.expertise_domains),
    ...getStringArray(userProfile?.top_skills),
    ...getStringArray(aiResponse.keyExpertiseDomains),
    ...getStringArray(snapshot.topSkills),
  ]).slice(0, 8);
  const strengths = uniqueStrings([
    ...getStringArray(assessment.top_competencies),
    ...getStringArray(aiResponse.topCompetencies),
    ...getStringArray(aiResponse.positiveHighlights),
  ]).slice(0, 8);
  const interests = uniqueStrings(getStringArray(userProfile?.interests)).slice(0, 8);
  const archetype =
    assessment.professional_archetype ||
    userProfile?.professional_archetype ||
    aiResponse.professionalArchetype ||
    null;
  const archetypeRecord = asRecord(archetype);
  const headline =
    cleanPublicText(assessment.core_positioning ?? "", "") ||
    cleanPublicText(getString(aiResponse.corePositioning), "") ||
    [professionalRole, industries[0], expertise[0]].filter(Boolean).join(" | ");
  const summary =
    cleanPublicText(assessment.market_position ?? "", "") ||
    cleanPublicText(getString(aiResponse.marketPosition), "") ||
    cleanPublicText(getString(aiResponse.whatMakesYouUnique), "") ||
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
    section("interests", "Interests", "Professional interests connected to this profile.", interests, 6),
    section("thought-leadership", "Thought Leadership", cleanPublicText(getString(aiResponse.whatMakesYouUnique), ""), [], 7),
    section("business-focus", "Business Focus", cleanPublicText(getString(aiResponse.businessImpact), "Future business focus will be added by the profile owner."), [], 8),
    section("connect", "Contact / Connect CTA", "Connection requests through INConnect are coming soon.", [], 9),
  ].filter((profileSection) => profileSection.content || profileSection.items.length > 0);

  return {
    authority_score:
      assessment.authority_score ??
      userProfile?.latest_authority_score ??
      getNumber(aiResponse.totalScore),
    company,
    display_name: displayName,
    expertise,
    headline: headline.slice(0, 260),
    industries,
    interests,
    location,
    professional_archetype: archetype,
    professional_role: professionalRole,
    sections,
    slug: existingSlug || slugify(displayName),
    strengths,
    summary,
    user_id: assessment.user_id ?? userProfile?.user_id ?? user?.id ?? null,
    user_key: assessment.user_key ?? userProfile?.user_key ?? user?.user_key ?? "",
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

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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
