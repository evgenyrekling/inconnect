"use client";

import { type FormEvent, useEffect, useState } from "react";

type ImportSummary = {
  connectionsCreated: number;
  duplicatesSkipped: number;
  errors: string[];
  importedUsers: number;
  existingUsersUpdated: number;
  newUsersCreated: number;
  skippedMissingEmail: number;
  skippedMissingName: number;
  skippedRows: SkippedImportRow[];
  totalRowsProcessed: number;
};

type SkippedImportRow = {
  email: string;
  name: string;
  reason: "missing name" | "missing email" | "duplicate email";
  rowNumber: number;
};

type ImportResponse =
  | {
      success: true;
      summary: ImportSummary;
    }
  | {
      details?: string;
      error: string;
    };

const ADMIN_EMAIL_STORAGE_KEY = "inconnect:admin-import-contacts-email";

export function ImportContactsDashboard() {
  const [adminEmail, setAdminEmail] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY);
    if (storedEmail) setAdminEmail(storedEmail);
  }, []);

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminEmail.trim()) {
      setError("Admin email is required.");
      return;
    }

    if (!csvFile) {
      setError("Choose a CSV file to import.");
      return;
    }

    setError("");
    setSummary(null);
    setIsImporting(true);
    window.localStorage.setItem(ADMIN_EMAIL_STORAGE_KEY, adminEmail.trim());

    try {
      const formData = new FormData();
      formData.append("adminEmail", adminEmail.trim());
      formData.append("file", csvFile);

      const response = await fetch("/api/admin/import-contacts", {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | ImportResponse
        | null;

      if (!response.ok || !payload || !("success" in payload)) {
        throw new Error(
          payload && "error" in payload
            ? payload.details
              ? `${payload.error}: ${payload.details}`
              : payload.error
            : "Contacts could not be imported.",
        );
      }

      setSummary(payload.summary);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Contacts could not be imported.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#191919] sm:text-5xl">
          Import Professional Contacts
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#666666]">
          Upload a CSV to create private imported contacts and professional
          graph connections from the admin user to each contact. INConnect will
          not email contacts, send invitations, or expose imported profiles
          publicly.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
          <form
            className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7"
            onSubmit={handleImport}
          >
            <div className="grid gap-5">
              <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                Admin email
                <input
                  className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => setAdminEmail(event.target.value)}
                  placeholder="admin@example.com"
                  type="email"
                  value={adminEmail}
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                Contacts CSV
                <input
                  accept=".csv,text/csv"
                  className="rounded-lg border border-dashed border-[#A7B3C2] bg-[#F8F8F6] px-3 py-4 text-sm font-normal text-[#666666] outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-[#4A6FD0] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:border-[#0A66C2]/50 focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>

              <div className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-sm leading-6 text-[#666666]">
                <p className="font-semibold text-[#191919]">Expected columns</p>
                <p className="mt-1">
                  `name`, `email`, `linkedin_url`, `company`, `title`,
                  `location`, `industry`
                </p>
                <p className="mt-2">
                  Required: `name` and `email`. Supported aliases include
                  `Email Address`, `Full Name`, `First Name`, `Last Name`, and
                  `Position`. If an email appears elsewhere in a row, INConnect
                  will detect it automatically.
                </p>
              </div>

              {error && (
                <p className="rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] px-4 py-3 text-sm font-semibold text-[#B24020]">
                  {error}
                </p>
              )}

              <button
                className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition-colors duration-200 ease-[ease] hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3] disabled:text-[#666666]"
                disabled={isImporting || !adminEmail.trim() || !csvFile}
                type="submit"
              >
                {isImporting ? "Importing Contacts..." : "Import Contacts"}
              </button>
            </div>
          </form>

          <aside className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
            <h2 className="text-xl font-semibold text-[#191919]">
              Import Summary
            </h2>
            {summary ? (
              <div className="mt-5 grid gap-3">
                <SummaryRow label="Total rows processed" value={summary.totalRowsProcessed} />
                <SummaryRow label="Imported users" value={summary.importedUsers} />
                <SummaryRow label="New users created" value={summary.newUsersCreated} />
                <SummaryRow
                  label="Existing users updated"
                  value={summary.existingUsersUpdated}
                />
                <SummaryRow
                  label="Skipped missing name"
                  value={summary.skippedMissingName}
                />
                <SummaryRow
                  label="Skipped missing email"
                  value={summary.skippedMissingEmail}
                />
                <SummaryRow
                  label="Connections created"
                  value={summary.connectionsCreated}
                />
                <SummaryRow
                  label="Duplicates skipped"
                  value={summary.duplicatesSkipped}
                />
                <SummaryRow label="Errors" value={summary.errors.length} />
                {summary.skippedRows.length > 0 && (
                  <button
                    className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg border border-[#0A66C2]/30 bg-white px-4 text-sm font-semibold text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#E8F1FB]"
                    onClick={() => downloadSkippedRowsCsv(summary.skippedRows)}
                    type="button"
                  >
                    Download skipped rows CSV
                  </button>
                )}
                {summary.errors.length > 0 && (
                  <div className="mt-3 rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] p-4">
                    <p className="text-sm font-semibold text-[#B24020]">
                      Import errors
                    </p>
                    <ul className="mt-2 grid gap-2 text-sm leading-5 text-[#7A2E18]">
                      {summary.errors.map((item) => (
                        <li className="list-disc pl-1 marker:text-[#B24020]" key={item}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[#666666]">
                Import results will appear here after upload.
              </p>
            )}
          </aside>
        </div>

        <section className="mt-6 rounded-lg border border-[#D9DDE3] bg-white p-5 text-sm leading-6 text-[#666666] shadow-[0_8px_24px_rgba(10,25,47,0.04)]">
          <p className="font-semibold text-[#191919]">Future graph foundation</p>
          <p className="mt-2">
            Imported connections are private graph data for future business
            matchmaking, mutual connections, professional graph analysis,
            partner discovery, opportunity matching, and company network
            intelligence.
          </p>
        </section>
      </div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-4 py-3">
      <span className="text-sm font-semibold text-[#444444]">{label}</span>
      <span className="text-lg font-semibold text-[#0A66C2]">{value}</span>
    </div>
  );
}

function downloadSkippedRowsCsv(rows: SkippedImportRow[]) {
  const csv = [
    ["row_number", "name", "email", "reason"],
    ...rows.map((row) => [
      String(row.rowNumber),
      row.name,
      row.email,
      row.reason,
    ]),
  ]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "inconnect-skipped-contact-import-rows.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, "\"\"")}"`;
}
