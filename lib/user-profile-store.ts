import type { ProfileIntelligenceAssessment } from "@/lib/authority-analysis";
import { createUserKey, normalizeEmail, normalizeLinkedInUrl } from "@/lib/identity";
import type { getSupabaseAdminClient } from "@/lib/supabase-admin";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

export type HeadlineProfileInputs = {
  roles: string[];
  industries: string[];
  expertise: string[];
  values: string[];
  perceptions: string[];
};

export type HeadlineProfileOutputs = {
  recommendedIndex: number;
  headlines: Array<{
    style: string;
    headline: string;
    score: number;
    reason: string;
    bestFor: string;
  }>;
};

export type AboutProfileInputs = {
  roles: string[];
  industries: string[];
  expertise: string[];
  values: string[];
  identities: string[];
  writingStyles: string[];
  callsToAction: string[];
};

export type AboutProfileOutputs = {
  recommendedIndex: number;
  versions: Array<{
    style: string;
    aboutSection: string;
    bestUseCase: string;
    toneScore: number;
    whyThisWorks: string;
  }>;
};

export type ArticleProfileInputs = {
  addInconnectMention: boolean;
  cta: string;
  industry: string;
  keyPoints: string[];
  sourceNotes: string;
  targetAudience: string;
  tone: string;
  topic: string;
};

export type ArticleProfileOutputs = {
  announcementPost: string;
  article: string;
  hashtags: string[];
  headline: string;
  subtitle: string;
};

export type UserProfileDebug = {
  userFound: boolean;
  userCreated: boolean;
  userKeyUpdated: boolean;
  profileFound: boolean;
  profileCreated: boolean;
  profileUpdated: boolean;
  profileMergeCompleted: boolean;
  fieldsUpdated: string[];
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
  seniority_level: string | null;
  current_company: string | null;
  location: string | null;
  industries: unknown;
  sub_industries: unknown;
  interests: unknown;
  top_skills: unknown;
  expertise_domains: unknown;
  business_goals: unknown;
  professional_identity: unknown;
  writing_preferences: unknown;
  desired_perception: string | null;
  professional_archetype: unknown;
  latest_authority_score: number | null;
  latest_assessment_id: string | null;
  last_assessment_date: string | null;
  headline_generator_inputs: unknown;
  headline_generator_outputs: unknown;
  about_generator_inputs: unknown;
  about_generator_outputs: unknown;
  article_generator_inputs: unknown;
  article_generator_outputs: unknown;
  profile_source: string | null;
};

// user_profiles is the long-term profile graph foundation for Trend Radar
// personalization, Content Intelligence, Pro recommendations, authority
// tracking, profile evolution, and future company/team intelligence.
type ProfilePatch = {
  user_id: string;
  user_key: string;
  name?: string;
  email: string;
  linkedin_url?: string;
  professional_role?: string;
  seniority_level?: string;
  current_company?: string;
  location?: string;
  industries?: string[];
  sub_industries?: string[];
  interests?: string[];
  top_skills?: string[];
  expertise_domains?: string[];
  business_goals?: string[];
  professional_identity?: string[];
  writing_preferences?: string[];
  desired_perception?: string;
  professional_archetype?: ProfileIntelligenceAssessment["professionalArchetype"];
  latest_authority_score?: number;
  latest_assessment_id?: string;
  last_assessment_date?: string;
  headline_generator_inputs?: HeadlineProfileInputs;
  headline_generator_outputs?: HeadlineProfileOutputs;
  about_generator_inputs?: AboutProfileInputs;
  about_generator_outputs?: AboutProfileOutputs;
  article_generator_inputs?: ArticleProfileInputs;
  article_generator_outputs?: ArticleProfileOutputs;
  profile_source:
    | "assessment"
    | "headline_generator"
    | "about_generator"
    | "article_generator";
};

export class UserProfileStorageError extends Error {
  stage: string;
  details: string;
  supabaseMessage: string;
  supabaseDetails: string;
  supabaseHint: string;
  supabaseCode: string;

