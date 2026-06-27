"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export type SupabaseBrowserConfigStatus = {
  anonKeyDetected: boolean;
  browserClientCanInitialize: boolean;
  missingVariables: string[];
  supabaseUrl: string;
  supabaseUrlDetected: boolean;
  supabaseUrlValid: boolean;
};

export function getSupabaseBrowserConfigStatus(): SupabaseBrowserConfigStatus {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const supabaseUrlValid = isValidHttpUrl(supabaseUrl);
  const missingVariables: string[] = [];

  if (!supabaseUrl) missingVariables.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) missingVariables.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (supabaseUrl && !supabaseUrlValid) {
    missingVariables.push("NEXT_PUBLIC_SUPABASE_URL must be a valid https:// URL");
  }

  return {
    anonKeyDetected: Boolean(supabaseAnonKey),
    browserClientCanInitialize: missingVariables.length === 0,
    missingVariables,
    supabaseUrl,
    supabaseUrlDetected: Boolean(supabaseUrl),
    supabaseUrlValid,
  };
}

export function getSupabaseBrowserConfigErrorMessage() {
  const status = getSupabaseBrowserConfigStatus();
  if (status.browserClientCanInitialize) return "";

  return `Missing Supabase browser authentication configuration: ${status.missingVariables.join(
    ", ",
  )}. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the browser environment.`;
}

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const status = getSupabaseBrowserConfigStatus();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!status.browserClientCanInitialize) {
    throw new Error(getSupabaseBrowserConfigErrorMessage());
  }

  browserClient = createClient(status.supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return browserClient;
}

function isValidHttpUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
