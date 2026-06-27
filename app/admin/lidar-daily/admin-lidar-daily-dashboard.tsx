"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import type { MarketArticle } from "@/lib/market-articles";

type AdminLidarDailyResponse = {
  latestArticle: MarketArticle | null;
  subscriberCount: number;
};

const ADMIN_EMAIL_STORAGE_KEY = "inconnect:admin-lidar-daily-email";

export function AdminLidarDailyDashboard() {
  const [adminEmail, setAdminEmail] = useState("");
  const [data, setData] = useState<AdminLidarDailyResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

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
      const response = await fetch(`/api/admin/lidar-daily?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | AdminLidarDailyResponse
        | { details?: string; error?: string }
        | null;
      if (!response.ok || !payload || !("latestArticle" in payload)) {
        throw new Error(getErrorMessage(payload, "LiDAR Daily dashboard could not be loaded."));
      }
      setData(payload);
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Dashboard could not be loaded.");
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
    const articleId = data?.latestArticle?.id;
    if (["delete", "publish", "send_subscribers", "send_test", "unpublish"].includes(action) && !articleId) {
      setError("No LiDAR Daily article is available for this action.");
      return;
    }
    if (action === "delete" && !window.confirm("Delete this LiDAR Daily article?")) return;

    setError("");
    setMessage("");
    setIsWorking(true);
    try {
      const response = await fetch("/api/admin/lidar-daily", {
        body: JSON.stringify({
          action,
          articleId,
          email: adminEmail.trim(),
          sourceUrl: sourceUrl.trim() || undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { details?: string; error?: string; failed?: number; sent?: number; title?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.details || payload?.error || "LiDAR Daily action failed.");
      }
      setMessage(getActionMessage(action, payload));
      await loadDashboard(adminEmail);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "LiDAR Daily action failed.");
    } finally {
      setIsWorking(false);
    }
  }

  const article = data?.latestArticle ?? null;

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[#191919]">LiDAR Daily</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#666666]">
          Generate, preview, publish, and send original INConnect LiDAR industry articles.
        </p>

        <form className="mt-8 flex flex-col gap-3 rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:flex-row" onSubmit={handleLogin}>
          <input className="h-11 flex-1 rounded-lg border border-[#D9DDE3] px-3 text-sm outline-none focus:border-[#0A66C2]" onChange={(event) => setAdminEmail(event.target.value)} placeholder="Admin email" type="email" value={adminEmail} />
          <button className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white disabled:bg-[#D9DDE3]" disabled={isLoading} type="submit">
            {isLoading ? "Loading..." : "Load LiDAR Daily"}
          </button>
        </form>

        {error && <p className="mt-5 rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] px-4 py-3 text-sm font-semibold text-[#B24020]">{error}</p>}
        {message && <p className="mt-5 rounded-lg border border-[#057642]/20 bg-[#F1F8F4] px-4 py-3 text-sm font-semibold text-[#057642]">{message}</p>}

        {data && (
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_340px]">
            <article className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
              {!article ? (
                <p className="text-sm text-[#666666]">No LiDAR Daily article found yet.</p>
              ) : (
                <>
                  <div className="aspect-video overflow-hidden rounded-lg border border-[#D9DDE3] bg-[#E8F1FB]">
                    <img alt="" className="h-full w-full object-cover" src={article.sourceImageUrl} />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[#057642]">
                    <span>{article.category || "LiDAR"}</span>
                    <span>&middot;</span>
                    <span>{formatDate(article.publishedAt || article.createdAt)}</span>
                    <span>&middot;</span>
                    <span>{article.published ? "Published" : "Draft"}</span>
                    <span>&middot;</span>
                    <span>{article.status}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-[#191919]">{article.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-[#666666]">{article.excerpt}</p>
                  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <Info label="Source" value={article.sourceName || "Not available"} />
                    <Info label="Source domain" value={article.sourceDomain || "Not available"} />
                    <Info label="Quality score" value={typeof article.qualityScore === "number" ? `${article.qualityScore}/100` : "Not scored"} />
                    <Info label="Article type" value={article.articleType} />
                  </dl>
                  <section className="mt-6 border-t border-[#EEF0F3] pt-6">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">INConnect Perspective</h3>
                    <p className="mt-3 text-base leading-7 text-[#444444]">{article.inconnectPerspective}</p>
                  </section>
                  <section className="mt-6">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">Preview</h3>
                    <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-[#444444]">{article.body.slice(0, 1400)}</p>
                  </section>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {article.published && (
                      <Link className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#191919] hover:border-[#0A66C2]" href={`/intelligence/lidar-daily/${article.slug}`}>
                        View on INConnect
                      </Link>
                    )}
                    {article.sourceUrl && (
                      <a className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#191919] hover:border-[#0A66C2]" href={article.sourceUrl} rel="noopener noreferrer" target="_blank">
                        Open Source
                      </a>
                    )}
                  </div>
                </>
              )}
            </article>

            <aside className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
              <p className="text-sm font-semibold text-[#191919]">Subscribers</p>
              <p className="mt-2 text-4xl font-semibold text-[#0A66C2]">{data.subscriberCount}</p>
              <p className="mt-2 text-sm text-[#666666]">active LiDAR Daily subscribers</p>
              <label className="mt-6 grid gap-2 text-sm font-semibold text-[#191919]">
                Optional source URL
                <input className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none focus:border-[#0A66C2]" onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." value={sourceUrl} />
              </label>
              <div className="mt-6 grid gap-3">
                <Action disabled={isWorking} label="Generate Article" onClick={() => runAction("generate")} />
                <Action disabled={isWorking || !article} label="Publish" onClick={() => runAction("publish")} />
                <Action disabled={isWorking || !article} label="Unpublish" onClick={() => runAction("unpublish")} secondary />
                <Action disabled={isWorking || !article} label="Send Test Email" onClick={() => runAction("send_test")} />
                <Action disabled={isWorking || !article} label="Send to Subscribers" onClick={() => runAction("send_subscribers")} />
                <Action danger disabled={isWorking || !article} label="Delete Article" onClick={() => runAction("delete")} />
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F8FAFC] p-3">
      <dt className="font-semibold text-[#191919]">{label}</dt>
      <dd className="mt-1 text-[#666666]">{value}</dd>
    </div>
  );
}

function Action({ danger, disabled, label, onClick, secondary }: { danger?: boolean; disabled?: boolean; label: string; onClick: () => void; secondary?: boolean }) {
  const className = danger
    ? "border border-[#B24020]/25 bg-white text-[#B24020] hover:bg-[#FFF4F1]"
    : secondary
      ? "border border-[#D9DDE3] bg-white text-[#191919] hover:border-[#0A66C2] hover:text-[#0A66C2]"
      : "bg-[#4A6FD0] text-white hover:bg-[#3859B8]";
  return <button className={`inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#D9DDE3] disabled:text-[#666666] ${className}`} disabled={disabled} onClick={onClick} type="button">{label}</button>;
}

function getErrorMessage(
  payload: AdminLidarDailyResponse | { details?: string; error?: string } | null,
  fallback: string,
) {
  if (payload && "error" in payload && payload.error) return payload.error;
  if (payload && "details" in payload && payload.details) return payload.details;
  return fallback;
}

function getActionMessage(action: string, payload: { failed?: number; sent?: number; title?: string } | null) {
  if (action === "generate") return `Generated article: ${payload?.title ?? "LiDAR Daily"}`;
  if (action === "publish") return "Article published.";
  if (action === "unpublish") return "Article unpublished.";
  if (action === "send_test") return "Test email sent.";
  if (action === "send_subscribers") return `Sent ${payload?.sent ?? 0} emails. Failed: ${payload?.failed ?? 0}.`;
  if (action === "delete") return "Article deleted.";
  return "Action completed.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
