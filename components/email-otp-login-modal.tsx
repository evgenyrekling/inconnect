"use client";

import { type FormEvent, useState } from "react";
import {
  storeVerifiedIdentity,
  type StoredVerifiedIdentity,
} from "@/lib/auth-client";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type EmailOTPLoginModalProps = {
  onClose: () => void;
  onSignedIn: (identity: StoredVerifiedIdentity) => void;
};

export function EmailOTPLoginModal({ onClose, onSignedIn }: EmailOTPLoginModalProps) {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setMessage("");

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
          shouldCreateUser: true,
        },
      });
      if (otpError) throw otpError;
      setStep("code");
      setMessage("Verification code sent.");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Verification code could not be sent.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedCode = code.replace(/\D/g, "");
    if (normalizedCode.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: normalizedCode,
        type: "email",
      });
      if (verifyError) throw verifyError;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Verified session was not created.");

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
      setMessage("You are signed in.");
      onSignedIn(identity);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Verification could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex min-h-screen items-center justify-center overflow-y-auto bg-[#0A192F]/60 p-6 sm:p-8">
      <div className="max-h-[calc(100vh-48px)] w-full max-w-md overflow-y-auto rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_24px_70px_rgba(10,25,47,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
              INConnect Account
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#191919]">
              {step === "email" ? "Sign in to INConnect" : "Check your email"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#666666]">
              {step === "email"
                ? "Enter your email to receive a verification code."
                : `Enter the verification code sent to ${email.trim().toLowerCase()}.`}
            </p>
          </div>
          <button
            className="rounded-lg px-2 py-1 text-sm font-semibold text-[#666666] transition hover:bg-[#E8F1FB] hover:text-[#0A66C2]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {step === "email" ? (
          <form className="mt-6 grid gap-4" onSubmit={sendCode}>
            <label className="grid gap-2 text-sm font-semibold text-[#191919]">
              Email
              <input
                autoComplete="email"
                className="rounded-lg border border-[#D9DDE3] px-3 py-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/20"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>
            <StatusMessages error={error} message={message} />
            <button
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-4 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Sending..." : "Send Code"}
            </button>
          </form>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={verifyCode}>
            <label className="grid gap-2 text-sm font-semibold text-[#191919]">
              6-digit code
              <input
                autoComplete="one-time-code"
                className="rounded-lg border border-[#D9DDE3] px-3 py-3 text-sm font-normal tracking-[0.35em] outline-none transition focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/20"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                value={code}
              />
            </label>
            <StatusMessages error={error} message={message} />
            <button
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-4 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Verifying..." : "Verify and Continue"}
            </button>
            <div className="flex flex-wrap gap-3 text-sm font-semibold">
              <button
                className="text-[#0A66C2] transition hover:underline"
                disabled={isSubmitting}
                onClick={() => void sendCode()}
                type="button"
              >
                Resend code
              </button>
              <button
                className="text-[#666666] transition hover:text-[#0A66C2]"
                disabled={isSubmitting}
                onClick={() => {
                  setCode("");
                  setError("");
                  setMessage("");
                  setStep("email");
                }}
                type="button"
              >
                Use another email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StatusMessages({ error, message }: { error: string; message: string }) {
  return (
    <>
      {message && (
        <p className="rounded-lg border border-[#057642]/20 bg-[#F1F8F4] px-3 py-2 text-sm font-semibold text-[#057642]">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B42318]">
          {error}
        </p>
      )}
    </>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