  constructor(stage: string, error: unknown) {
    const supabaseMessage =
      getSupabaseErrorField(error, "message") ||
      getErrorSummary(error) ||
      "Unknown user profile storage error";
    const supabaseDetails = getSupabaseErrorField(error, "details");
    const supabaseHint = getSupabaseErrorField(error, "hint");
    const supabaseCode = getSupabaseErrorField(error, "code");
    super(supabaseMessage);
    this.name = "UserProfileStorageError";
    this.stage = stage;
    this.details = getErrorDetails(error);
    this.supabaseMessage = supabaseMessage;
    this.supabaseDetails = supabaseDetails;
    this.supabaseHint = supabaseHint;
    this.supabaseCode = supabaseCode;
  }
}

export function isUserProfileStorageError(error: unknown): error is UserProfileStorageError {
  return error instanceof UserProfileStorageError;
}

export async function findUserByEmailOrKey(
  supabase: SupabaseAdminClient,
  values: {
    email: string;
    userKey?: string;
  },
) {
  const normalizedEmail = normalizeEmail(values.email);

  try {
    const { data: emailUser, error: emailError } = await supabase
      .from("users")
      .select(
        "id, user_key, email, linkedin_url, normalized_email, normalized_linkedin_url, plan_type, is_admin",
      )
      .eq("normalized_email", normalizedEmail)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<UserRow>();

    if (emailError) {
      console.error("INConnect Supabase users email lookup error", {
        normalizedEmail,
        error: emailError,
      });
      throw emailError;
    }
    if (emailUser) return emailUser;

    if (!values.userKey) return null;

    const { data: keyUser, error: keyError } = await supabase
      .from("users")
      .select(
        "id, user_key, email, linkedin_url, normalized_email, normalized_linkedin_url, plan_type, is_admin",
      )
      .eq("user_key", values.userKey)
      .maybeSingle<UserRow>();

    if (keyError) {
      console.error("INConnect Supabase users user_key lookup error", {
        userKey: values.userKey,
        error: keyError,
      });
      throw keyError;
    }
    return keyUser;
  } catch (error) {
    throw new UserProfileStorageError("users lookup", error);
  }
}

