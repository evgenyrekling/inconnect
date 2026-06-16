import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getOrCreateUserByEmail } from "@/lib/user-profile-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIGESTS = {
  airport_automation_daily: "Airport Automation Daily",
  linkedin_daily: "LinkedIn Daily",
  smart_mobility_daily: "Smart Mobility Daily",
  industrial_automation_daily: "Industrial Automation Daily",
} as const;

type DigestType = keyof typeof DIGESTS;

type SubscriptionRow = {
  id: string;
  user_id: string | null;
  email: string;
  digest_type: DigestType;
  is_active: boolean | null;
  unsubscribe_token: string | null;
  created_at: string;
  updated_at: string | null;
};

type SubscriptionPayload = {
  action?: "subscribe" | "unsubscribe";
  digestType?: string;
  email?: string;
  name?: string;
  userKey?: string;
};

export async function GET(request: NextRequest) {
  const digestType = normalizeDigestType(request.nextUrl.searchParams.get("digestType") ?? "");
  const email = request.nextUrl.searchParams.get("email") ?? "";

  if (!digestType) {
    return NextResponse.json({ error: "A supported digest type is required." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({
      digestType,
      isSubscribed: false,
      subscription: null,
    });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, user_id, email, digest_type, is_active, unsubscribe_token, created_at, updated_at")
      .eq("email", normalizedEmail)
      .eq("digest_type", digestType)
      .maybeSingle<SubscriptionRow>();

    if (error) {
      console.error("DIGEST SUBSCRIPTION STATUS ERROR", {
        digestType,
        email: normalizedEmail,
        error,
      });
      return NextResponse.json(
        { error: "Subscription status could not be loaded.", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      digestType,
      isSubscribed: Boolean(data?.is_active),
      subscription: data ?? null,
    });
  } catch (error) {
    console.error("DIGEST SUBSCRIPTION STATUS FAILED", error);
    return NextResponse.json(
      {
        error: "Subscription status could not be loaded.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as SubscriptionPayload | null;
  const digestType = normalizeDigestType(payload?.digestType ?? "");
  const action = payload?.action === "unsubscribe" ? "unsubscribe" : "subscribe";
  const email = payload?.email?.trim() ?? "";
  const name = payload?.name?.trim() ?? "";
  const userKey = payload?.userKey?.trim() ?? "";

  if (!digestType) {
    return NextResponse.json({ error: "A supported digest type is required." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  if (action === "subscribe" && !userKey && name.length < 2) {
    return NextResponse.json({ error: "Name is required to subscribe." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const normalizedEmail = normalizeEmail(email);
    const isAdminUser = getAdminEmails().includes(normalizedEmail);
    const { user } = await getOrCreateUserByEmail(supabase, {
      email,
      isAdminUser,
      name,
      planType: isAdminUser ? "admin" : "free",
      userKey: userKey || undefined,
    });

    const timestamp = new Date().toISOString();
    const { data: existingSubscription, error: lookupError } = await supabase
      .from("subscriptions")
      .select("id, user_id, email, digest_type, is_active, unsubscribe_token, created_at, updated_at")
      .eq("email", normalizedEmail)
      .eq("digest_type", digestType)
      .maybeSingle<SubscriptionRow>();

    if (lookupError) {
      console.error("DIGEST SUBSCRIPTION LOOKUP ERROR", {
        digestType,
        email: normalizedEmail,
        error: lookupError,
      });
      throw lookupError;
    }

    const subscriptionPayload = {
      user_id: user.id,
      email: normalizedEmail,
      digest_type: digestType,
      is_active: action === "subscribe",
      unsubscribe_token: existingSubscription?.unsubscribe_token ?? createUnsubscribeToken(),
      unsubscribed_at: action === "unsubscribe" ? timestamp : null,
      updated_at: timestamp,
    };

    const result = existingSubscription
      ? await supabase
          .from("subscriptions")
          .update(subscriptionPayload)
          .eq("id", existingSubscription.id)
          .select("id, user_id, email, digest_type, is_active, unsubscribe_token, created_at, updated_at")
          .single<SubscriptionRow>()
      : await supabase
          .from("subscriptions")
          .insert({
            ...subscriptionPayload,
            created_at: timestamp,
          })
          .select("id, user_id, email, digest_type, is_active, unsubscribe_token, created_at, updated_at")
          .single<SubscriptionRow>();

    if (result.error) {
      console.error("DIGEST SUBSCRIPTION SAVE ERROR", {
        digestType,
        email: normalizedEmail,
        error: result.error,
        payload: subscriptionPayload,
      });
      throw result.error;
    }

    const isSubscribed = Boolean(result.data?.is_active);
    return NextResponse.json({
      digestLabel: DIGESTS[digestType],
      digestType,
      email: normalizedEmail,
      isSubscribed,
      message: isSubscribed
        ? `Subscribed to ${DIGESTS[digestType]}.`
        : `Unsubscribed from ${DIGESTS[digestType]}.`,
      subscription: result.data,
      user: {
        email: user.email,
        name: user.name ?? name,
        normalizedEmail: user.normalized_email,
        userId: user.id,
        userKey: user.user_key,
      },
    });
  } catch (error) {
    console.error("DIGEST SUBSCRIPTION FAILED", error);
    return NextResponse.json(
      {
        error: "Digest subscription could not be saved.",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : "",
      },
      { status: 500 },
    );
  }
}

function normalizeDigestType(value: string): DigestType | "" {
  const normalized = value.trim();
  return normalized in DIGESTS ? (normalized as DigestType) : "";
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

function createUnsubscribeToken() {
  return crypto.randomBytes(32).toString("hex");
}
