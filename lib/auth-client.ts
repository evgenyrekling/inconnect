"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type StoredVerifiedIdentity = {
  email: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  linkedinUrl?: string;
  name?: string;
  normalizedEmail?: string;
  signedInAt?: string;
  supabaseAuthUserId?: string;
  userId?: string;
  userKey: string;
};

const LEGACY_RETURNING_USER_STORAGE_KEY = "inconnect:returning-user";
const LEGACY_UNIFIED_IDENTITY_STORAGE_KEY = "inconnect:user-identity";
const UNIFIED_IDENTITY_STORAGE_KEY = "inconnect_identity";
const AUTH_CALLBACK_PATH = "/auth/callback";

export function readStoredVerifiedIdentity(): StoredVerifiedIdentity | null {
  if (typeof window === "undefined") return null;

  try {
    const raw =
      window.localStorage.getItem(UNIFIED_IDENTITY_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_UNIFIED_IDENTITY_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_RETURNING_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isStoredVerifiedIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function storeVerifiedIdentity(identity: StoredVerifiedIdentity) {
  if (typeof window === "undefined") return;

  const normalizedIdentity: StoredVerifiedIdentity = {
    ...identity,
    emailVerified: identity.emailVerified ?? true,
    linkedinUrl: identity.linkedinUrl ?? "",
    normalizedEmail: identity.normalizedEmail ?? identity.email.trim().toLowerCase(),
    signedInAt: identity.signedInAt ?? new Date().toISOString(),
  };

  try {
    const serialized = JSON.stringify(normalizedIdentity);
    window.localStorage.setItem(UNIFIED_IDENTITY_STORAGE_KEY, serialized);
    window.localStorage.setItem(LEGACY_UNIFIED_IDENTITY_STORAGE_KEY, serialized);
    window.localStorage.setItem(LEGACY_RETURNING_USER_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event("inconnect:identity-changed"));
  } catch {
    // localStorage can be unavailable in private browsing or embedded contexts.
  }
}

export async function getVerifiedAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? "";
}

export async function sendEmailOtp(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: getEmailOtpFallbackRedirectUrl(),
      shouldCreateUser: true,
    },
  });

  if (error) throw error;
}

export async function verifyEmailOtp({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: "email",
  });

  if (error) throw error;
  if (!data.session?.access_token) {
    throw new Error(
      "Email OTP was verified, but Supabase did not create a browser session.",
    );
  }

  return data;
}

export async function syncVerifiedSupabaseSession() {
  const accessToken = await getVerifiedAccessToken();
  if (!accessToken) {
    throw new Error("No verified Supabase browser session was found.");
  }

  const response = await fetch("/api/auth/sync", {
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        user?: {
          email?: string;
          emailVerified?: boolean;
          linkedinUrl?: string;
          name?: string;
          normalizedEmail?: string;
          supabaseAuthUserId?: string;
          userId?: string;
          userKey?: string;
        };
        error?: string;
      }
    | null;

  if (!response.ok || !payload?.user?.email || !payload.user.userKey) {
    throw new Error(payload?.error ?? "Verified session could not be synced.");
  }

  const identity: StoredVerifiedIdentity = {
    email: payload.user.email,
    emailVerified: true,
    linkedinUrl: payload.user.linkedinUrl ?? "",
    name: payload.user.name ?? "",
    normalizedEmail: payload.user.normalizedEmail,
    signedInAt: new Date().toISOString(),
    supabaseAuthUserId: payload.user.supabaseAuthUserId,
    userId: payload.user.userId,
    userKey: payload.user.userKey,
  };
  storeVerifiedIdentity(identity);
  return identity;
}

export function getEmailOtpFallbackRedirectUrl() {
  return `${getPublicSiteOrigin()}${AUTH_CALLBACK_PATH}`;
}

function getPublicSiteOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://in-connect.app";
  return configuredOrigin.replace(/\/+$/, "");
}

export async function getVerifiedAuthHeaders(): Promise<Record<string, string>> {
  const token = await getVerifiedAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function signOutVerifiedUser() {
  try {
    await getSupabaseBrowserClient().auth.signOut();
  } catch {
    // Sign-out should still clear INConnect's local state if Supabase is unavailable.
  }

  clearStoredIdentity();
}

export function clearStoredIdentity() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(UNIFIED_IDENTITY_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_UNIFIED_IDENTITY_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_RETURNING_USER_STORAGE_KEY);
  } catch {
    // localStorage can be unavailable in private browsing or embedded contexts.
  }

  try {
    window.sessionStorage.clear();
  } catch {
    // sessionStorage can be unavailable in private browsing or embedded contexts.
  }

  window.dispatchEvent(new Event("inconnect:identity-changed"));
}

export function isStoredVerifiedIdentity(value: unknown): value is StoredVerifiedIdentity {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.email === "string" && typeof record.userKey === "string";
}