export async function upsertUserIdentity(
  supabase: SupabaseAdminClient,
  values: {
    email: string;
    isAdminUser: boolean;
    linkedinUrl?: string;
    planType: string;
    userKey?: string;
  },
) {
  const normalizedEmail = normalizeEmail(values.email);
  const linkedinUrl = cleanText(values.linkedinUrl);
  const normalizedLinkedInUrl = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : "";
  const nextUserKey = values.userKey ?? createUserKey(normalizedEmail, normalizedLinkedInUrl);
  const existingUser = await findUserByEmailOrKey(supabase, {
    email: normalizedEmail,
    userKey: nextUserKey,
  });
  const debug = createProfileDebug(existingUser);
  const timestamp = new Date().toISOString();
  const planType =
    values.isAdminUser || existingUser?.is_admin
      ? "admin"
      : existingUser?.plan_type === "pro"
        ? "pro"
        : values.planType || "free";

  console.info("INConnect user identity lookup completed", {
    email: normalizedEmail,
    userFound: Boolean(existingUser),
    userCreated: false,
    existingUserId: existingUser?.id ?? null,
    existingUserKey: existingUser?.user_key ?? null,
    requestedUserKey: nextUserKey,
  });

  try {
    if (existingUser) {
      const previousUserKey = existingUser.user_key;
      const shouldUpdateUserKey =
        previousUserKey !== nextUserKey &&
        Boolean(normalizedLinkedInUrl) &&
        (!existingUser.normalized_linkedin_url ||
          previousUserKey === createUserKey(normalizedEmail, ""));
      const nextLinkedInUrl = linkedinUrl || existingUser.linkedin_url || null;
      const nextNormalizedLinkedInUrl =
        normalizedLinkedInUrl || existingUser.normalized_linkedin_url || null;
      const userUpdatePayload = {
        user_key: shouldUpdateUserKey ? nextUserKey : previousUserKey,
        email: values.email.trim(),
        linkedin_url: nextLinkedInUrl,
        normalized_email: normalizedEmail,
        normalized_linkedin_url: nextNormalizedLinkedInUrl,
        is_admin: values.isAdminUser || Boolean(existingUser.is_admin),
        plan_type: planType,
        updated_at: timestamp,
      };

      console.info("INConnect Supabase users update payload", {
        userFound: true,
        userCreated: false,
        userId: existingUser.id,
        payload: userUpdatePayload,
      });

      const { data, error } = await supabase
        .from("users")
        .update(userUpdatePayload)
        .eq("id", existingUser.id)
        .select(
          "id, user_key, email, linkedin_url, normalized_email, normalized_linkedin_url, plan_type, is_admin",
        )
        .single<UserRow>();

      if (error) {
        console.error("INConnect Supabase users update error", {
          payload: userUpdatePayload,
          error,
        });
        throw error;
      }

      debug.userKeyUpdated = shouldUpdateUserKey;
      debug.fieldsUpdated.push("users");

      if (shouldUpdateUserKey) {
        await rekeyUserArtifacts(supabase, previousUserKey, nextUserKey);
      }

      console.info("INConnect user identity saved", {
        userFound: true,
        userCreated: false,
        userKeyUpdated: shouldUpdateUserKey,
        user: data,
      });

      return { user: data, debug };
    }

    const userInsertPayload = {
      user_key: nextUserKey,
      email: values.email.trim(),
      linkedin_url: linkedinUrl || null,
      normalized_email: normalizedEmail,
      normalized_linkedin_url: normalizedLinkedInUrl || null,
      is_admin: values.isAdminUser,
      plan_type: planType,
      updated_at: timestamp,
    };

    console.info("INConnect Supabase users insert payload", {
      userFound: false,
      userCreated: true,
      payload: userInsertPayload,
    });

    const { data, error } = await supabase
      .from("users")
      .insert(userInsertPayload)
      .select(
        "id, user_key, email, linkedin_url, normalized_email, normalized_linkedin_url, plan_type, is_admin",
      )
      .single<UserRow>();

    if (error) {
      console.error("INConnect Supabase users insert error", {
        payload: userInsertPayload,
        error,
      });
      throw error;
    }

    debug.userCreated = true;
    debug.fieldsUpdated.push("users");

    console.info("INConnect user identity saved", {
      userFound: false,
      userCreated: true,
      userKeyUpdated: false,
      user: data,
    });

    return { user: data, debug };
  } catch (error) {
    throw new UserProfileStorageError("users insert/update", error);
  }
}

export async function upsertProfileFromAssessment(
  supabase: SupabaseAdminClient,
  values: {
    assessment: ProfileIntelligenceAssessment;
    assessmentDate: string;
    assessmentId: string;
    email: string;
    linkedinUrl: string;
    user: UserRow;
  },
) {
  const snapshot = values.assessment.profileSnapshot;
  const patch: ProfilePatch = {
    user_id: values.user.id,
    user_key: values.user.user_key,
    name: cleanProfileText(snapshot.name),
    email: normalizeEmail(values.email),
    linkedin_url: values.linkedinUrl.trim(),
    professional_role: cleanProfileText(snapshot.currentRole),
    seniority_level: inferSeniorityLevel([
      snapshot.currentRole,
      values.assessment.marketPosition,
      values.assessment.corePositioning,
      snapshot.estimatedYearsOfExperience,
    ]),
    current_company: cleanProfileText(snapshot.currentCompany),
    location: cleanProfileText(snapshot.location),
    industries: snapshot.topIndustries,
    sub_industries: values.assessment.positioningSnapshot.map((item) => item.label),
    interests: values.assessment.authorityGrowthAreas,
    top_skills: [...snapshot.topSkills, ...values.assessment.topCompetencies],
    expertise_domains: values.assessment.keyExpertiseDomains,
    desired_perception: values.assessment.corePositioning,
    professional_archetype: values.assessment.professionalArchetype,
    latest_authority_score: values.assessment.totalScore,
    latest_assessment_id: values.assessmentId,
    last_assessment_date: values.assessmentDate,
    profile_source: "assessment",
  };

  return upsertUserProfile(supabase, patch);
}

