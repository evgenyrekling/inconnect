"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getCsvValue, normalizeCsvHeader, parseCsvRows } from "@/lib/csv";

type TrafficPreviewRow = {
  annualPassengers: string;
  iataCode: string;
  passengerYear: string;
  rowNumber: number;
  sourceTraffic: string;
};

type AirportTrafficImportSummary = {
  errors: string[];
  invalidRows: number;
  totalRows: number;
  unmatchedIataCodes: string[];
  updated: number;
};

type AirportTrafficImportResponse =
  | {
      success: true;
      summary: AirportTrafficImportSummary;
    }
  | {
      details?: string;
      error: string;
    };

const ADMIN_EMAIL_STORAGE_KEY = "inconnect:admin-import-airport-traffic-email";

export function ImportAirportTrafficDashboard() {
  const [adminEmail, setAdminEmail] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<AirportTrafficImportSummary | null>(null);

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

  const preview = useMemo(() => createTrafficPreview(csvText), [csvText]);

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminEmail.trim()) {
      setError("Admin email is required.");
      return;
    }

    if (!csvFile) {
      setError("Choose an airport traffic CSV file.");
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

      const response = await fetch("/api/admin/import-airport-traffic", {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | AirportTrafficImportResponse
        | null;

      if (!response.ok || !payload || !("success" in payload)) {
        throw new Error(
          payload && "error" in payload
            ? payload.details
              ? `${payload.error}: ${payload.details}`
              : payload.error
            : "Airport traffic could not be imported.",
        );
      }

      setSummary(payload.summary);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Airport traffic could not be imported.",
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
          Import Airport Traffic
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#666666]">
          Enrich existing airport accounts with passenger traffic data. INConnect
          recalculates passenger tier and strategic priority after each matched update.
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
                Airport traffic CSV
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
                  `iata_code`, `annual_passengers`, `passenger_year`,
                  `source_traffic`, `source_url`
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
                {isImporting ? "Importing Traffic..." : "Import Airport Traffic"}
              </button>
            </div>
          </form>

          <aside className="grid gap-5">
            <div className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
              <h2 className="text-xl font-semibold text-[#191919]">Preview</h2>
              {preview ? (
                <div className="mt-5 grid gap-3">
                  <SummaryRow label="Rows detected" value={preview.totalRows} />
                  <SummaryRow label="Rows with IATA" value={preview.rowsWithIata} />
                  {preview.sampleRows.length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-[#D9DDE3]">
                      <div className="grid grid-cols-[0.7fr_1fr_0.7fr] bg-[#F8F8F6] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#666666]">
                        <span>IATA</span>
                        <span>Passengers</span>
                        <span>Year</span>
                      </div>
                      {preview.sampleRows.map((row) => (
                        <div
                          className="grid grid-cols-[0.7fr_1fr_0.7fr] gap-2 border-t border-[#D9DDE3] px-3 py-2 text-sm"
                          key={`${row.rowNumber}-${row.iataCode}`}
                        >
                          <span className="font-semibold text-[#0A66C2]">
                            {row.iataCode || "Missing"}
                          </span>
                          <span>{row.annualPassengers || "Missing"}</span>
                          <span>{row.passengerYear || "Missing"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[#666666]">
                  Choose a CSV to preview traffic enrichment rows.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
              <h2 className="text-xl font-semibold text-[#191919]">
                Import Result
              </h2>
              {summary ? (
                <div className="mt-5 grid gap-3">
                  <SummaryRow label="Updated accounts" value={summary.updated} />
                  <SummaryRow label="Invalid rows" value={summary.invalidRows} />
                  <SummaryRow
                    label="Unmatched IATA codes"
                    value={summary.unmatchedIataCodes.length}
                  />
                  <SummaryRow label="Errors" value={summary.errors.length} />
                  {summary.unmatchedIataCodes.length > 0 && (
                    <p className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-sm leading-6 text-[#666666]">
                      {summary.unmatchedIataCodes.join(", ")}
                    </p>
                  )}
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

function createTrafficPreview(csvText: string) {
  if (!csvText.trim()) return null;
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return null;

  const header = rows[0].map(normalizeTrafficHeader);
  const dataRows = rows.slice(1);
  const trafficRows = dataRows.flatMap((row, index): TrafficPreviewRow[] => {
    if (row.every((cell) => !cell.trim())) return [];

    return [
      {
        annualPassengers: getCsvValue(row, header, "annual_passengers"),
        iataCode: getCsvValue(row, header, "iata_code").toUpperCase(),
        passengerYear: getCsvValue(row, header, "passenger_year"),
        rowNumber: index + 2,
        sourceTraffic: getCsvValue(row, header, "source_traffic"),
      },
    ];
  });

  return {
    rowsWithIata: trafficRows.filter((row) => row.iataCode).length,
    sampleRows: trafficRows.slice(0, 8),
    totalRows: trafficRows.length,
  };
}

function normalizeTrafficHeader(value: string) {
  const normalizedHeader = normalizeCsvHeader(value);
  const aliases: Record<string, string> = {
    annual_pax: "annual_passengers",
    annual_passenger_count: "annual_passengers",
    annual_passengers: "annual_passengers",
    iata: "iata_code",
    iata_code: "iata_code",
    passengers: "annual_passengers",
    pax: "annual_passengers",
    passenger_year: "passenger_year",
    source: "source_traffic",
    source_traffic: "source_traffic",
    source_url: "source_url",
    traffic_source: "source_traffic",
    url: "source_url",
    year: "passenger_year",
  };

  return aliases[normalizedHeader] ?? normalizedHeader;
}
