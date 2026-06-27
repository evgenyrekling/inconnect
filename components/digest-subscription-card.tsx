"use client";

import { useEffect, useMemo, useState } from "react";
import { EmailOTPLoginModal } from "@/components/email-otp-login-modal";
import {
  getVerifiedAuthHeaders,
  readStoredVerifiedIdentity,
  storeVerifiedIdentity,
} from "@/lib/auth-client";

type DigestType =
  | "airport_automation_daily"
  | "linkedin_daily"
  | "smart_mobility_daily"
  | "industrial_automation_daily";

type DigestSubscriptionCardProps = {
  digestTitle: string;
  digestType: DigestType;
  description?: string;
};

type StoredIdentity = {
  email: string;
  name?: string;
  normalizedEmail?: string;
  signedInAt?: string;
  userId?: string;
  userKey: string;
};

type SubscriptionResponse = {
  digestLabel: string;
  digestType: DigestType;
  email: string;
  isSubscribed: boolean;
  message: string;
  user?: {
    email: string;
    name?: string;
    normalizedEmail: string;
    userId: string;
    userKey: string;
  };
};

type SubscriptionErrorResponse = {
  details?: string;
  error?: string;
  operation?: string;
  sqlOperation?: string;
  supabaseError?: {
    code?: string;
    details?: string | null;
    hint?: string | null;
    message?: string;
  };
};

const RETURNING_USER_STORAGE_KEY = "inconnect:returning-user";
const UNIFIED_IDENTITY_STORAGE_KEY = "inconnect_identity";

