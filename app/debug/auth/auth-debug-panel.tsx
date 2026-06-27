"use client";

import { useEffect, useMemo, useState } from "react";
import { getEmailOtpFallbackRedirectUrl } from "@/lib/auth-client";
import {
  getSupabaseBrowserClient,
  getSupabaseBrowserConfigErrorMessage,
  getSupabaseBrowserConfigStatus,
} from "@/lib/supabase-browser";

type AuthDiagnosticState = {
  browserClientError: string;
  browserClientInitialized: boolean;
  sessionError: string;
  sessionStatus: string;
  userEmail: string;
  userError: string;
  userId: string;
};

const INITIAL_STATE: AuthDiagnosticState = {
  browserClientError: "",
  browserClientInitialized: false,
  sessionError: "",
  sessionStatus: "Not checked",
  userEmail: "",
  userError: "",
  userId: "",
};

export function AuthDebugPanel() {
  const [diagnostics, setDiagnostics] = useState<AuthDiagnosticState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const config = useMemo(() => getSupabaseBrowserConfigStatus(), []);
  const configError = useMemo(() => getSupabaseBrowserConfigErrorMessage(), []);
  const fallbackRedirectUrl = useMemo(() => getEmailOtpFallbackRedirectUrl(), []);

  useEffect(() => {
    let isMounted = true;

    async function runDiagnostics() {
      setIsLoading(true);
      const nextDiagnostics: AuthDiagnosticState = { ...INITIAL_STATE };

      try {
        const supabase = getSupabaseBrowserClient();
        nextDiagnostics.browserClientInitialized = true;

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          nextDiagnostics.sessionError = sessionError.message;
          nextDiagnostics.sessionStatus = "Session lookup failed";
        } else if (sessionData.session) {
          nextDiagnostics.sessionStatus = `Session active. Expires at ${formatDateTime(
            sessionData.session.expires_at,
          )}.`;
        } else {
          nextDiagnostics.sessionStatus = "No active browser auth session.";
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          nextDiagnostics.userError = userError.message;
        } else if (userData.user) {
          nextDiagnostics.userId = userData.user.id;
          nextDiagnostics.userEmail = userData.user.email ?? "";
        }
      } catch (error) {
        nextDiagnostics.browserClientError =
          error instanceof Error ? error.message : "Browser client could not be initialized.";
      }

      if (isMounted) {
        setDiagnostics(nextDiagnostics);
        setIsLoading(false);
      }
    }

    void runDiagnostics();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Debug
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-[#191919]">
          Supabase Auth Diagnostics
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#666666]">
          Browser-side checks for INConnect Email OTP authentication.
        </p>

        <div className="mt-8 grid gap-4">
          <DiagnosticRow
            detail={config.supabaseUrlDetected ? redactSupabaseUrl(config.supabaseUrl) : "Missing"}
            label="Supabase URL detected"
            ok={config.supabaseUrlDetected && config.supabaseUrlValid}
          />
          <DiagnosticRow
            detail={config.anonKeyDetected ? "Detected; value hidden" : "Missing"}
            label="Anon key detected"
            ok={config.anonKeyDetected}
          />
          <DiagnosticRow
            detail={
              diagnostics.browserClientInitialized
                ? "Initialized"
                : diagnostics.browserClientError || configError || "Not initialized"
            }
            label="Browser client initialized"
            ok={diagnostics.browserClientInitialized}
          />
          <DiagnosticRow
            detail={diagnostics.sessionError || diagnostics.sessionStatus}
            label="Current auth session"
            ok={!diagnostics.sessionError && diagnostics.sessionStatus.includes("Session active")}
          />
          <DiagnosticRow
            detail={
              diagnostics.userError ||
              (diagnostics.userId
                ? `${diagnostics.userEmail || "No email"} (${diagnostics.userId})`
                : "No authenticated user")
            }
            label="Current authenticated user"
            ok={Boolean(diagnostics.userId) && !diagnostics.userError}
          />
          <DiagnosticRow
            detail={fallbackRedirectUrl}
            label="Fallback email link redirect URL"
            ok={fallbackRedirectUrl.endsWith("/auth/callback")}
          />
        </div>

        {config.missingVariables.length > 0 && (
          <div className="mt-6 rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] p-4 text-sm leading-6 text-[#B24020]">
            <p className="font-semibold">Missing configuration</p>
            <p className="mt-1">{configError}</p>
          </div>
        )}

        <div className="mt-6 rounded-lg border border-[#D9DDE3] bg-white p-5 text-sm leading-6 text-[#666666] shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
          <p className="font-semibold text-[#191919]">Email OTP flow checked</p>
          <p className="mt-2">
            The sign-in modal sends a code with Supabase `signInWithOtp`, verifies the 6-digit code
            with `verifyOtp`, then syncs the verified browser session through `/api/auth/sync`.
          </p>
          <p className="mt-2">
            Supabase Email OTP template assumption: include the six-digit token in the email using
            `{"{{ .Token }}"}`. If the email also includes a fallback verification link, allow and
            use `{fallbackRedirectUrl}` as the redirect URL.
          </p>
          <p className="mt-2">
            {isLoading
              ? "Checking browser auth state..."
              : "Diagnostics finished. No private tokens are displayed on this page."}
          </p>
        </div>
      </div>
    </section>
  );
}

function DiagnosticRow({
  detail,
  label,
  ok,
}: {
  detail: string;
  label: string;
  ok: boolean;
}) {
  return (
    <article className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#191919]">{label}</p>
          <p className="mt-1 break-words text-sm text-[#666666]">{detail}</p>
        </div>
        <span
          className={
            ok
              ? "inline-flex w-fit rounded-full bg-[#F1F8F4] px-3 py-1 text-xs font-semibold text-[#057642]"
              : "inline-flex w-fit rounded-full bg-[#FFF4F1] px-3 py-1 text-xs font-semibold text-[#B24020]"
          }
        >
          {ok ? "OK" : "Needs attention"}
        </span>
      </div>
    </article>
  );
}

function redactSupabaseUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.origin}`;
  } catch {
    return value;
  }
}

function formatDateTime(expiresAt?: number) {
  if (!expiresAt) return "unknown";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(expiresAt * 1000));
}
