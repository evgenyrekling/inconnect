import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getVerifiedInconnectUserFromRequest } from "@/lib/auth-server";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

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
  normalized_email: string | null;
  name: string | null;
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

type SupabaseLikeError = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
};

export async function GET(request: NextRequest) {
  const digestType = normalizeDigestType(request.nextUrl.searchParams.get("digestType") ?? "");

  if (!digestType) {
    return NextResponse.json({ error: "A supported digest type is required." }, { status: 400 });
  }

  const verifiedUser = await getVerifiedInconnectUserFromRequest(request);
  if (!verifiedUser) {
    return NextResponse.json({
      digestType,
      isSubscribed: false,
      requiresSignIn: true,
      subscription: null,
    });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const normalizedEmail = normalizeEmail(verifiedUser.email);
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, user_id, email, normalized_email, name, digest_type, is_active, unsubscribe_token, created_at, updated_at")
      .eq("normalized_email", normalizedEmail)
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

  if (!digestType) {
    return NextResponse.json({ error: "A supported digest type is required." }, { status: 400 });
  }

  const verifiedUser = await getVerifiedInconnectUserFromRequest(request);
  if (!verifiedUser) {
    return NextResponse.json(
      { error: "Verified email sign-in is required." },
      { status: 401 },
    );
  }

  try {
    const supabase = getSupabaseAdminClient();
    const normalizedEmail = normalizeEmail(verifiedUser.email);

    const timestamp = new Date().toISOString();
    const { data: existingSubscription, error: lookupError } = await supabase
      .from("subscriptions")
      .select("id, user_id, email, normalized_email, name, digest_type, is_active, unsubscribe_token, created_at, updated_at")
      .eq("normalized_email", normalizedEmail)
      .eq("digest_type", digestType)
      .maybeSingle<SubscriptionRow>();

    if (lookupError) {
      console.error("DIGEST SUBSCRIPTION LOOKUP ERROR", {
        code: lookupError.code,
        details: lookupError.details,
        digestType,
        email: normalizedEmail,
        error: lookupError,
        hint: lookupError.hint,
        message: lookupError.message,
        operation: "subscriptions.select_existing_subscription",
      });
      return createSubscriptionErrorResponse({
        error: lookupError,
        operation: "subscriptions.select_existing_subscription",
      });
    }

    const subscriptionPayload = {
      user_id: verifiedUser.userId,
      email: normalizedEmail,
      normalized_email: normalizedEmail,
      name: verifiedUser.name || null,
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
          .select("id, user_id, email, normalized_email, name, digest_type, is_active, unsubscribe_token, created_at, updated_at")
          .single<SubscriptionRow>()
      : await supabase
          .from("subscriptions")
          .insert({
            ...subscriptionPayload,
            created_at: timestamp,
          })
          .select("id, user_id, email, normalized_email, name, digest_type, is_active, unsubscribe_token, created_at, updated_at")
          .single<SubscriptionRow>();

    if (result.error) {
      console.error("DIGEST SUBSCRIPTION SAVE ERROR", {
        code: result.error.code,
        details: result.error.details,
        digestType,
        email: normalizedEmail,
        error: result.error,
        hint: result.error.hint,
        message: result.error.message,
        operation: existingSubscription
          ? "subscriptions.update_subscription"
          : "subscriptions.insert_subscription",
        payload: subscriptionPayload,
      });
      return createSubscriptionErrorResponse({
        error: result.error,
        operation: existingSubscription
          ? "subscriptions.update_subscription"
          : "subscriptions.insert_subscription",
      });
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
        email: verifiedUser.email,
        name: verifiedUser.name,
        normalizedEmail: verifiedUser.normalizedEmail,
        userId: verifiedUser.userId,
        userKey: verifiedUser.userKey,
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

function createSubscriptionErrorResponse({
  error,
  operation,
}: {
  error: SupabaseLikeError;
  operation: string;
}) {
  const supabaseError = {
    code: error.code ?? "",
    details: error.details ?? null,
    hint: error.hint ?? null,
    message: error.message ?? "Supabase request failed.",
  };
  const isDevelopment = process.env.NODE_ENV === "development";

  console.error("DIGEST SUBSCRIPTION SUPABASE ERROR", {
    operation,
    supabaseError,
  });

  return NextResponse.json(
    {
      error: isDevelopment
        ? "Subscription failed"
        : "Digest subscription could not be saved.",
      operation,
      sqlOperation: operation,
      supabaseError: isDevelopment ? supabaseError : undefined,
    },
    { status: 500 },
  );
}

function normalizeDigestType(value: string): DigestType | "" {
  const normalized = value.trim();
  return normalized in DIGESTS ? (normalized as DigestType) : "";
}

function createUnsubscribeToken() {
  return crypto.randomBytes(32).toString("hex");
}