export async function upsertProfileFromHeadlineGenerator(
  supabase: SupabaseAdminClient,
  values: {
    email: string;
    inputs: HeadlineProfileInputs;
    name: string;
    outputs: HeadlineProfileOutputs;
    user: UserRow;
  },
) {
  const patch: ProfilePatch = {
    user_id: values.user.id,
    user_key: values.user.user_key,
    name: cleanProfileText(values.name),
    email: normalizeEmail(values.email),
    professional_role: values.inputs.roles[0],
    seniority_level: inferSeniorityLevel(values.inputs.roles),
    industries: values.inputs.industries,
    top_skills: values.inputs.expertise,
    expertise_domains: values.inputs.expertise,
    business_goals: values.inputs.values,
    desired_perception: values.inputs.perceptions.join("; "),
    headline_generator_inputs: values.inputs,
    headline_generator_outputs: values.outputs,
    profile_source: "headline_generator",
  };

  return upsertUserProfile(supabase, patch);
}

export async function upsertProfileFromAboutGenerator(
  supabase: SupabaseAdminClient,
  values: {
    email: string;
    inputs: AboutProfileInputs;
    name: string;
    outputs: AboutProfileOutputs;
    user: UserRow;
  },
) {
  const patch: ProfilePatch = {
    user_id: values.user.id,
    user_key: values.user.user_key,
    name: cleanProfileText(values.name),
    email: normalizeEmail(values.email),
    professional_role: values.inputs.roles[0],
    seniority_level: inferSeniorityLevel(values.inputs.roles),
    industries: values.inputs.industries,
    top_skills: values.inputs.expertise,
    expertise_domains: values.inputs.expertise,
    business_goals: values.inputs.values,
    professional_identity: values.inputs.identities,
    writing_preferences: values.inputs.writingStyles,
    desired_perception: values.inputs.identities.join("; "),
    about_generator_inputs: values.inputs,
    about_generator_outputs: values.outputs,
    profile_source: "about_generator",
  };

  return upsertUserProfile(supabase, patch);
}

export async function upsertProfileFromArticleGenerator(
  supabase: SupabaseAdminClient,
  values: {
    email: string;
    inputs: ArticleProfileInputs;
    outputs: ArticleProfileOutputs;
    user: UserRow;
  },
) {
  const patch: ProfilePatch = {
    user_id: values.user.id,
    user_key: values.user.user_key,
    email: normalizeEmail(values.email),
    industries: values.inputs.industry ? [values.inputs.industry] : [],
    business_goals: [values.inputs.targetAudience, values.inputs.cta].filter(Boolean),
    article_generator_inputs: values.inputs,
    article_generator_outputs: values.outputs,
    profile_source: "article_generator",
  };

  return upsertUserProfile(supabase, patch);
}

async function upsertUserProfile(supabase: SupabaseAdminClient, patch: ProfilePatch) {
  const existingProfile = await getExistingUserProfile(supabase, patch.email);
  const debug = createProfileDebug(null);
  debug.profileFound = Boolean(existingProfile);
  debug.profileCreated = !existingProfile;

  const merged = mergeProfilePatch(existingProfile, patch);
  const fieldsUpdated = getUpdatedFields(existingProfile, merged);
  debug.fieldsUpdated.push(...fieldsUpdated);
  const action = existingProfile ? "update" : "insert";

  console.info("INConnect user_profiles lookup completed", {
    email: patch.email,
    profileFound: Boolean(existingProfile),
    profileCreated: !existingProfile,
    existingProfileId: existingProfile?.id ?? null,
  });

  console.info(`INConnect Supabase user_profiles ${action} payload`, {
    action,
    profileFound: Boolean(existingProfile),
    profileCreated: !existingProfile,
    profileId: existingProfile?.id ?? null,
    payload: merged,
  });

  try {
    const query = existingProfile
      ? supabase.from("user_profiles").update(merged).eq("id", existingProfile.id)
      : supabase.from("user_profiles").insert(merged);
    const { error } = await query;

    if (error) {
      console.error(`INConnect Supabase user_profiles ${action} error`, {
        action,
        profileId: existingProfile?.id ?? null,
        payload: merged,
        error,
      });
      throw error;
    }

    debug.profileUpdated = true;
    debug.profileMergeCompleted = true;

    console.info("INConnect user profile merge completed", {
      ...debug,
      action,
      payload: merged,
    });

    return debug;
  } catch (error) {
    throw new UserProfileStorageError("user_profiles insert/update", error);
  }
}

