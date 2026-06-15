import crypto from "node:crypto";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getOrCreateUserByEmail } from "@/lib/user-profile-store";

export const runtime = "nodejs";

type ManualProfileInput = {
  about: string;
  achievements: string;
  company: string;
  contactLinks: string;
  email: string;
  expertise: string[];
  headline: string;
  industries: string[];
  languages: string[];
  location: string;
  linkedinUrl: string;
  name: string;
  problemsSolved: string;
  role: string;
  website: string;
  yearsOfExperience: string;
  customSections: Array<{
    title: string;
    content: string;
  }>;
};

type GeneratedProfile = {
  headline: string;
  sections: Array<{
    content: string;
    id: string;
    items: string[];
    order: number;
    title: string;
    visible: boolean;
  }>;
  strengths: string[];
  summary: string;
};

const generatedProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "strengths", "sections"],
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, maxItems: 8 },
    sections: {
      type: "array",
      minItems: 4,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "content", "items", "order", "visible"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          items: { type: "array", items: { type: "string" }, maxItems: 8 },
          order: { type: "number" },
          visible: { type: "boolean" },
        },
      },
    },
  },
} as const;

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as unknown;
  const input = normalizeManualProfileInput(payload);
  if (!input) {
    return NextResponse.json(
      { error: "Full name, email, professional headline, current company, current role, and country / location are required." },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Profile generation is not configured yet." }, { status: 500 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const normalizedEmail = normalizeEmail(input.email);
    const isAdminUser = getAdminEmails().includes(normalizedEmail);
    const { user } = await getOrCreateUserByEmail(supabase, {
      email: input.email,
      isAdminUser,
      linkedinUrl: input.linkedinUrl,
      name: input.name,
      planType: isAdminUser ? "admin" : "free",
    });

    const generated = await generateManualProfile(input);
    const existingProfile = await findExistingPublicProfile(normalizedEmail, user.id, user.user_key);
    const slug = existingProfile?.slug ?? (await ensureUniqueProfileSlug(slugify(input.name)));
    const profilePayload: Record<string, unknown> = {
      company: input.company,
      display_name: input.name,
      expertise: input.expertise,
      headline: cleanText(input.headline || generated.headline).slice(0, 260),
      industries: input.industries,
      interests: [],
      is_public: existingProfile?.is_public ?? false,
      location: input.location,
      professional_role: input.role,
      sections: normalizeGeneratedSections(generated, input),
      slug,
      strengths: generated.strengths,
      summary: cleanText(input.about || generated.summary),
      updated_at: new Date().toISOString(),
      user_id: user.id,
      user_key: user.user_key,
      visibility: existingProfile?.visibility ?? "unlisted",
    };
    if (!existingProfile) profilePayload.owner_edit_token = crypto.randomBytes(24).toString("hex");

    const query = existingProfile
      ? supabase.from("public_profiles").update(profilePayload).eq("id", existingProfile.id)
      : supabase.from("public_profiles").insert(profilePayload);
    const { data, error } = await query.select("slug, visibility, is_public").single<{
      is_public: boolean | null;
      slug: string;
      visibility: string | null;
    }>();

    if (error) {
      console.error("Manual public profile insert/update failed", { error, profilePayload });
      return NextResponse.json(
        { error: error.message || "Manual profile could not be created." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      profile: {
        isPublic: Boolean(data.is_public),
        slug: data.slug,
        url: `/p/${data.slug}`,
        visibility: data.visibility ?? "unlisted",
      },
      userKey: user.user_key,
    });
  } catch (error) {
    console.error("Manual public profile creation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manual profile could not be created." },
      { status: 500 },
    );
  }
}

async function generateManualProfile(input: ManualProfileInput) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    temperature: 0.65,
    max_output_tokens: 1200,
    input: [
      {
        role: "system",
        content:
          "You are INConnect, a Professional Intelligence Platform. Generate concise, credible public professional profile copy. Do not invent employers, degrees, awards, clients, metrics, or unverifiable claims. Use the user's inputs only.",
      },
      {
        role: "user",
        content: [
          "Generate an INConnect public profile from these manual inputs.",
          `Name: ${input.name}`,
          `Email: ${input.email}`,
          `Location: ${input.location}`,
          `Company: ${input.company}`,
          `Current role: ${input.role}`,
          `Professional headline: ${input.headline}`,
          `LinkedIn URL: ${input.linkedinUrl || "Not provided"}`,
          `Industries: ${input.industries.join(", ")}`,
          `Expertise: ${input.expertise.join(", ")}`,
          `Years of experience: ${input.yearsOfExperience}`,
          `Problems solved: ${input.problemsSolved}`,
          `About: ${input.about}`,
          `Achievements: ${input.achievements}`,
          `Languages: ${input.languages.join(", ")}`,
          `Website: ${input.website}`,
          `Contact links: ${input.contactLinks}`,
          `Custom sections: ${input.customSections
            .map((section) => `${section.title}: ${section.content}`)
            .join(" | ")}`,
          "",
          "Create a professional headline, a short summary, strengths, and profile sections.",
          "Sections should be suitable for a shareable professional profile.",
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "inconnect_manual_public_profile",
        strict: true,
        schema: generatedProfileSchema,
      },
    },
  });

  if (!response.output_parsed) throw new Error("Profile response format error.");
  return response.output_parsed as GeneratedProfile;
}

