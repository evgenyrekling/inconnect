"use client";

import { type FormEvent, useEffect, useState } from "react";

type DigestCount = {
  activeCount: number;
  clickRate: number;
  digestType: string;
  emailsSent: number;
  inactiveCount: number;
  label: string;
  openRate: number;
  totalCount: number;
  unsubscribeRate: number;
};

type SubscriptionRow = {
  id: string;
  user_id: string | null;
  email: string;
  digest_type: string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string | null;
};

type AdminSubscriptionsResponse = {
  digestCounts: DigestCount[];
  recentSubscriptions: SubscriptionRow[];
};

const ADMIN_EMAIL_STORAGE_KEY = "inconnect:admin-subscriptions-email";

export function AdminSubscriptionsDashboard() {
  const [adminEmail, setAdminEmail] = useState("");
  const [digestCounts, setDigestCounts] = useState<DigestCount[]>([]);
  const [error, setError] = useState("");
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSubscriptions, setRecentSubscriptions] = useState<SubscriptionRow[]>([]);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY);
    if (storedEmail) setAdminEmail(storedEmail);
  }, []);

  async function loadSubscriptions(nextEmail = adminEmail) {
    if (!nextEmail.trim()) {
      setError("Admin email is required.");
      return;
    }

    setError("");
    setIsLoading(true);
    window.localStorage.setItem(ADMIN_EMAIL_STORAGE_KEY, nextEmail.trim());

    try {
      const params = new URLSearchParams({ email: nextEmail.trim() });
      const response = await fetch(`/api/admin/subscriptions?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | AdminSubscriptionsResponse
        | { error?: string; details?: string }
        | null;

      if (!response.ok || !payload || !("digestCounts" in payload)) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.error
            : "Subscriptions could not be loaded.",
        );
      }

      setDigestCounts(payload.digestCounts);
      setRecentSubscriptions(payload.recentSubscriptions);
      setHasAdminAccess(true);
    } catch (loadError) {
      setHasAdminAccess(false);
      setError(
        loadError instanceof Error ? loadError.message : "Subscriptions could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadSubscriptions();
  }

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-[#191919]">
          Digest Subscriptions
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#666666]">
          Monitor subscriber growth for INConnect Intelligence email products.
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
            {isLoading ? "Loading..." : "Load Subscriptions"}
          </button>
        </form>

        {error && (
          <p className="mt-5 rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] px-4 py-3 text-sm font-semibold text-[#B24020]">
            {error}
          </p>
        )}

        {hasAdminAccess && (
          <>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {digestCounts.map((digest) => (
                <article
                  className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]"
                  key={digest.digestType}
                >
                  <p className="text-sm font-semibold text-[#191919]">{digest.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-[#0A66C2]">
                    {digest.activeCount}
                  </p>
                  <p className="mt-2 text-sm text-[#666666]">
                    active subscribers
                  </p>
                  <p className="mt-4 text-xs font-semibold text-[#666666]">
                    Total: {digest.totalCount} / Unsubscribe rate:{" "}
                    {digest.unsubscribeRate}%
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#EEF0F3] pt-4 text-xs text-[#666666]">
                    <div>
                      <p className="font-semibold text-[#191919]">{digest.emailsSent}</p>
                      <p>sent</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[#191919]">{digest.openRate}%</p>
                      <p>open</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[#191919]">{digest.clickRate}%</p>
                      <p>click</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <section className="mt-10 rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
              <h2 className="text-2xl font-semibold text-[#191919]">
                Recent Subscriptions
              </h2>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#D9DDE3] text-xs uppercase tracking-[0.16em] text-[#666666]">
                      <th className="py-3 pr-4">Email</th>
                      <th className="py-3 pr-4">Digest</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSubscriptions.map((subscription) => (
                      <tr className="border-b border-[#EEF0F3]" key={subscription.id}>
                        <td className="py-3 pr-4 font-semibold text-[#191919]">
                          {subscription.email}
                        </td>
                        <td className="py-3 pr-4 text-[#666666]">
                          {formatDigest(subscription.digest_type)}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={
                              subscription.is_active
                                ? "rounded-full bg-[#F1F8F4] px-3 py-1 text-xs font-semibold text-[#057642]"
                                : "rounded-full bg-[#F8F8F6] px-3 py-1 text-xs font-semibold text-[#666666]"
                            }
                          >
                            {subscription.is_active ? "Active" : "Unsubscribed"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[#666666]">
                          {formatDate(subscription.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

function formatDigest(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
