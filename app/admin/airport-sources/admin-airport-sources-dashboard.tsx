"use client";

import { type FormEvent, useEffect, useState } from "react";

type AirportDailySource = {
  id: string;
  source_name: string;
  source_url: string;
  source_type: string | null;
  category: string | null;
  priority: string | null;
  is_active: boolean | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_successful_story_title: string | null;
  last_successful_story_url: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SourceCheckResult = {
  candidatesFound: number;
  rejectedStories: Array<{
    reason: string;
    score: number;
    sourceName: string;
    title: string;
    url: string;
    urlType?: string;
  }>;
  selectedStory: {
    category: string;
    score: number;
    sourceName: string;
    title: string;
    url: string;
    urlType?: string;
  } | null;
  sourcesChecked: number;
};

type SourceFormState = {
  category: string;
  is_active: boolean;
  notes: string;
  priority: string;
  source_name: string;
  source_type: string;
  source_url: string;
};

const ADMIN_EMAIL_STORAGE_KEY = "inconnect:admin-airport-sources-email";

const emptyForm: SourceFormState = {
  category: "baggage",
  is_active: true,
  notes: "",
  priority: "medium",
  source_name: "",
  source_type: "supplier",
  source_url: "",
};

const sourceTypeOptions = [
  ["airport", "Airport"],
  ["airline", "Airline"],
  ["supplier", "Supplier"],
  ["industry_media", "Industry media"],
];

const categoryOptions = [
  ["baggage", "Baggage"],
  ["passenger_processing", "Passenger processing"],
  ["GSE", "GSE"],
  ["security", "Security"],
  ["robotics", "Robotics"],
  ["AI", "AI"],
  ["cargo", "Cargo"],
  ["smart_airport", "Smart airport"],
];

const priorityOptions = [
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
];

export function AdminAirportSourcesDashboard() {
  const [adminEmail, setAdminEmail] = useState("");
  const [editingSourceId, setEditingSourceId] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<SourceFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [sources, setSources] = useState<AirportDailySource[]>([]);
  const [testResult, setTestResult] = useState<SourceCheckResult | null>(null);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY);
    if (storedEmail) setAdminEmail(storedEmail);
  }, []);

  async function loadSources(nextEmail = adminEmail) {
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
      const response = await fetch(`/api/admin/airport-sources?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; sources?: AirportDailySource[] }
        | null;

      if (!response.ok || !payload?.sources) {
        throw new Error(payload?.error || "Airport sources could not be loaded.");
      }

      setSources(payload.sources);
    } catch (loadError) {
      setSources([]);
      setError(loadError instanceof Error ? loadError.message : "Airport sources could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadSources();
  }

  async function saveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(editingSourceId ? "update" : "create", {
      airportSource: form,
      sourceId: editingSourceId || undefined,
    });
  }

  async function runAction(
    action: string,
    extraPayload: Record<string, unknown> = {},
  ) {
    if (!adminEmail.trim()) {
      setError("Admin email is required.");
      return;
    }

    setError("");
    setMessage("");
    setIsWorking(true);

    try {
      const response = await fetch("/api/admin/airport-sources", {
        body: JSON.stringify({
          action,
          email: adminEmail.trim(),
          ...extraPayload,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | ({ details?: string; error?: string; success?: boolean } & Partial<SourceCheckResult>)
        | null;

      if (!response.ok) {
        throw new Error(payload?.details || payload?.error || "Airport source action failed.");
      }

      if (action === "check_all" || action === "test") {
        setTestResult({
          candidatesFound: payload?.candidatesFound ?? 0,
          rejectedStories: payload?.rejectedStories ?? [],
          selectedStory: payload?.selectedStory ?? null,
          sourcesChecked: payload?.sourcesChecked ?? 0,
        });
        setMessage(action === "check_all" ? "Source check complete." : "Source test complete.");
      } else {
        setMessage(action === "delete" ? "Source deleted." : "Source saved.");
        setTestResult(null);
      }

      if (action === "create" || action === "update") {
        setEditingSourceId("");
        setForm(emptyForm);
      }

      await loadSources(adminEmail);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Airport source action failed.");
    } finally {
      setIsWorking(false);
    }
  }

  function startEdit(source: AirportDailySource) {
    setEditingSourceId(source.id);
    setForm({
      category: source.category || "baggage",
      is_active: Boolean(source.is_active),
      notes: source.notes || "",
      priority: source.priority || "medium",
      source_name: source.source_name,
      source_type: source.source_type || "supplier",
      source_url: source.source_url,
    });
    setMessage("");
    setError("");
  }

  function resetForm() {
    setEditingSourceId("");
    setForm(emptyForm);
  }

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-[#191919]">
          Airport Daily Sources
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#666666]">
          Manage trusted airport, airline, supplier, and industry media sources used by
          Airport Automation Daily before fallback web search.
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
            {isLoading ? "Loading..." : "Load Sources"}
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

        <div className="mt-8 grid gap-5 lg:grid-cols-[390px_1fr]">
          <form
            className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]"
            onSubmit={saveSource}
          >
            <h2 className="text-2xl font-semibold text-[#191919]">
              {editingSourceId ? "Edit Source" : "Add Source"}
            </h2>
            <div className="mt-5 grid gap-4">
              <TextField
                label="Source name"
                onChange={(value) => setForm((current) => ({ ...current, source_name: value }))}
                value={form.source_name}
              />
              <TextField
                label="Source URL"
                onChange={(value) => setForm((current) => ({ ...current, source_url: value }))}
                value={form.source_url}
              />
              <SelectField
                label="Source type"
                onChange={(value) => setForm((current) => ({ ...current, source_type: value }))}
                options={sourceTypeOptions}
                value={form.source_type}
              />
              <SelectField
                label="Category"
                onChange={(value) => setForm((current) => ({ ...current, category: value }))}
                options={categoryOptions}
                value={form.category}
              />
              <SelectField
                label="Priority"
                onChange={(value) => setForm((current) => ({ ...current, priority: value }))}
                options={priorityOptions}
                value={form.priority}
              />
              <label className="flex items-center gap-3 text-sm font-semibold text-[#191919]">
                <input
                  checked={form.is_active}
                  className="h-4 w-4"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, is_active: event.target.checked }))
                  }
                  type="checkbox"
                />
                Enabled
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                Notes
                <textarea
                  className="min-h-24 rounded-lg border border-[#D9DDE3] px-3 py-2 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  value={form.notes}
                />
              </label>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
                disabled={isWorking}
                type="submit"
              >
                {editingSourceId ? "Save Changes" : "Add Source"}
              </button>
              {editingSourceId && (
                <button
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#191919] transition hover:border-[#0A66C2] hover:text-[#0A66C2]"
                  onClick={resetForm}
                  type="button"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div>
            <div className="flex flex-col gap-3 rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#191919]">
                  Trusted Sources
                </h2>
                <p className="mt-1 text-sm text-[#666666]">
                  {sources.length} configured sources
                </p>
              </div>
              <button
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
                disabled={isWorking || sources.length === 0}
                onClick={() => runAction("check_all")}
                type="button"
              >
                Check Sources Now
              </button>
            </div>

            {testResult && <SourceCheckPanel result={testResult} />}

            <div className="mt-5 grid gap-4">
              {sources.map((source) => (
                <article
                  className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]"
                  key={source.id}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#191919]">
                          {source.source_name}
                        </h3>
                        <span className={source.is_active ? activeBadgeClass : inactiveBadgeClass}>
                          {source.is_active ? "Enabled" : "Disabled"}
                        </span>
                        <span className="rounded-full bg-[#F3F7FD] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
                          {source.priority || "medium"}
                        </span>
                      </div>
                      <a
                        className="mt-2 block break-all text-sm font-semibold text-[#0A66C2] hover:text-[#004182]"
                        href={source.source_url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {source.source_url}
                      </a>
                      <p className="mt-3 text-sm text-[#666666]">
                        {formatSourceType(source.source_type)} / {formatCategory(source.category)}
                      </p>
                      <div className="mt-4 grid gap-2 text-xs text-[#666666] sm:grid-cols-2">
                        <p>Last checked: {formatNullableDate(source.last_checked_at)}</p>
                        <p>Last success: {formatNullableDate(source.last_success_at)}</p>
                      </div>
                      {source.last_successful_story_title && (
                        <a
                          className="mt-3 block text-sm font-semibold text-[#191919] hover:text-[#0A66C2]"
                          href={source.last_successful_story_url || source.source_url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {source.last_successful_story_title}
                        </a>
                      )}
                      {source.notes && (
                        <p className="mt-3 text-sm leading-6 text-[#666666]">
                          {source.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <SourceButton label="Edit" onClick={() => startEdit(source)} />
                      <SourceButton
                        label="Test"
                        onClick={() => runAction("test", { sourceId: source.id })}
                      />
                      <SourceButton
                        label={source.is_active ? "Disable" : "Enable"}
                        onClick={() =>
                          runAction("toggle", {
                            airportSource: { is_active: !source.is_active },
                            sourceId: source.id,
                          })
                        }
                      />
                      <SourceButton
                        danger
                        label="Delete"
                        onClick={() => {
                          if (window.confirm("Delete this Airport Daily source?")) {
                            void runAction("delete", { sourceId: source.id });
                          }
                        }}
                      />
                    </div>
                  </div>
                </article>
              ))}
              {sources.length === 0 && (
                <div className="rounded-lg border border-[#D9DDE3] bg-white p-6 text-sm text-[#666666]">
                  No airport sources configured yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TextField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#191919]">
      {label}
      <input
        className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[][];
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#191919]">
      {label}
      <select
        className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function SourceButton({
  danger,
  label,
  onClick,
}: {
  danger?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={
        danger
          ? "inline-flex h-9 items-center justify-center rounded-lg border border-[#B24020]/25 bg-white px-3 text-xs font-semibold text-[#B24020] transition hover:bg-[#FFF4F1]"
          : "inline-flex h-9 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-3 text-xs font-semibold text-[#191919] transition hover:border-[#0A66C2] hover:text-[#0A66C2]"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function SourceCheckPanel({ result }: { result: SourceCheckResult }) {
  return (
    <section className="mt-5 rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <h3 className="text-xl font-semibold text-[#191919]">Source Check Result</h3>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <Metric label="Sources checked" value={result.sourcesChecked} />
        <Metric label="Candidates found" value={result.candidatesFound} />
        <Metric label="Rejected stories" value={result.rejectedStories.length} />
      </div>
      {result.selectedStory ? (
        <div className="mt-5 rounded-lg border border-[#057642]/20 bg-[#F1F8F4] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#057642]">
            Selected story
          </p>
          <a
            className="mt-2 block text-base font-semibold text-[#191919] hover:text-[#0A66C2]"
            href={result.selectedStory.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {result.selectedStory.title}
          </a>
          <p className="mt-2 text-sm text-[#666666]">
            {result.selectedStory.sourceName} / {result.selectedStory.category} / score{" "}
            {result.selectedStory.score}
            {result.selectedStory.urlType ? ` / ${result.selectedStory.urlType}` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-5 rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] px-4 py-3 text-sm font-semibold text-[#B24020]">
          No strong airport automation story found today.
        </p>
      )}
      {result.rejectedStories.length > 0 && (
        <div className="mt-5 max-h-72 overflow-y-auto rounded-lg border border-[#EEF0F3]">
          {result.rejectedStories.slice(0, 20).map((story, index) => (
            <div className="border-b border-[#EEF0F3] p-3 text-sm last:border-b-0" key={`${story.url}-${index}`}>
              <p className="font-semibold text-[#191919]">{story.title}</p>
              <p className="mt-1 text-[#666666]">
                {story.reason} / score {story.score}
                {story.urlType ? ` / ${story.urlType}` : ""}
              </p>
              <a
                className="mt-1 block break-all text-xs text-[#0A66C2]"
                href={story.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {story.url}
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[#F8FAFC] p-3">
      <p className="text-2xl font-semibold text-[#0A66C2]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#666666]">{label}</p>
    </div>
  );
}

const activeBadgeClass =
  "rounded-full bg-[#F1F8F4] px-3 py-1 text-xs font-semibold text-[#057642]";
const inactiveBadgeClass =
  "rounded-full bg-[#F8F8F6] px-3 py-1 text-xs font-semibold text-[#666666]";

function formatNullableDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatSourceType(value: string | null) {
  return (value || "source").replace(/_/g, " ");
}

function formatCategory(value: string | null) {
  return (value || "uncategorized").replace(/_/g, " ");
}