async function findExistingPublicProfile(_normalizedEmail: string, userId: string, userKey: string) {
  const supabase = getSupabaseAdminClient();
  const { data: emailProfile } = await supabase
    .from("public_profiles")
    .select("id, slug, visibility, is_public")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; is_public: boolean | null; slug: string; visibility: string | null }>();

  if (emailProfile) return emailProfile;

  const { data: keyProfile } = await supabase
    .from("public_profiles")
    .select("id, slug, visibility, is_public")
    .eq("user_key", userKey)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; is_public: boolean | null; slug: string; visibility: string | null }>();

  return keyProfile;
}

async function ensureUniqueProfileSlug(value: string) {
  const supabase = getSupabaseAdminClient();
  const baseSlug = value || `profile-${Date.now()}`;
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

function normalizeGeneratedSections(generated: GeneratedProfile, input: ManualProfileInput) {
  const sections = generated.sections.map((section, index) => ({
    content: cleanText(section.content),
    id: cleanText(section.id) || `section-${index + 1}`,
    items: normalizeStringArray(section.items),
    order: Number(section.order) || index + 1,
    title: cleanText(section.title) || "Profile Section",
    visible: typeof section.visible === "boolean" ? section.visible : true,
  }));
  const optionalSections = [
    input.achievements
      ? {
          content: input.achievements,
          id: "achievements",
          items: normalizeStringArray(input.achievements),
          order: sections.length + 1,
          title: "Achievements",
          visible: true,
        }
      : null,
    input.languages.length
      ? {
          content: "Languages this professional works in.",
          id: "languages",
          items: input.languages,
          order: sections.length + 2,
          title: "Languages",
          visible: true,
        }
      : null,
    input.website || input.contactLinks || input.linkedinUrl
      ? {
          content: [input.website, input.linkedinUrl, input.contactLinks].filter(Boolean).join("\n"),
          id: "contact-links",
          items: [input.website, input.linkedinUrl, ...normalizeStringArray(input.contactLinks)].filter(Boolean),
          order: sections.length + 3,
          title: "Contact Links",
          visible: true,
        }
      : null,
    ...input.customSections.map((section, index) => ({
      content: section.content,
      id: `custom-${index + 1}`,
      items: [],
      order: sections.length + 4 + index,
      title: section.title,
      visible: true,
    })),
  ].filter((section): section is GeneratedProfile["sections"][number] => Boolean(section));
  const allSections = [...sections, ...optionalSections].map((section, index) => ({
    ...section,
    order: index + 1,
  }));

  return allSections.length > 0
    ? allSections
    : [
        {
          content: generated.summary,
          id: "summary",
          items: [],
          order: 1,
          title: "Professional Summary",
          visible: true,
        },
        {
          content: "Core expertise areas.",
          id: "expertise",
          items: input.expertise,
          order: 2,
          title: "Expertise",
          visible: true,
        },
      ];
}

function normalizeManualProfileInput(payload: unknown): ManualProfileInput | null {
  const record = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const input = {
    about: getString(record.about),
    achievements: getString(record.achievements),
    company: getString(record.company),
    contactLinks: getString(record.contactLinks),
    email: getString(record.email),
    expertise: normalizeStringArray(record.expertise),
    headline: getString(record.headline),
    industries: normalizeStringArray(record.industries),
    languages: normalizeStringArray(record.languages),
    location: getString(record.location),
    linkedinUrl: getString(record.linkedinUrl),
    name: getString(record.name),
    problemsSolved: getString(record.problemsSolved),
    role: getString(record.role),
    website: getString(record.website),
    yearsOfExperience: getString(record.yearsOfExperience),
    customSections: normalizeCustomSections(record.customSections),
  };

  if (
    !input.name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
    !input.headline ||
    !input.location ||
    !input.company ||
    !input.role
  ) {
    return null;
  }

  return input;
}

function normalizeCustomSections(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      return {
        content: getString(record.content),
        title: getString(record.title),
      };
    })
    .filter((section) => section.title && section.content)
    .slice(0, 5);
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => getString(item)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanText(value: string) {
  return value.trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}