async function getExistingUserProfile(
  supabase: SupabaseAdminClient,
  normalizedEmail: string,
) {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle<UserProfileRow>();

    if (error) {
      console.error("INConnect Supabase user_profiles lookup error", {
        email: normalizedEmail,
        error,
      });
      throw error;
    }
    return data;
  } catch (error) {
    throw new UserProfileStorageError("user_profiles lookup", error);
  }
}

function mergeProfilePatch(existingProfile: UserProfileRow | null, patch: ProfilePatch) {
  const source = existingProfile;

  return {
    user_id: patch.user_id,
    user_key: patch.user_key,
    name: preferText(patch.name, source?.name),
    email: patch.email,
    linkedin_url: preferText(patch.linkedin_url, source?.linkedin_url),
    professional_role: preferText(patch.professional_role, source?.professional_role),
    seniority_level: preferText(patch.seniority_level, source?.seniority_level),
    current_company: preferText(patch.current_company, source?.current_company),
    location: preferText(patch.location, source?.location),
    industries: mergeJsonbArrays(source?.industries, patch.industries),
    sub_industries: mergeJsonbArrays(source?.sub_industries, patch.sub_industries),
    interests: mergeJsonbArrays(source?.interests, patch.interests),
    top_skills: mergeJsonbArrays(source?.top_skills, patch.top_skills),
    expertise_domains: mergeJsonbArrays(source?.expertise_domains, patch.expertise_domains),
    business_goals: mergeJsonbArrays(source?.business_goals, patch.business_goals),
    professional_identity: mergeJsonbArrays(
      source?.professional_identity,
      patch.professional_identity,
    ),
    writing_preferences: mergeJsonbArrays(
      source?.writing_preferences,
      patch.writing_preferences,
    ),
    desired_perception: preferText(patch.desired_perception, source?.desired_perception),
    professional_archetype: patch.professional_archetype ?? source?.professional_archetype ?? null,
    latest_authority_score:
      typeof patch.latest_authority_score === "number"
        ? patch.latest_authority_score
        : source?.latest_authority_score ?? null,
    latest_assessment_id: patch.latest_assessment_id ?? source?.latest_assessment_id ?? null,
    last_assessment_date: patch.last_assessment_date ?? source?.last_assessment_date ?? null,
    headline_generator_inputs:
      patch.headline_generator_inputs ?? source?.headline_generator_inputs ?? null,
    headline_generator_outputs:
      patch.headline_generator_outputs ?? source?.headline_generator_outputs ?? null,
    about_generator_inputs:
      patch.about_generator_inputs ?? source?.about_generator_inputs ?? null,
    about_generator_outputs:
      patch.about_generator_outputs ?? source?.about_generator_outputs ?? null,
    article_generator_inputs:
      patch.article_generator_inputs ?? source?.article_generator_inputs ?? null,
    article_generator_outputs:
      patch.article_generator_outputs ?? source?.article_generator_outputs ?? null,
    profile_source: mergeProfileSource(source?.profile_source, patch.profile_source),
    updated_at: new Date().toISOString(),
  };
}