export function DigestSubscriptionCard({
  description = "Get the daily briefing by email when new intelligence is published.",
  digestTitle,
  digestType,
}: DigestSubscriptionCardProps) {
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resumeSubscribeAfterSignIn, setResumeSubscribeAfterSignIn] = useState(false);

  const displayName = useMemo(() => getIdentityDisplayName(identity), [identity]);
  const isKnownUser = Boolean(identity?.email);

  useEffect(() => {
    const storedIdentity = readStoredIdentity();
    setIdentity(storedIdentity);
    if (storedIdentity?.email) {
      void loadStatus();
    } else {
      setIsChecking(false);
    }
  }, [digestType]);

  async function loadStatus() {
    setIsChecking(true);
    setError("");

    try {
      const params = new URLSearchParams({ digestType });
      const response = await fetch(`/api/subscriptions?${params.toString()}`, {
        cache: "no-store",
        headers: await getVerifiedAuthHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as
        | { isSubscribed?: boolean; error?: string }
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Subscription status could not be loaded.");
      }

      setIsSubscribed(Boolean(payload.isSubscribed));
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Subscription status could not be loaded.",
      );
    } finally {
      setIsChecking(false);
    }
  }

  async function handleSubscribe() {
    if (isSubmitting) return;
    if (!identity?.email) {
      setResumeSubscribeAfterSignIn(true);
      setIsSignInOpen(true);
      return;
    }
    await saveSubscription("subscribe");
  }

  async function handleUnsubscribe() {
    if (isSubmitting) return;
    await saveSubscription("unsubscribe");
  }

  async function saveSubscription(action: "subscribe" | "unsubscribe") {
    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/subscriptions", {
        body: JSON.stringify({
          action,
          digestType,
        }),
        headers: { "Content-Type": "application/json", ...(await getVerifiedAuthHeaders()) },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | SubscriptionResponse
        | SubscriptionErrorResponse
        | null;

      if (!response.ok) {
        console.error("DIGEST SUBSCRIPTION RESPONSE ERROR", {
          action,
          digestType,
          payload,
          status: response.status,
          statusText: response.statusText,
        });
      }

      if (!response.ok || !payload || !("isSubscribed" in payload)) {
        throw new Error(formatSubscriptionError(payload as SubscriptionErrorResponse | null));
      }

      setIsSubscribed(payload.isSubscribed);
      setMessage(payload.message);

      if (payload.user) {
        const nextIdentity: StoredIdentity = {
          email: payload.user.email,
          name: payload.user.name ?? "",
          normalizedEmail: payload.user.normalizedEmail,
          signedInAt: new Date().toISOString(),
          userId: payload.user.userId,
          userKey: payload.user.userKey,
        };
        setIdentity(nextIdentity);
        storeIdentity(nextIdentity);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Subscription could not be saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-[#0A66C2]/20 bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-6">
      {isSignInOpen && (
        <EmailOTPLoginModal
          onClose={() => {
            setIsSignInOpen(false);
            setResumeSubscribeAfterSignIn(false);
          }}
          onSignedIn={(nextIdentity) => {
            const normalizedIdentity = {
              email: nextIdentity.email,
              name: nextIdentity.name,
              normalizedEmail: nextIdentity.normalizedEmail,
              signedInAt: nextIdentity.signedInAt,
              userId: nextIdentity.userId,
              userKey: nextIdentity.userKey,
            };
            setIdentity(normalizedIdentity);
            setIsSignInOpen(false);
            if (resumeSubscribeAfterSignIn) {
              setResumeSubscribeAfterSignIn(false);
              window.setTimeout(() => void saveSubscription("subscribe"), 0);
            }
          }}
        />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A66C2]">
            Daily email digest
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#191919]">
            Subscribe to {digestTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666666]">
            {description}
          </p>
          {displayName && (
            <p className="mt-3 text-sm font-semibold text-[#057642]">
              Welcome back, {displayName}.
            </p>
          )}
        </div>
        <div className="shrink-0 rounded-full bg-[#F3F7FD] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
          {isChecking ? (
            "Checking..."
          ) : isSubscribed ? (
            <>
              Subscribed &#10003;
            </>
          ) : (
            "Subscribe"
          )}
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-lg border border-[#057642]/20 bg-[#F1F8F4] px-4 py-3 text-sm font-semibold text-[#057642]">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 whitespace-pre-wrap rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] px-4 py-3 text-sm font-semibold text-[#B24020]">
          {error}
        </p>
      )}

      {isKnownUser ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {isSubscribed ? (
            <button
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#191919] transition hover:border-[#0A66C2] hover:text-[#0A66C2] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || isChecking}
              onClick={handleUnsubscribe}
              type="button"
            >
              {isSubmitting ? "Updating..." : "Unsubscribe"}
            </button>
          ) : (
            <button
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
              disabled={isSubmitting || isChecking}
              onClick={() => void handleSubscribe()}
              type="button"
            >
              {isSubmitting ? "Subscribing..." : "Subscribe"}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-5">
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
            disabled={isSubmitting || isChecking}
            onClick={() => void handleSubscribe()}
            type="button"
          >
            Sign in to Subscribe
          </button>
        </div>
      )}
    </section>
  );
}

function readStoredIdentity(): StoredIdentity | null {
  const identity = readStoredVerifiedIdentity();
  return identity && isStoredIdentity(identity) ? identity : null;
}

function storeIdentity(identity: StoredIdentity) {
  try {
    const normalizedIdentity = {
      ...identity,
      normalizedEmail: identity.normalizedEmail ?? identity.email.trim().toLowerCase(),
      signedInAt: identity.signedInAt ?? new Date().toISOString(),
    };
    storeVerifiedIdentity(normalizedIdentity);
  } catch {
    // localStorage can be unavailable in private browsing.
  }
}

function isStoredIdentity(value: unknown): value is StoredIdentity {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.email === "string" && typeof record.userKey === "string";
}

function getIdentityDisplayName(identity: StoredIdentity | null) {
  const name = identity?.name?.trim() ?? "";
  if (name && !/^not clearly/i.test(name)) return name;
  return identity?.email?.split("@")[0] ?? "";
}

function formatSubscriptionError(payload: SubscriptionErrorResponse | null) {
  const fallback = "Digest subscription could not be saved.";
  if (process.env.NODE_ENV !== "development") {
    return payload?.error || fallback;
  }

  const supabaseError = payload?.supabaseError;
  if (!supabaseError) {
    return [payload?.error || fallback, payload?.details].filter(Boolean).join("\n\n");
  }

  return [
    payload?.error || "Subscription failed",
    payload?.sqlOperation ? `Operation:\n${payload.sqlOperation}` : "",
    supabaseError.code ? `Code:\n${supabaseError.code}` : "",
    supabaseError.message ? `Message:\n${supabaseError.message}` : "",
    supabaseError.details ? `Details:\n${supabaseError.details}` : "",
    supabaseError.hint ? `Hint:\n${supabaseError.hint}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
