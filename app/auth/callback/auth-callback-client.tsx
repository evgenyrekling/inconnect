"use client";

import { useEffect, useState } from "react";
import { syncVerifiedSupabaseSession } from "@/lib/auth-client";

export function AuthCallbackClient() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Completing email verification...");

  useEffect(() => {
    let isMounted = true;

    async function completeFallbackLinkSignIn() {
      try {
        const identity = await syncVerifiedSupabaseSession();
        if (!isMounted) return;
        setMessage(`Signed in as ${identity.email}. Redirecting...`);
        window.setTimeout(() => {
          window.location.href = "/";
        }, 800);
      } catch (callbackError) {
        if (!isMounted) return;
        setError(
          callbackError instanceof Error
            ? callbackError.message
            : "Email verification could not be completed.",
        );
        setMessage("");
      }
    }

    void completeFallbackLinkSignIn();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="px-5 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-xl rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
          INConnect Account
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[#191919]">
          Email Verification
        </h1>
        {message && <p className="mt-4 text-sm leading-6 text-[#666666]">{message}</p>}
        {error && (
          <p className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B42318]">
            {error}
          </p>
        )}
        {error && (
          <a
            className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-4 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
            href="/"
          >
            Return Home
          </a>
        )}
      </div>
    </section>
  );
}