async function rekeyUserArtifacts(
  supabase: SupabaseAdminClient,
  previousUserKey: string,
  nextUserKey: string,
) {
  if (!previousUserKey || previousUserKey === nextUserKey) return;

  const updates = [
    supabase.from("assessments").update({ user_key: nextUserKey }).eq("user_key", previousUserKey),
    supabase
      .from("usage_limits")
      .update({ user_key: nextUserKey, updated_at: new Date().toISOString() })
      .eq("user_key", previousUserKey),
    supabase
      .from("assessment_feedback")
      .update({ user_key: nextUserKey })
      .eq("user_key", previousUserKey),
    supabase.from("user_profiles").update({ user_key: nextUserKey }).eq("user_key", previousUserKey),
  ];

  const results = await Promise.allSettled(updates);
  const rejected = results.filter((result) => result.status === "rejected");
  if (rejected.length > 0 && process.env.NODE_ENV === "development") {
    console.warn("INConnect user key artifact migration had non-blocking failures", rejected);
  }
}

function createProfileDebug(existingUser: UserRow | null): UserProfileDebug {
  return {
    userFound: Boolean(existingUser),
    userCreated: false,
    userKeyUpdated: false,
    profileFound: false,
    profileCreated: false,
    profileUpdated: false,
    profileMergeCompleted: false,
    fieldsUpdated: [],
  };
}

function mergeJsonbArrays(existingValue: unknown, incomingValue?: string[]) {
  const existing = normalizeStringArray(existingValue);
  const incoming = normalizeStringArray(incomingValue);
  if (incoming.length === 0) return existing;

  return Array.from(new Set([...existing, ...incoming]));
}

function normalizeStringArray(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return source
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function preferText(incoming?: string | null, existing?: string | null) {
  const cleanIncoming = cleanProfileText(incoming);
  if (cleanIncoming) return cleanIncoming;
  return cleanProfileText(existing) || null;
}

function cleanText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanProfileText(value?: string | null) {
  const clean = cleanText(value);
  return clean && !/^not clearly/i.test(clean) && !/^not clearly extracted/i.test(clean)
    ? clean
    : "";
}

function inferSeniorityLevel(values: string[]) {
  const text = values.join(" ").toLowerCase();
  if (/\b(chief|c-level|ceo|coo|cto|cmo|founder|president|vp|vice president|executive)\b/.test(text)) {
    return "Executive";
  }
  if (/\b(director|head of|global|regional|lead|leader|principal)\b/.test(text)) {
    return "Senior Leadership";
  }
  if (/\b(senior|manager|20\+|2[0-9]\s*(years|yrs)|decade)\b/.test(text)) {
    return "Senior Professional";
  }
  if (/\b(specialist|consultant|engineer|analyst|advisor)\b/.test(text)) {
    return "Specialist";
  }
  return "";
}

function mergeProfileSource(existingSource: string | null | undefined, incomingSource: string) {
  const existing = normalizeStringArray(existingSource ? existingSource.split(",") : []);
  return Array.from(new Set([...existing, incomingSource])).join(",");
}

function getUpdatedFields(existingProfile: UserProfileRow | null, merged: Record<string, unknown>) {
  if (!existingProfile) return Object.keys(merged).filter((field) => field !== "updated_at");

  return Object.entries(merged)
    .filter(([field, value]) => field !== "updated_at" && !areProfileValuesEqual(existingProfile[field as keyof UserProfileRow], value))
    .map(([field]) => field);
}

function areProfileValuesEqual(previous: unknown, next: unknown) {
  return JSON.stringify(previous ?? null) === JSON.stringify(next ?? null);
}

function getErrorSummary(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : JSON.stringify(message);
  }
  return String(error);
}

function getErrorDetails(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.stack || error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getSupabaseErrorField(
  error: unknown,
  field: "message" | "details" | "hint" | "code",
) {
  if (!error || typeof error !== "object") return "";

  if (error instanceof UserProfileStorageError) {
    const nestedField =
      field === "message"
        ? error.supabaseMessage
        : field === "details"
          ? error.supabaseDetails
          : field === "hint"
            ? error.supabaseHint
            : error.supabaseCode;
    return nestedField || "";
  }

  if (field === "message" && error instanceof Error) {
    return error.message;
  }

  const value = (error as Record<string, unknown>)[field];
  if (typeof value === "string") return value;
  if (value === null || typeof value === "undefined") return "";
  return String(value);
}
