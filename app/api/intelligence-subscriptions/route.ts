import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  isUserProfileStorageError,
  upsertProfileFromIntelligenceSubscription,
  upsertUserIdentity,
} from "@/lib/user-profile-store";

export const runtime = "nodejs";

type IntelligenceSubscriptionRequest = {
  email: string;
  intelligenceType: string;
  name: string;
  profileConsent: boolean;
  userKey?: string;
};

type IntelligenceSubscriptionRow = {
  id: string;
  is_active: boolean | null;
};

const INTELLIGENCE_TYPES = {
  airportAutomation: {
    label: "Airport Automation Daily",
    profileInterests: [
      "Airport Automation",
      "Smart Airports",
      "Aviation Technology",
    ],
  },
  airport_automation: {
    label: "Airport Automation Daily",
    profileInterests: [
      "Airport Automation",
      "Smart Airports",
      "Aviation Technology",
    ],
  },
  linkedin_daily: {
    label: "LinkedIn Daily",
    profileInterests: [
      "LinkedIn Growth",
      "LinkedIn Visibility",
      "Networking",
      "Content Strategy",
      "Professional Visibility",
      "Personal Branding",
    ],
  },
  smart_mobility: {
    label: "Smart Mobility Daily",
    profileInterests: ["Smart Mobility", "Transportation Technology", "Mobility Trends"],
  },
  industrial_automation: {
    label: "Industrial Automation Daily",
    profileInterests: [
      "Industrial Automation",
      "Robotics",
      "Industrial AI",
      "Smart Infrastructure",
    ],
  },
  network_early_access: {
    label: "Professional Network Early Access",
    profileInterests: [
      "Professional Network",
      "Business Matching",
      "Partner Discovery",
      "Opportunity Matching",
    ],
  },
} as const;

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as unknown;
  const input = normalizeSubscriptionRequest(payload);

  if (!input) {
    return NextResponse.json(
      { error: "Name, email, and intelligence type are required." },
      { status: 400 },
    );
  }

  const isKnownUser = Boolean(input.userKey);
  if (!isKnownUser && !input.profileConsent) {
    return NextResponse.json(
      {
        error:
          "Consent is required before INConnect can store your information and intelligence subscription.",
      },
      { status: 400 },
    );
  }

  const intelligenceConfig =
    INTELLIGENCE_TYPES[input.intelligenceType as keyof typeof INTELLIGENCE_TYPES];

  if (!intelligenceConfig) {
    return NextResponse.json(
      { error: "This intelligence stream is not available yet." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdminClient();
    const normalizedEmail = normalizeEmail(input.email);
    const isAdminUser = getAdminEmails().includes(normalizedEmail);
    const { user } = await upsertUserIdentity(supabase, {
      email: input.email,
      isAdminUser,
      planType: isAdminUser ? "admin" : "free",
      userKey: input.userKey,
    });

    const { data: existingSubscription, error: lookupError } = await supabase
      .from("intelligence_subscriptions")
      .select("id, is_active")
      .eq("email", normalizedEmail)
      .eq("intelligence_type", input.intelligenceType)
      .limit(1)
      .maybeSingle<IntelligenceSubscriptionRow>();

    if (lookupError) {
      console.error("INConnect intelligence subscription lookup error", {
        email: normalizedEmail,
        error: lookupError,
        intelligenceType: input.intelligenceType,
      });
      throw lookupError;
    }

    const timestamp = new Date().toISOString();
    const subscriptionPayload = {
      user_id: user.id,
      user_key: user.user_key,
      name: input.name || null,
      email: normalizedEmail,
      intelligence_type: input.intelligenceType,
      is_active: true,
      updated_at: timestamp,
    };

    if (existingSubscription) {
      const { error: updateError } = await supabase
        .from("intelligence_subscriptions")
        .update(subscriptionPayload)
        .eq("id", existingSubscription.id);

      if (updateError) {
        console.error("INConnect intelligence subscription update error", {
          error: updateError,
          payload: subscriptionPayload,
          subscriptionId: existingSubscription.id,
        });
        throw updateError;
      }
    } else {
      const { error: insertError } = await supabase
        .from("intelligence_subscriptions")
        .insert({
          ...subscriptionPayload,
          created_at: timestamp,
        });

      if (insertError) {
        console.error("INConnect intelligence subscription insert error", {
          error: insertError,
          payload: subscriptionPayload,
        });
        throw insertError;
      }
    }

    await upsertProfileFromIntelligenceSubscription(supabase, {
      email: input.email,
      interests: [...intelligenceConfig.profileInterests],
      name: input.name,
      user,
    });

    const alreadySubscribed = Boolean(existingSubscription);
    return NextResponse.json({
      alreadySubscribed,
      email: normalizedEmail,
      intelligenceType: input.intelligenceType,
      message: alreadySubscribed
        ? `You are already subscribed to ${intelligenceConfig.label}.`
        : `You are subscribed to ${intelligenceConfig.label}.`,
      userKey: user.user_key,
    });
  } catch (error) {
    if (isUserProfileStorageError(error)) {
      console.error("INConnect intelligence profile enrichment failed", {
        details: error.details,
        error: error.message,
        stage: error.stage,
      });
      return NextResponse.json(
        {
          error: "Intelligence subscription could not be stored.",
          stage: error.stage,
          details: process.env.NODE_ENV === "development" ? error.details : "",
        },
        { status: 500 },
      );
    }

    console.error("INConnect intelligence subscription failed", error);
    return NextResponse.json(
      {
        error: "Intelligence subscription could not be stored.",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : "",
      },
      { status: 500 },
    );
  }
}

function normalizeSubscriptionRequest(
  value: unknown,
): IntelligenceSubscriptionRequest | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const name = getString(record.name, 180);
  const email = getString(record.email, 320);
  const intelligenceType = normalizeIntelligenceType(
    getString(record.intelligenceType, 80),
  );
  const userKey = getString(record.userKey, 180);
  const profileConsent = record.profileConsent === true;

  if (!isValidEmail(email) || !intelligenceType || (!userKey && name.length < 2)) {
    return null;
  }

  return {
    email,
    intelligenceType,
    name,
    profileConsent,
    userKey: userKey || undefined,
  };
}

function normalizeIntelligenceType(value: string) {
  return value === "b2b_sales" ? "linkedin_daily" : value;
}

function getString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}
