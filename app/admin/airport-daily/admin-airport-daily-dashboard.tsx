"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

type AirportBriefingAdminRow = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  excerpt: string;
  hero_image_url: string | null;
  source_name: string | null;
  source_url: string | null;
  source_domain: string | null;
  source_image_url: string | null;
  image_attribution: string | null;
  summary: string | null;
  inconnect_view: string | null;
  sent_at: string | null;
  published_at: string | null;
  generated_at: string | null;
  created_at: string;
};

type AdminAirportDailyResponse = {
  latestBriefing: AirportBriefingAdminRow | null;
  subscriberCount: number;
};

const ADMIN_EMAIL_STORAGE_KEY = "inconnect:admin-airport-daily-email";

export function AdminAirportDailyDashboard() {
  const [adminEmail, setAdminEmail] = useState("");
  const [data, setData] = useState<AdminAirportDailyResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY);
    if (storedEmail) setAdminEmail(storedEmail);
  }, []);

  async function loadDashboard(nextEmail = adminEmail) {
    if (!nextEmail.trim()) {
      setError("Admin email is required.");
      return;
    }

    setError("");
    setMessage("");
    setIsLoading(true);
    window.localStorage.setItem(ADMIN_EMAIL_STORAGE_KEY, nextEmail.trim());

    try {
      const params = new URLSearchParams({ email: nextEmail.trim() });
      const response = await fetch(`/api/admin/airport-daily?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | AdminAirportDailyResponse
        | { error?: string; details?: string }
        | null;

      if (!response.ok || !payload || !("latestBriefing" in payload)) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.error
            : "Airport Daily dashboard could not be loaded.",
        );
      }

      setData(payload);
    } catch (loadError) {
      setData(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Airport Daily dashboard could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadDashboard();
  }

  async function runAction(action: string) {
    if (!adminEmail.trim()) {
      setError("Admin email is required.");
      return;
    }

    const briefingId = data?.latestBriefing?.id;
    if (["send_test", "send_subscribers", "mark_sent", "delete"].includes(action) && !briefingId) {
      setError("No briefing is available for this action.");
      return;
    }

    if (action === "delete" && !window.confirm("Delete this Airport Daily digest?")) {
      return;
    }

    setError("");
    setMessage("");
    setIsWorking(true);

    try {
      const response = await fetch("/api/admin/airport-daily", {
        body: JSON.stringify({
          action,
          briefingId,
          email: adminEmail.trim(),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; details?: string; sent?: number; failed?: number; title?: string; slug?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.details || payload?.error || "Admin action failed.");
      }

      if (action === "generate") {
        setMessage(`Generated digest: ${payload?.title ?? "Airport Daily"}`);
      } else if (action === "send_subscribers") {
        setMessage(`Sent ${payload?.sent ?? 0} emails. Failed: ${payload?.failed ?? 0}.`);
      } else if (action === "send_test") {
        setMessage(`Test email sent to ${adminEmail.trim()}.`);
      } else if (action === "mark_sent") {
        setMessage("Digest marked as sent.");
      } else if (action === "delete") {
        setMessage("Digest deleted.");
      }

      await loadDashboard(adminEmail);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Admin action failed.");
    } finally {
      setIsWorking(false);
    }
  }

  const briefing = data?.latestBriefing ?? null;

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-[#191919]">
          Airport Automation Daily
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#666666]">
          Review the source-based Airport Daily digest, test delivery, and send to active
          subscribers when ready.
        </p>

        <form
          className="mt-8 flex flex-col gap-3 rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:flex-row"
          onSubmit={handleLogin}
        >
          <input
            className="h-11 flex-1 rounded-lg border border-[#D9DDE3] px-3 text-sm outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
            onChange={(event) => setAdminEmail(event.target.value)}
            placeholder="Admin email"
            type="email"
            value={adminEmail}
          />
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "Loading..." : "Load Airport Daily"}
          </button>
        </form>

        {error && (
          <p className="mt-5 rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] px-4 py-3 text-sm font-semibold text-[#B24020]">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-5 rounded-lg border border-[#057642]/20 bg-[#F1F8F4] px-4 py-3 text-sm font-semibold text-[#057642]">
            {message}
          </p>
        )}

        {data && (
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_340px]">
            <article className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
              {!briefing ? (
                <p className="text-sm text-[#666666]">
                  No published Airport Daily digest found yet.
                </p>
              ) : (
                <>
                  <div className="aspect-video overflow-hidden rounded-lg border border-[#D9DDE3] bg-[#E8F1FB]">
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={briefing.hero_image_url || "/hero-professionals-collage.png"}
                    />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[#057642]">
                    <span>{briefing.category || "Airport Automation"}</span>
                    <span>&middot;</span>
                    <span>{formatDate(briefing.published_at || briefing.generated_at || briefing.created_at)}</span>
                    <span>&middot;</span>
                    <span>{briefing.sent_at ? "Sent" : "Not sent"}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-[#191919]">
                    {briefing.title}
                  </h2>
                  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-lg bg-[#F8FAFC] p-3">
                      <dt className="font-semibold text-[#191919]">Source</dt>
                      <dd className="mt-1 text-[#666666]">
                        {briefing.source_name || "Not available"}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] p-3">
                      <dt className="font-semibold text-[#191919]">Source domain</dt>
                      <dd className="mt-1 text-[#666666]">
                        {briefing.source_domain || "Not available"}
                      </dd>
                    </div>
                  </dl>
                  {briefing.source_url && (
                    <a
                      className="mt-4 inline-flex text-sm font-semibold text-[#0A66C2] hover:text-[#004182]"
                      href={briefing.source_url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Open source story
                    </a>
                  )}
                  <section className="mt-6 border-t border-[#EEF0F3] pt-6">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
                      Summary
                    </h3>
                    <p className="mt-3 text-base leading-7 text-[#444444]">
                      {briefing.summary || briefing.excerpt}
                    </p>
                  </section>
                  <section className="mt-6">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
                      INConnect View
                    </h3>
                    <p className="mt-3 text-base leading-7 text-[#444444]">
                      {briefing.inconnect_view || "Not available"}
                    </p>
                  </section>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#191919] transition hover:border-[#0A66C2] hover:text-[#0A66C2]"
                      href={`/intelligence/airport-automation/${briefing.slug}`}
                    >
                      View on INConnect
                    </Link>
                  </div>
                </>
              )}
            </article>

            <aside className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
              <p className="text-sm font-semibold text-[#191919]">Subscribers</p>
              <p className="mt-2 text-4xl font-semibold text-[#0A66C2]">
                {data.subscriberCount}
              </p>
              <p className="mt-2 text-sm text-[#666666]">
                active Airport Automation Daily subscribers
              </p>

              <div className="mt-6 grid gap-3">
                <AdminActionButton
                  disabled={isWorking}
                  label="Generate New Digest"
                  onClick={() => runAction("generate")}
                />
                <AdminActionButton
                  disabled={isWorking || !briefing}
                  label="Send Test Email"
                  onClick={() => runAction("send_test")}
                />
                <AdminActionButton
                  disabled={isWorking || !briefing}
                  label="Send to Subscribers"
                  onClick={() => runAction("send_subscribers")}
                />
                <AdminActionButton
                  disabled={isWorking || !briefing}
                  label="Mark as Sent"
                  onClick={() => runAction("mark_sent")}
                  secondary
                />
                <AdminActionButton
                  danger
                  disabled={isWorking || !briefing}
                  label="Delete Digest"
                  onClick={() => runAction("delete")}
                />
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function AdminActionButton({
  danger,
  disabled,
  label,
  onClick,
  secondary,
}: {
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  secondary?: boolean;
}) {
  const className = danger
    ? "border border-[#B24020]/25 bg-white text-[#B24020] hover:bg-[#FFF4F1]"
    : secondary
      ? "border border-[#D9DDE3] bg-white text-[#191919] hover:border-[#0A66C2] hover:text-[#0A66C2]"
      : "bg-[#4A6FD0] text-white hover:bg-[#3859B8]";

  return (
    <button
      className={`inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#D9DDE3] disabled:text-[#666666] ${className}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
