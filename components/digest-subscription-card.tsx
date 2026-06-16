"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

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

const RETURNING_USER_STORAGE_KEY = "inconnect:returning-user";
const UNIFIED_IDENTITY_STORAGE_KEY = "inconnect_identity";

export function DigestSubscriptionCard({
  description = "Get the daily briefing by email when new intelligence is published.",
  digestTitle,
  digestType,
}: DigestSubscriptionCardProps) {
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const displayName = useMemo(() => getIdentityDisplayName(identity), [identity]);
  const isKnownUser = Boolean(identity?.email);
  const canSubmit = isKnownUser || (name.trim().length >= 2 && isValidEmail(email));

  useEffect(() => {
    const storedIdentity = readStoredIdentity();
    setIdentity(storedIdentity);
    if (storedIdentity?.email) {
      setName(storedIdentity.name ?? "");
      setEmail(storedIdentity.email);
      void loadStatus(storedIdentity.email);
    } else {
      setIsChecking(false);
    }
  }, [digestType]);

  async function loadStatus(statusEmail: string) {
    setIsChecking(true);
    setError("");

    try {
      const params = new URLSearchParams({
        digestType,
        email: statusEmail,
      });
      const response = await fetch(`/api/subscriptions?${params.toString()}`, {
        cache: "no-store",
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

  async function handleSubscribe(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!canSubmit || isSubmitting) return;

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
          email: identity?.email ?? email,
          name: identity?.name ?? name,
          userKey: identity?.userKey,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | SubscriptionResponse
        | { error?: string; details?: string }
        | null;

      if (!response.ok || !payload || !("isSubscribed" in payload)) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.error
            : "Subscription could not be saved.",
        );
      }

      setIsSubscribed(payload.isSubscribed);
      setMessage(payload.message);

      if (payload.user) {
        const nextIdentity: StoredIdentity = {
          email: payload.user.email,
          name: payload.user.name ?? name,
          normalizedEmail: payload.user.normalizedEmail,
          signedInAt: new Date().toISOString(),
          userId: payload.user.userId,
          userKey: payload.user.userKey,
        };
        setIdentity(nextIdentity);
        setName(nextIdentity.name ?? "");
        setEmail(nextIdentity.email);
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
        <p className="mt-4 rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] px-4 py-3 text-sm font-semibold text-[#B24020]">
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
        <form className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleSubscribe}>
          <label className="grid gap-2 text-sm font-semibold text-[#191919]">
            Name
            <input
              className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              value={name}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#191919]">
            Email
            <input
              className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>
          <button
            className="mt-0 inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3] sm:mt-7"
            disabled={!canSubmit || isSubmitting || isChecking}
            type="submit"
          >
            {isSubmitting ? "Subscribing..." : "Subscribe"}
          </button>
        </form>
      )}
    </section>
  );
}

function readStoredIdentity(): StoredIdentity | null {
  try {
    const raw =
      window.localStorage.getItem(UNIFIED_IDENTITY_STORAGE_KEY) ??
      window.localStorage.getItem(RETURNING_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isStoredIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeIdentity(identity: StoredIdentity) {
  try {
    const normalizedIdentity = {
      ...identity,
      normalizedEmail: identity.normalizedEmail ?? identity.email.trim().toLowerCase(),
      signedInAt: identity.signedInAt ?? new Date().toISOString(),
    };
    window.localStorage.setItem(UNIFIED_IDENTITY_STORAGE_KEY, JSON.stringify(normalizedIdentity));
    window.localStorage.setItem(RETURNING_USER_STORAGE_KEY, JSON.stringify(normalizedIdentity));
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
