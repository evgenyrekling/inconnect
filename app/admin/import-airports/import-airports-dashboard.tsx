"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getCsvValue, normalizeCsvHeader, parseCsvRows } from "@/lib/csv";

type AirportPreviewRow = {
  countryCode: string;
  iataCode: string;
  icaoCode: string;
  name: string;
  rowNumber: number;
  scheduledService: string;
  type: string;
};

type AirportImportSummary = {
  created: number;
  errors: string[];
  skipped: number;
  skippedByCountryFilter: number;
  skippedByImportRule: number;
  totalRows: number;
  updated: number;
};

type AirportImportResponse =
  | {
      success: true;
      summary: AirportImportSummary;
    }
  | {
      details?: string;
      error: string;
    };

const ADMIN_EMAIL_STORAGE_KEY = "inconnect:admin-import-airports-email";

export function ImportAirportsDashboard() {
  const [adminEmail, setAdminEmail] = useState("");
  const [countryCodes, setCountryCodes] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<AirportImportSummary | null>(null);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY);
    if (storedEmail) setAdminEmail(storedEmail);
  }, []);

  useEffect(() => {
    if (!csvFile) {
      setCsvText("");
      return;
    }

    let isCancelled = false;
    csvFile
      .text()
      .then((text) => {
        if (!isCancelled) setCsvText(text);
      })
      .catch(() => {
        if (!isCancelled) setError("Could not read CSV file.");
      });

    return () => {
      isCancelled = true;
    };
  }, [csvFile]);

  const preview = useMemo(
    () => createAirportPreview(csvText, countryCodes),
    [countryCodes, csvText],
  );

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminEmail.trim()) {
      setError("Admin email is required.");
      return;
    }

    if (!csvFile) {
      setError("Choose an OurAirports airports.csv file.");
      return;
    }

    setError("");
    setSummary(null);
    setIsImporting(true);
    window.localStorage.setItem(ADMIN_EMAIL_STORAGE_KEY, adminEmail.trim());

    try {
      const formData = new FormData();
      formData.append("adminEmail", adminEmail.trim());
      formData.append("countryCodes", countryCodes.trim());
      formData.append("file", csvFile);

      const response = await fetch("/api/admin/import-airports", {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | AirportImportResponse
        | null;

      if (!response.ok || !payload || !("success" in payload)) {
        throw new Error(
          payload && "error" in payload
            ? payload.details
              ? `${payload.error}: ${payload.details}`
              : payload.error
            : "Airport accounts could not be imported.",
        );
      }

      setSummary(payload.summary);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Airport accounts could not be imported.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#191919] sm:text-5xl">
          Import Airport Accounts
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#666666]">
          Seed airport account identity data from OurAirports. Passenger traffic is
          intentionally handled separately through the enrichment import.
        </p>

        <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
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
                OurAirports airports.csv
                <input
                  accept=".csv,text/csv"
                  className="rounded-lg border border-dashed border-[#A7B3C2] bg-[#F8F8F6] px-3 py-4 text-sm font-normal text-[#666666] outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-[#4A6FD0] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:border-[#0A66C2]/50 focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                Country filter
                <input
                  className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal uppercase outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => setCountryCodes(event.target.value)}
                  placeholder="Optional, e.g. US, DE, GB"
                  value={countryCodes}
                />
                <span className="text-xs font-normal leading-5 text-[#666666]">
                  Leave empty to import all countries. Use comma-separated ISO country
                  codes to preview and import a subset.
                </span>
              </label>

              <div className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-sm leading-6 text-[#666666]">
                <p className="font-semibold text-[#191919]">Import rules</p>
                <p className="mt-1">
                  INConnect imports rows where `iata_code` exists,
                  `scheduled_service` is `yes`, and `type` is `large_airport` or
                  `medium_airport`.
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
                {isImporting ? "Importing Airports..." : "Import Airport Accounts"}
              </button>
            </div>
          </form>

          <aside className="grid gap-5">
            <div className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
              <h2 className="text-xl font-semibold text-[#191919]">
                Preview
              </h2>
              {preview ? (
                <div className="mt-5 grid gap-3">
                  <SummaryRow label="Total rows" value={preview.totalRows} />
                  <SummaryRow label="Importable rows" value={preview.importableRows} />
                  <SummaryRow
                    label="After country filter"
                    value={preview.filteredRows}
                  />
                  <SummaryRow
                    label="Skipped by import rule"
                    value={preview.skippedByImportRule}
                  />
                  <SummaryRow
                    label="Skipped by country filter"
                    value={preview.skippedByCountryFilter}
                  />
                  {preview.sampleRows.length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-[#D9DDE3]">
                      <div className="grid grid-cols-[0.7fr_1.8fr_0.8fr] bg-[#F8F8F6] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#666666]">
                        <span>IATA</span>
                        <span>Airport</span>
                        <span>Country</span>
                      </div>
                      {preview.sampleRows.map((row) => (
                        <div
                          className="grid grid-cols-[0.7fr_1.8fr_0.8fr] gap-2 border-t border-[#D9DDE3] px-3 py-2 text-sm"
                          key={`${row.rowNumber}-${row.iataCode}`}
                        >
                          <span className="font-semibold text-[#0A66C2]">
                            {row.iataCode}
                          </span>
                          <span className="truncate">{row.name}</span>
                          <span>{row.countryCode}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[#666666]">
                  Choose a CSV to preview importable airports.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
              <h2 className="text-xl font-semibold text-[#191919]">
                Import Result
              </h2>
              {summary ? (
                <div className="mt-5 grid gap-3">
                  <SummaryRow label="Created" value={summary.created} />
                  <SummaryRow label="Updated" value={summary.updated} />
                  <SummaryRow label="Skipped" value={summary.skipped} />
                  <SummaryRow label="Errors" value={summary.errors.length} />
                  {summary.errors.length > 0 && (
                    <ul className="rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] p-4 text-sm leading-6 text-[#7A2E18]">
                      {summary.errors.map((item) => (
                        <li className="list-disc pl-1 marker:text-[#B24020]" key={item}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[#666666]">
                  Import results will appear here after upload.
                </p>
              )}
            </div>
          </aside>
        </div>
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

function createAirportPreview(csvText: string, countryCodes: string) {
  if (!csvText.trim()) return null;
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return null;

  const header = rows[0].map(normalizeCsvHeader);
  const countryFilter = parseCountryFilter(countryCodes);
  const dataRows = rows.slice(1);
  const airportRows = dataRows.flatMap((row, index): AirportPreviewRow[] => {
    if (row.every((cell) => !cell.trim())) return [];

    return [
      {
        countryCode: cleanText(getCsvValue(row, header, "iso_country"), 8).toUpperCase(),
        iataCode: cleanText(getCsvValue(row, header, "iata_code"), 8).toUpperCase(),
        icaoCode: cleanText(getCsvValue(row, header, "gps_code"), 12).toUpperCase(),
        name: cleanText(getCsvValue(row, header, "name"), 240),
        rowNumber: index + 2,
        scheduledService: cleanText(getCsvValue(row, header, "scheduled_service"), 20).toLowerCase(),
        type: cleanText(getCsvValue(row, header, "type"), 80),
      },
    ];
  });
  const importableRows = airportRows.filter(shouldImportAirport);
  const filteredRows =
    countryFilter.size > 0
      ? importableRows.filter((row) => countryFilter.has(row.countryCode))
      : importableRows;

  return {
    filteredRows: filteredRows.length,
    importableRows: importableRows.length,
    sampleRows: filteredRows.slice(0, 8),
    skippedByCountryFilter: importableRows.length - filteredRows.length,
    skippedByImportRule: airportRows.length - importableRows.length,
    totalRows: airportRows.length,
  };
}

function shouldImportAirport(row: AirportPreviewRow) {
  return (
    Boolean(row.iataCode) &&
    row.scheduledService === "yes" &&
    (row.type === "large_airport" || row.type === "medium_airport")
  );
}

function parseCountryFilter(value: string) {
  return new Set(
    value
      .split(",")
      .map((item) => cleanText(item, 8).toUpperCase())
      .filter(Boolean),
  );
}

function cleanText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}
