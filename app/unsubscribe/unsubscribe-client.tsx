"use client";

import { useEffect, useState } from "react";

type UnsubscribeClientProps = {
  token: string;
};

export function UnsubscribeClient({ token }: UnsubscribeClientProps) {
  const [digestType, setDigestType] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setError("This unsubscribe link is missing a token.");
      setIsLoading(false);
      return;
    }

    const params = new URLSearchParams({ token });
    fetch(`/api/unsubscribe?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { digestType?: string; email?: string; error?: string }
          | null;
        if (!response.ok || !payload) {
          throw new Error(payload?.error ?? "Unsubscribe link could not be loaded.");
        }
        setDigestType(payload.digestType ?? "");
        setEmail(payload.email ?? "");
      })
      .catch((lookupError) => {
        setError(
          lookupError instanceof Error
            ? lookupError.message
            : "Unsubscribe link could not be loaded.",
        );
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  async function unsubscribe(scope: "all" | "digest") {
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/unsubscribe", {
        body: JSON.stringify({ scope, token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Unsubscribe request could not be completed.");
      }

      setMessage(payload.message ?? "Your email preferences were updated.");
    } catch (unsubscribeError) {
      setError(
        unsubscribeError instanceof Error
          ? unsubscribeError.message
          : "Unsubscribe request could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="mt-6 text-sm font-semibold text-[#0A66C2]">Loading preferences...</p>;
  }

  return (
    <div className="mt-6">
      {email && (
        <p className="text-sm leading-6 text-[#666666]">
          Email: <span className="font-semibold text-[#191919]">{email}</span>
          {digestType ? ` / Digest: ${formatDigest(digestType)}` : ""}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] px-4 py-3 text-sm font-semibold text-[#B24020]">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-lg border border-[#057642]/20 bg-[#F1F8F4] px-4 py-3 text-sm font-semibold text-[#057642]">
          {message}
        </p>
      )}

      {!message && !error && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
            disabled={isSubmitting}
            onClick={() => void unsubscribe("digest")}
            type="button"
          >
            {isSubmitting ? "Updating..." : "Unsubscribe from this digest"}
          </button>
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#191919] transition hover:border-[#0A66C2] hover:text-[#0A66C2] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => void unsubscribe("all")}
            type="button"
          >
            Stop all emails
          </button>
        </div>
      )}
    </div>
  );
}

function formatDigest(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
