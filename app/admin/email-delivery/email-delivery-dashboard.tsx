"use client";

import { type FormEvent, useEffect, useState } from "react";

type DeliveryRow = {
  articleSlug: string;
  articleTitle: string;
  briefingId: string | null;
  date: string | null;
  error: string | null;
  id: string;
  provider: string;
  providerMessageId: string | null;
  recipient: string | null;
  status: string;
};

type SubscriberRow = {
  email: string;
  id: string;
};

type EmailDeliveryResponse = {
  deliveries: DeliveryRow[];
  subscribers: SubscriberRow[];
};

const ADMIN_EMAIL_STORAGE_KEY = "inconnect:admin-email-delivery-email";

export function AdminEmailDeliveryDashboard() {
  const [adminEmail, setAdminEmail] = useState("");
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [error, setError] = useState("");
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedSubscriber, setSelectedSubscriber] = useState("");
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY);
    if (storedEmail) setAdminEmail(storedEmail);
  }, []);

  async function loadDeliveryData(nextEmail = adminEmail) {
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
      const response = await fetch(`/api/admin/email-delivery?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | EmailDeliveryResponse
        | { details?: string; error?: string }
        | null;

      if (!response.ok || !payload || !("deliveries" in payload)) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.details || payload.error
            : "Email delivery diagnostics could not be loaded.",
        );
      }

      setDeliveries(payload.deliveries);
      setSubscribers(payload.subscribers);
      setSelectedSubscriber((current) => current || payload.subscribers[0]?.email || "");
      setHasAdminAccess(true);
    } catch (loadError) {
      setHasAdminAccess(false);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Email delivery diagnostics could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadDeliveryData();
  }

  async function handleResendAirportDaily() {
    if (!adminEmail.trim()) {
      setError("Admin email is required.");
      return;
    }
    if (!selectedSubscriber) {
      setError("Select an Airport Daily subscriber first.");
      return;
    }

    setError("");
    setMessage("");
    setIsResending(true);

    try {
      const response = await fetch("/api/admin/email-delivery", {
        body: JSON.stringify({
          email: adminEmail.trim(),
          recipientEmail: selectedSubscriber,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { details?: string; error?: string; resendMessageId?: string; title?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.details || payload?.error || "Airport Daily resend failed.");
      }

      setMessage(
        `Resent Airport Daily to ${selectedSubscriber}. Provider ID: ${
          payload?.resendMessageId || "not returned"
        }.`,
      );
      await loadDeliveryData(adminEmail);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Airport Daily resend failed.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-[#191919]">
          Email Delivery
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#666666]">
          Diagnose Airport Automation Daily email delivery from subscriber lookup through Resend.
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
            {isLoading ? "Loading..." : "Load Delivery Logs"}
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

        {hasAdminAccess && (
          <>
            <section className="mt-8 rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#191919]">
                    Manual Resend
                  </h2>
                  <p className="mt-2 text-sm text-[#666666]">
                    Send the latest Airport Daily briefing to one active subscriber for testing.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                  <select
                    className="h-11 min-w-[260px] rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                    onChange={(event) => setSelectedSubscriber(event.target.value)}
                    value={selectedSubscriber}
                  >
                    {subscribers.length === 0 && (
                      <option value="">No active Airport Daily subscribers</option>
                    )}
                    {subscribers.map((subscriber) => (
                      <option key={subscriber.id} value={subscriber.email}>
                        {subscriber.email}
                      </option>
                    ))}
                  </select>
                  <button
                    className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
                    disabled={isResending || subscribers.length === 0}
                    onClick={handleResendAirportDaily}
                    type="button"
                  >
                    {isResending ? "Sending..." : "Resend Airport Daily"}
                  </button>
                </div>
              </div>
            </section>

            <section className="mt-10 rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
              <h2 className="text-2xl font-semibold text-[#191919]">
                Recent Airport Daily Delivery Logs
              </h2>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#D9DDE3] text-xs uppercase tracking-[0.16em] text-[#666666]">
                      <th className="py-3 pr-4">Date</th>
                      <th className="py-3 pr-4">Article</th>
                      <th className="py-3 pr-4">Recipient</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Provider ID</th>
                      <th className="py-3 pr-4">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.length === 0 && (
                      <tr>
                        <td className="py-8 text-sm text-[#666666]" colSpan={6}>
                          No Airport Daily delivery logs yet.
                        </td>
                      </tr>
                    )}
                    {deliveries.map((delivery) => (
                      <tr className="border-b border-[#EEF0F3]" key={delivery.id}>
                        <td className="py-3 pr-4 text-[#666666]">
                          {formatDateTime(delivery.date)}
                        </td>
                        <td className="max-w-[280px] py-3 pr-4 font-semibold text-[#191919]">
                          {delivery.articleSlug ? (
                            <a
                              className="text-[#0A66C2] hover:underline"
                              href={`/intelligence/airport-automation/${delivery.articleSlug}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {delivery.articleTitle || delivery.briefingId}
                            </a>
                          ) : (
                            delivery.articleTitle || delivery.briefingId || "System event"
                          )}
                        </td>
                        <td className="py-3 pr-4 text-[#666666]">
                          {delivery.recipient || "-"}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={getStatusClassName(delivery.status)}>
                            {delivery.status}
                          </span>
                        </td>
                        <td className="max-w-[220px] truncate py-3 pr-4 text-xs text-[#666666]">
                          {delivery.providerMessageId || "-"}
                        </td>
                        <td className="max-w-[320px] py-3 pr-4 text-[#B24020]">
                          {delivery.error || "-"}
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

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusClassName(status: string) {
  if (status === "sent") {
    return "rounded-full bg-[#F1F8F4] px-3 py-1 text-xs font-semibold text-[#057642]";
  }
  if (status === "failed") {
    return "rounded-full bg-[#FFF4F1] px-3 py-1 text-xs font-semibold text-[#B24020]";
  }
  return "rounded-full bg-[#F8F8F6] px-3 py-1 text-xs font-semibold text-[#666666]";
}
