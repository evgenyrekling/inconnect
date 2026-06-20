"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

type AirportDailyCandidate = {
  id: string;
  title: string;
  source_url: string;
  source_name: string | null;
  source_image_url: string | null;
  category: string | null;
  notes: string | null;
  status: string | null;
  priority: string | null;
  selected_for_digest: boolean | null;
  used_at: string | null;
  created_by_email: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CandidateFormState = {
  category: string;
  notes: string;
  priority: string;
  source_image_url: string;
  source_name: string;
  source_url: string;
  status: string;
  title: string;
};

const ADMIN_EMAIL_STORAGE_KEY = "inconnect:admin-airport-candidates-email";

const emptyForm: CandidateFormState = {
  category: "baggage",
  notes: "",
  priority: "medium",
  source_image_url: "",
  source_name: "",
  source_url: "",
  status: "pending",
  title: "",
};

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

const statusOptions = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["used", "Used"],
];

export function AdminAirportCandidatesDashboard() {
  const [adminEmail, setAdminEmail] = useState("");
  const [candidates, setCandidates] = useState<AirportDailyCandidate[]>([]);
  const [editingCandidateId, setEditingCandidateId] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<CandidateFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY);
    if (storedEmail) setAdminEmail(storedEmail);
  }, []);

  async function loadCandidates(nextEmail = adminEmail) {
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
      const response = await fetch(`/api/admin/airport-candidates?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { candidates?: AirportDailyCandidate[]; details?: string; error?: string }
        | null;

      if (!response.ok || !payload?.candidates) {
        throw new Error(
          payload?.details || payload?.error || "Airport candidates could not be loaded.",
        );
      }

      setCandidates(payload.candidates);
    } catch (loadError) {
      setCandidates([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Airport candidates could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadCandidates();
  }

  async function saveCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(editingCandidateId ? "update" : "create", {
      candidate: form,
      candidateId: editingCandidateId || undefined,
    });
  }

  async function runAction(action: string, extraPayload: Record<string, unknown> = {}) {
    if (!adminEmail.trim()) {
      setError("Admin email is required.");
      return;
    }

    setError("");
    setMessage("");
    setIsWorking(true);

    try {
      const response = await fetch("/api/admin/airport-candidates", {
        body: JSON.stringify({
          action,
          email: adminEmail.trim(),
          ...extraPayload,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            briefingId?: string;
            details?: string;
            emailId?: string;
            error?: string;
            slug?: string;
            success?: boolean;
            title?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.details || payload?.error || "Airport candidate action failed.");
      }

      if (action === "generate") {
        setMessage(`Generated digest: ${payload?.title ?? "Airport Daily"}`);
      } else if (action === "send_test") {
        setMessage(`Generated digest and sent test email to ${adminEmail.trim()}.`);
      } else if (action === "approve") {
        setMessage("Candidate approved.");
      } else if (action === "reject") {
        setMessage("Candidate rejected.");
      } else if (action === "mark_used") {
        setMessage("Candidate marked as used.");
      } else if (action === "delete") {
        setMessage("Candidate deleted.");
      } else {
        setMessage(editingCandidateId ? "Candidate updated." : "Candidate saved.");
      }

      if (action === "create" || action === "update") {
        setEditingCandidateId("");
        setForm(emptyForm);
      }

      await loadCandidates(adminEmail);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Airport candidate action failed.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  function startEdit(candidate: AirportDailyCandidate) {
    setEditingCandidateId(candidate.id);
    setForm({
      category: candidate.category || "baggage",
      notes: candidate.notes || "",
      priority: candidate.priority || "medium",
      source_image_url: candidate.source_image_url || "",
      source_name: candidate.source_name || "",
      source_url: candidate.source_url,
      status: candidate.status || "pending",
      title: candidate.title,
    });
    setError("");
    setMessage("");
  }

  function resetForm() {
    setEditingCandidateId("");
    setForm(emptyForm);
  }

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-[#191919]">
          Airport Daily Candidate Queue
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#666666]">
          Add specific airport automation stories for INConnect to turn into daily
          1-minute briefings. Approved candidates are checked before managed sources and
          general web search.
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
            {isLoading ? "Loading..." : "Load Candidates"}
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
            onSubmit={saveCandidate}
          >
            <h2 className="text-2xl font-semibold text-[#191919]">
              {editingCandidateId ? "Edit Candidate" : "Add Candidate"}
            </h2>
            <div className="mt-5 grid gap-4">
              <TextField
                label="Title"
                onChange={(value) => setForm((current) => ({ ...current, title: value }))}
                value={form.title}
              />
              <TextField
                label="Source URL"
                onChange={(value) => setForm((current) => ({ ...current, source_url: value }))}
                value={form.source_url}
              />
              <TextField
                label="Source name"
                onChange={(value) => setForm((current) => ({ ...current, source_name: value }))}
                value={form.source_name}
              />
              <TextField
                label="Optional source image URL"
                onChange={(value) =>
                  setForm((current) => ({ ...current, source_image_url: value }))
                }
                value={form.source_image_url}
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
              <SelectField
                label="Status"
                onChange={(value) => setForm((current) => ({ ...current, status: value }))}
                options={statusOptions}
                value={form.status}
              />
              <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                Notes
                <textarea
                  className="min-h-28 rounded-lg border border-[#D9DDE3] px-3 py-2 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
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
                {editingCandidateId ? "Save Changes" : "Save Candidate"}
              </button>
              {editingCandidateId && (
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
            <div className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
              <h2 className="text-2xl font-semibold text-[#191919]">
                Candidate Queue
              </h2>
              <p className="mt-1 text-sm text-[#666666]">
                {candidates.length} candidate stories
              </p>
            </div>

            <div className="mt-5 grid gap-4">
              {candidates.map((candidate) => (
                <article
                  className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]"
                  key={candidate.id}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={getStatusClass(candidate.status)}>
                          {candidate.status || "pending"}
                        </span>
                        <span className="rounded-full bg-[#F3F7FD] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
                          {candidate.priority || "medium"}
                        </span>
                        {candidate.selected_for_digest && (
                          <span className="rounded-full bg-[#F1F8F4] px-3 py-1 text-xs font-semibold text-[#057642]">
                            selected
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-xl font-semibold text-[#191919]">
                        {candidate.title}
                      </h3>
                      <a
                        className="mt-2 block break-all text-sm font-semibold text-[#0A66C2] hover:text-[#004182]"
                        href={candidate.source_url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {candidate.source_url}
                      </a>
                      <p className="mt-3 text-sm text-[#666666]">
                        {candidate.source_name || "Unknown source"} /{" "}
                        {formatCategory(candidate.category)}
                      </p>
                      {candidate.notes && (
                        <p className="mt-3 text-sm leading-6 text-[#444444]">
                          {candidate.notes}
                        </p>
                      )}
                      <div className="mt-4 grid gap-2 text-xs text-[#666666] sm:grid-cols-2">
                        <p>Created: {formatNullableDate(candidate.created_at)}</p>
                        <p>Used: {formatNullableDate(candidate.used_at)}</p>
                      </div>
                      {candidate.status === "used" && (
                        <Link
                          className="mt-3 inline-flex text-sm font-semibold text-[#0A66C2] hover:text-[#004182]"
                          href="/admin/airport-daily"
                        >
                          Review latest digest
                        </Link>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <CandidateButton label="Edit" onClick={() => startEdit(candidate)} />
                      <CandidateButton
                        label="Approve"
                        onClick={() => runAction("approve", { candidateId: candidate.id })}
                      />
                      <CandidateButton
                        label="Reject"
                        onClick={() => {
                          if (window.confirm("Reject this candidate?")) {
                            void runAction("reject", { candidateId: candidate.id });
                          }
                        }}
                      />
                      <CandidateButton
                        label="Generate Digest"
                        onClick={() => runAction("generate", { candidateId: candidate.id })}
                      />
                      <CandidateButton
                        label="Send Test Email"
                        onClick={() => runAction("send_test", { candidateId: candidate.id })}
                      />
                      <CandidateButton
                        label="Mark Used"
                        onClick={() => runAction("mark_used", { candidateId: candidate.id })}
                      />
                      <CandidateButton
                        danger
                        label="Delete"
                        onClick={() => {
                          if (window.confirm("Delete this candidate?")) {
                            void runAction("delete", { candidateId: candidate.id });
                          }
                        }}
                      />
                    </div>
                  </div>
                </article>
              ))}

              {candidates.length === 0 && (
                <div className="rounded-lg border border-[#D9DDE3] bg-white p-6 text-sm text-[#666666]">
                  No airport candidates yet.
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

function CandidateButton({
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

function getStatusClass(value: string | null) {
  const status = value || "pending";
  if (status === "approved") {
    return "rounded-full bg-[#F1F8F4] px-3 py-1 text-xs font-semibold text-[#057642]";
  }
  if (status === "rejected") {
    return "rounded-full bg-[#FFF4F1] px-3 py-1 text-xs font-semibold text-[#B24020]";
  }
  if (status === "used") {
    return "rounded-full bg-[#F8F8F6] px-3 py-1 text-xs font-semibold text-[#666666]";
  }
  return "rounded-full bg-[#FFF8E5] px-3 py-1 text-xs font-semibold text-[#8A5A00]";
}

function formatNullableDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCategory(value: string | null) {
  return (value || "uncategorized").replace(/_/g, " ");
}
