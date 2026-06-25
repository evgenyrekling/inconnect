"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { getCsvValue, normalizeCsvHeader, parseCsvRows } from "@/lib/csv";

type PassengerTier = "mega_hub" | "large_airport" | "medium_airport" | "unknown";
type StrategicPriority = "strategic" | "high" | "medium" | "unrated";
type AutomationPotentialTier =
  | "very_high"
  | "high"
  | "medium"
  | "low"
  | "very_low"
  | "unknown";

type MasterAirportPreviewRow = {
  annualPassengers: number | null;
  airportName: string;
  automationPotentialScore: number | null;
  automationPotentialTier: AutomationPotentialTier;
  city: string;
  countryCode: string;
  countryName: string;
  duplicateInFile: boolean;
  existingInDatabase: boolean;
  iataCode: string;
  icaoCode: string;
  importable: boolean;
  passengerTier: PassengerTier;
  skipReason: SkipReason;
  statusLabel: string;
  strategicPriority: StrategicPriority;
};

type ImportSummary = {
  belowFiveMillionPassengers: number;
  countries: number;
  created: number;
  duplicateIata: number;
  errors: string[];
  invalidIata: number;
  largeAirports: number;
  mediumAirports: number;
  megaHubs: number;
  missingTraffic: number;
  skipped: number;
  totalAirports: number;
  totalRows: number;
  updated: number;
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

type SkipReason =
  | "belowFiveMillionPassengers"
  | "duplicateIata"
  | "invalidIata"
  | "missingTraffic"
  | null;

const ADMIN_EMAIL_STORAGE_KEY = "inconnect:import-strategic-airports-email";
const REQUIRED_COLUMNS = [
  "airport_name",
  "display_name",
  "iata_code",
  "icao_code",
  "ourairports_ident",
  "country_code",
  "country_name",
  "region_code",
  "city",
  "municipality",
  "latitude",
  "longitude",
  "airport_type",
  "scheduled_service",
  "annual_passengers",
  "passenger_year",
  "passenger_tier",
  "strategic_priority",
  "automation_potential_score",
  "automation_potential_tier",
  "website",
  "linkedin_url",
  "source_identity",
  "source_traffic",
  "source_url",
];
const PASSENGER_TIER_LABELS: Record<PassengerTier, string> = {
  large_airport: "Large Airport, 15M to 40M",
  medium_airport: "Medium Airport, 5M to 15M",
  mega_hub: "Mega Hub, 40M+",
  unknown: "Unknown",
};
const STRATEGIC_PRIORITY_LABELS: Record<StrategicPriority, string> = {
  high: "High",
  medium: "Medium",
  strategic: "Strategic",
  unrated: "Unrated",
};
const AUTOMATION_TIER_LABELS: Record<AutomationPotentialTier, string> = {
  high: "High",
  low: "Low",
  medium: "Medium",
  unknown: "Unknown",
  very_high: "Very High",
  very_low: "Very Low",
};

export function ImportStrategicAirportsDashboard() {
  const [adminEmail, setAdminEmail] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [allowUnknownTraffic, setAllowUnknownTraffic] = useState(false);
  const [clearMessage, setClearMessage] = useState("");
  const [error, setError] = useState("");
  const [existingIataCodes, setExistingIataCodes] = useState<Set<string>>(new Set());
  const [isClearing, setIsClearing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY);
    if (storedEmail) setAdminEmail(storedEmail);
  }, []);

  const preview = useMemo(
    () => createMasterPreview(csvText, allowUnknownTraffic, existingIataCodes),
    [allowUnknownTraffic, csvText, existingIataCodes],
  );

  useEffect(() => {
    let isCancelled = false;

    async function checkExistingAirports() {
      const normalizedAdminEmail = adminEmail.trim();
      if (!normalizedAdminEmail || !csvText.trim()) {
        setExistingIataCodes(new Set());
        return;
      }

      const basePreview = createMasterPreview(csvText, allowUnknownTraffic, new Set());
      const iataCodes = Array.from(
        new Set(basePreview.rows.map((row) => row.iataCode).filter(Boolean)),
      );
      if (iataCodes.length === 0) {
        setExistingIataCodes(new Set());
        return;
      }

      try {
        const response = await fetch(
          "/api/admin/import-strategic-airports/check-existing",
          {
            body: JSON.stringify({
              adminEmail: normalizedAdminEmail,
              iataCodes,
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | { existingIataCodes?: string[]; success?: boolean }
          | null;

        if (!isCancelled && response.ok && payload?.success) {
          setExistingIataCodes(new Set(payload.existingIataCodes ?? []));
        }
      } catch {
        if (!isCancelled) setExistingIataCodes(new Set());
      }
    }

    checkExistingAirports();

    return () => {
      isCancelled = true;
    };
  }, [adminEmail, allowUnknownTraffic, csvText]);

  async function handleFileRead(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setCsvFile(file);
    setSummary(null);
    setClearMessage("");
    setError("");

    if (!file) {
      setCsvText("");
      return;
    }

    try {
      setCsvText(await file.text());
    } catch {
      setCsvText("");
      setError("Could not read CSV file.");
    }
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminEmail.trim()) {
      setError("Admin email is required.");
      return;
    }

    if (!csvFile) {
      setError("Upload inconnect_airports_master.csv first.");
      return;
    }

    if (preview.missingColumns.length > 0) {
      setError(`Missing required columns: ${preview.missingColumns.join(", ")}`);
      return;
    }

    setError("");
    setSummary(null);
    setIsImporting(true);
    window.localStorage.setItem(ADMIN_EMAIL_STORAGE_KEY, adminEmail.trim());

    try {
      const formData = new FormData();
      formData.append("adminEmail", adminEmail.trim());
      formData.append("allowUnknownTraffic", String(allowUnknownTraffic));
      formData.append("file", csvFile);

      const response = await fetch("/api/admin/import-strategic-airports", {
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
            : "Strategic airports could not be imported.",
        );
      }

      setSummary(payload.summary);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Strategic airports could not be imported.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function handleClearImportedTestAirports() {
    if (!adminEmail.trim()) {
      setError("Admin email is required before clearing test airports.");
      return;
    }

    const confirmed = window.confirm(
      "Clear imported test airports? This deletes seeded prospect airport accounts.",
    );
    if (!confirmed) return;

    setError("");
    setClearMessage("");
    setIsClearing(true);

    try {
      const response = await fetch("/api/admin/import-strategic-airports", {
        body: JSON.stringify({ adminEmail: adminEmail.trim() }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { deleted?: number; error?: string; details?: string; success?: boolean }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.details
            ? `${payload.error}: ${payload.details}`
            : payload?.error ?? "Imported test airports could not be cleared.",
        );
      }

      setExistingIataCodes(new Set());
      setClearMessage(`Cleared ${payload.deleted ?? 0} imported test airports.`);
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Imported test airports could not be cleared.",
      );
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      <form className="mx-auto max-w-7xl" onSubmit={handleImport}>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#191919] sm:text-5xl">
          Import Strategic Airports
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#666666]">
          Upload one master CSV: `inconnect_airports_master.csv`. This is the only
          supported airport account import format and contains identity, passenger
          traffic, tiering, strategic priority, and automation potential fields.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.75fr]">
          <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
            <h2 className="text-xl font-semibold">Master CSV</h2>
            <label className="mt-5 grid gap-2 text-sm font-semibold text-[#191919]">
              inconnect_airports_master.csv
              <input
                accept=".csv,text/csv"
                className="rounded-lg border border-dashed border-[#A7B3C2] bg-[#F8F8F6] px-3 py-4 text-sm font-normal text-[#666666] outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-[#4A6FD0] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:border-[#0A66C2]/50"
                onChange={handleFileRead}
                type="file"
              />
            </label>

            {preview.missingColumns.length > 0 && (
              <div className="mt-5 rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] p-4">
                <p className="text-sm font-semibold text-[#B24020]">
                  Missing required columns
                </p>
                <p className="mt-2 text-sm leading-6 text-[#7A2E18]">
                  {preview.missingColumns.join(", ")}
                </p>
              </div>
            )}

            <div className="mt-5 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-sm leading-6 text-[#666666]">
              <p className="font-semibold text-[#191919]">Required columns</p>
              <p className="mt-2">{REQUIRED_COLUMNS.join(", ")}</p>
            </div>
          </section>

          <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
            <h2 className="text-xl font-semibold">Import</h2>
            <label className="mt-5 grid gap-2 text-sm font-semibold text-[#191919]">
              Admin email
              <input
                className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="admin@example.com"
                type="email"
                value={adminEmail}
              />
            </label>
            {error && (
              <p className="mt-4 rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] px-4 py-3 text-sm font-semibold text-[#B24020]">
                {error}
              </p>
            )}
            {clearMessage && (
              <p className="mt-4 rounded-lg border border-[#2E7D32]/20 bg-[#EAF6EC] px-4 py-3 text-sm font-semibold text-[#2E7D32]">
                {clearMessage}
              </p>
            )}
            <label className="mt-5 flex items-start gap-3 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-sm font-semibold text-[#191919]">
              <input
                checked={allowUnknownTraffic}
                className="mt-1 h-4 w-4 accent-[#0A66C2]"
                onChange={(event) => setAllowUnknownTraffic(event.target.checked)}
                type="checkbox"
              />
              <span>
                Allow import of airports with unknown traffic
                <span className="block pt-1 text-xs font-normal leading-5 text-[#666666]">
                  Default import requires annual passengers of 5M or more.
                </span>
              </span>
            </label>
            <div className="mt-5 flex gap-3">
              <button
                className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3] disabled:text-[#666666]"
                disabled={
                  isImporting ||
                  !csvFile ||
                  !adminEmail.trim() ||
                  preview.missingColumns.length > 0 ||
                  preview.stats.importableCount === 0
                }
                type="submit"
              >
                {isImporting ? "Importing..." : "Import"}
              </button>
              <button
                className="inline-flex h-12 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#E8F1FB]"
                onClick={() => {
                  setCsvFile(null);
                  setCsvText("");
                  setError("");
                  setSummary(null);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
            <button
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg border border-[#B24020]/30 bg-white px-4 text-sm font-semibold text-[#B24020] transition hover:border-[#B24020] hover:bg-[#FFF4F1] disabled:cursor-not-allowed disabled:border-[#D9DDE3] disabled:text-[#777777]"
              disabled={isClearing || !adminEmail.trim()}
              onClick={handleClearImportedTestAirports}
              type="button"
            >
              {isClearing ? "Clearing..." : "Clear imported test airports"}
            </button>
            {summary && (
              <div className="mt-5 grid gap-2">
                <SummaryRow label="Created" value={summary.created} compact />
                <SummaryRow label="Updated" value={summary.updated} compact />
                <SummaryRow label="Missing traffic" value={summary.missingTraffic} compact />
                <SummaryRow
                  label="Below 5M passengers"
                  value={summary.belowFiveMillionPassengers}
                  compact
                />
                <SummaryRow label="Duplicate IATA" value={summary.duplicateIata} compact />
                <SummaryRow label="Invalid IATA" value={summary.invalidIata} compact />
                <SummaryRow label="Skipped" value={summary.skipped} compact />
                {summary.errors.length > 0 && (
                  <p className="rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] p-3 text-xs leading-5 text-[#B24020]">
                    {summary.errors.join(" ")}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Mega Hubs" value={preview.stats.megaHubCount} />
          <StatCard label="Large Airports" value={preview.stats.largeAirportCount} />
          <StatCard label="Medium Airports" value={preview.stats.mediumAirportCount} />
          <StatCard label="Countries" value={preview.stats.countryCount} />
          <StatCard label="Total Airports" value={preview.stats.importableCount} />
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Missing Traffic" value={preview.stats.missingTrafficCount} warning />
          <StatCard label="Below 5M Passengers" value={preview.stats.belowFiveMillionCount} warning />
          <StatCard label="Duplicate IATA" value={preview.stats.duplicateIataCount} warning />
          <StatCard label="Invalid IATA" value={preview.stats.invalidIataCount} warning />
        </section>

        <section className="mt-5 rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Preview</h2>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                Rows with duplicate IATA codes inside the CSV are skipped after
                the first importable occurrence. Existing account labels only
                appear when the IATA code is already present in the database.
              </p>
            </div>
            <p className="text-sm font-semibold text-[#0A66C2]">
              {preview.stats.importableCount} importable rows
            </p>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-[#D9DDE3]">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
                <thead className="bg-[#F8F8F6] text-xs font-semibold uppercase tracking-[0.14em] text-[#666666]">
                  <tr>
                    <th className="px-4 py-3">Airport</th>
                    <th className="px-4 py-3">IATA</th>
                    <th className="px-4 py-3">ICAO</th>
                    <th className="px-4 py-3">Country</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Passengers</th>
                    <th className="px-4 py-3">Passenger Tier</th>
                    <th className="px-4 py-3">Strategic Priority</th>
                    <th className="px-4 py-3">Automation Score</th>
                    <th className="px-4 py-3">Automation Tier</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 200).map((row, index) => (
                    <tr
                      className={
                        !row.importable
                          ? "border-t border-[#D9DDE3] bg-[#FFF4F1]"
                          : "border-t border-[#D9DDE3]"
                      }
                      key={`${row.iataCode}-${index}`}
                    >
                      <td className="px-4 py-3 font-semibold text-[#191919]">
                        {row.airportName}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#0A66C2]">
                        {row.iataCode}
                      </td>
                      <td className="px-4 py-3">{row.icaoCode || "-"}</td>
                      <td className="px-4 py-3">{row.countryName || row.countryCode}</td>
                      <td className="px-4 py-3">{row.city || "-"}</td>
                      <td className="px-4 py-3">{formatPassengers(row.annualPassengers)}</td>
                      <td className="px-4 py-3">{PASSENGER_TIER_LABELS[row.passengerTier]}</td>
                      <td className="px-4 py-3">
                        {STRATEGIC_PRIORITY_LABELS[row.strategicPriority]}
                      </td>
                      <td className="px-4 py-3">
                        {row.automationPotentialScore ?? "Unknown"}
                      </td>
                      <td className="px-4 py-3">
                        {AUTOMATION_TIER_LABELS[row.automationPotentialTier]}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            row.importable
                              ? "rounded-full bg-[#EAF6EC] px-3 py-1 text-xs font-semibold text-[#2E7D32]"
                              : "rounded-full bg-[#FFF4F1] px-3 py-1 text-xs font-semibold text-[#B24020]"
                          }
                        >
                          {row.statusLabel}
                        </span>
                        {row.existingInDatabase && (
                          <span className="ml-2 rounded-full bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
                            Existing account
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {preview.rows.length > 200 && (
            <p className="mt-3 text-xs leading-5 text-[#666666]">
              Showing first 200 rows.
            </p>
          )}
        </section>
      </form>
    </section>
  );
}

function createMasterPreview(
  csvText: string,
  allowUnknownTraffic: boolean,
  existingIataCodes: Set<string>,
) {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return {
      missingColumns: [],
      rows: [] as MasterAirportPreviewRow[],
      stats: createStats([]),
    };
  }

  const header = rows[0].map(normalizeCsvHeader);
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missingColumns.length > 0) {
    return {
      missingColumns,
      rows: [] as MasterAirportPreviewRow[],
      stats: createStats([]),
    };
  }

  const seenIataCodes = new Set<string>();
  const previewRows = rows.slice(1).flatMap((row): MasterAirportPreviewRow[] => {
    if (row.every((cell) => !cell.trim())) return [];
    const previewRow = parsePreviewRow(row, header, {
      allowUnknownTraffic,
      existingIataCodes,
      seenIataCodes,
    });
    if (previewRow.importable) seenIataCodes.add(previewRow.iataCode);
    return [previewRow];
  });

  return {
    missingColumns,
    rows: previewRows,
    stats: createStats(previewRows),
  };
}

function parsePreviewRow(
  row: string[],
  header: string[],
  {
    allowUnknownTraffic,
    existingIataCodes,
    seenIataCodes,
  }: {
    allowUnknownTraffic: boolean;
    existingIataCodes: Set<string>;
    seenIataCodes: Set<string>;
  },
): MasterAirportPreviewRow {
  const iataCode = normalizeIata(getCsvValue(row, header, "iata_code"));
  const annualPassengers = normalizeTrafficForPreview(
    parsePassengers(getCsvValue(row, header, "annual_passengers")),
  );
  const passengerTier =
    (annualPassengers === null
      ? null
      : normalizePassengerTier(getCsvValue(row, header, "passenger_tier"))) ??
    getPassengerTier(annualPassengers);
  const strategicPriority =
    (annualPassengers === null
      ? null
      : normalizeStrategicPriority(getCsvValue(row, header, "strategic_priority"))) ??
    getStrategicPriorityFromTier(passengerTier);
  const automationScore =
    parseAutomationScore(getCsvValue(row, header, "automation_potential_score")) ??
    calculateAutomationScore({
      airportType: getCsvValue(row, header, "airport_type"),
      annualPassengers,
      passengerTier,
      strategicPriority,
    });

  const previewRow: MasterAirportPreviewRow = {
    annualPassengers,
    airportName: cleanText(getCsvValue(row, header, "airport_name"), 240),
    automationPotentialScore: automationScore,
    automationPotentialTier:
      normalizeAutomationTier(getCsvValue(row, header, "automation_potential_tier")) ??
      getAutomationPotentialTier(automationScore),
    city: cleanText(getCsvValue(row, header, "city"), 180),
    countryCode: cleanText(getCsvValue(row, header, "country_code"), 8).toUpperCase(),
    countryName: cleanText(getCsvValue(row, header, "country_name"), 160),
    duplicateInFile: isValidIata(iataCode) && seenIataCodes.has(iataCode),
    existingInDatabase: existingIataCodes.has(iataCode),
    iataCode,
    icaoCode: cleanText(getCsvValue(row, header, "icao_code"), 12).toUpperCase(),
    importable: false,
    passengerTier,
    skipReason: null,
    statusLabel: "",
    strategicPriority,
  };

  const validation = validatePreviewRow(previewRow, allowUnknownTraffic);
  previewRow.importable = validation.importable;
  previewRow.skipReason = validation.importable ? null : validation.reason;
  previewRow.statusLabel = validation.importable
    ? "Importable"
    : getSkipReasonLabel(validation.reason);

  return previewRow;
}

function validatePreviewRow(
  row: MasterAirportPreviewRow,
  allowUnknownTraffic: boolean,
):
  | { importable: true }
  | {
      importable: false;
      reason: Exclude<SkipReason, null>;
    } {
  if (!isValidIata(row.iataCode)) {
    return { importable: false, reason: "invalidIata" };
  }

  if (row.duplicateInFile) {
    return { importable: false, reason: "duplicateIata" };
  }

  if (row.annualPassengers === null) {
    return allowUnknownTraffic
      ? { importable: true }
      : { importable: false, reason: "missingTraffic" };
  }

  if (row.annualPassengers < 5_000_000) {
    return { importable: false, reason: "belowFiveMillionPassengers" };
  }

  return { importable: true };
}

function getSkipReasonLabel(reason: Exclude<SkipReason, null>) {
  if (reason === "missingTraffic") return "Skipped: missing traffic";
  if (reason === "belowFiveMillionPassengers") return "Skipped: below 5M";
  if (reason === "duplicateIata") return "Skipped: duplicate IATA";
  return "Skipped: invalid IATA";
}

function createStats(rows: MasterAirportPreviewRow[]) {
  const importableRows = rows.filter((row) => row.importable);
  const countries = new Set(importableRows.map((row) => row.countryCode).filter(Boolean));

  return {
    countryCount: countries.size,
    belowFiveMillionCount: rows.filter(
      (row) => row.skipReason === "belowFiveMillionPassengers",
    ).length,
    duplicateIataCount: rows.filter((row) => row.skipReason === "duplicateIata").length,
    importableCount: importableRows.length,
    invalidIataCount: rows.filter((row) => row.skipReason === "invalidIata").length,
    largeAirportCount: importableRows.filter((row) => row.passengerTier === "large_airport").length,
    mediumAirportCount: importableRows.filter((row) => row.passengerTier === "medium_airport").length,
    megaHubCount: importableRows.filter((row) => row.passengerTier === "mega_hub").length,
    missingTrafficCount: rows.filter((row) => row.skipReason === "missingTraffic").length,
  };
}

function SummaryRow({
  compact,
  label,
  value,
}: {
  compact?: boolean;
  label: string;
  value: number;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-4 ${
        compact ? "py-2" : "py-3"
      }`}
    >
      <span className="text-sm font-semibold text-[#444444]">{label}</span>
      <span className="text-lg font-semibold text-[#0A66C2]">{value}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  warning,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] ${
        warning
          ? "border-[#F5C542]/50 bg-[#FFF9E8]"
          : "border-[#D9DDE3] bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-[#0A66C2]">{value}</p>
    </div>
  );
}

function getPassengerTier(annualPassengers: number | null): PassengerTier {
  if (annualPassengers === null) return "unknown";
  if (annualPassengers >= 40_000_000) return "mega_hub";
  if (annualPassengers >= 15_000_000) return "large_airport";
  if (annualPassengers >= 5_000_000) return "medium_airport";
  return "unknown";
}

function getStrategicPriorityFromTier(passengerTier: PassengerTier): StrategicPriority {
  if (passengerTier === "mega_hub") return "strategic";
  if (passengerTier === "large_airport") return "high";
  if (passengerTier === "medium_airport") return "medium";
  return "unrated";
}

function calculateAutomationScore({
  airportType,
  annualPassengers,
  passengerTier,
  strategicPriority,
}: {
  airportType: string;
  annualPassengers: number | null;
  passengerTier: PassengerTier;
  strategicPriority: StrategicPriority;
}) {
  let score = passengerTier === "mega_hub" ? 70 : passengerTier === "large_airport" ? 55 : passengerTier === "medium_airport" ? 40 : 20;

  if (annualPassengers !== null) {
    if (annualPassengers >= 70_000_000) score += 10;
    else if (annualPassengers >= 40_000_000) score += 8;
    else if (annualPassengers >= 15_000_000) score += 5;
  }

  if (strategicPriority === "strategic") score += 5;
  else if (strategicPriority === "high") score += 3;
  if (airportType === "large_airport") score += 5;
  return Math.min(100, Math.max(0, score));
}

function getAutomationPotentialTier(score: number | null): AutomationPotentialTier {
  if (score === null) return "unknown";
  if (score >= 80) return "very_high";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "very_low";
}

function normalizePassengerTier(value: string) {
  const normalized = normalizeToken(value);
  if (
    normalized === "mega_hub" ||
    normalized === "large_airport" ||
    normalized === "medium_airport" ||
    normalized === "unknown"
  ) {
    return normalized as PassengerTier;
  }
  return null;
}

function normalizeStrategicPriority(value: string) {
  const normalized = normalizeToken(value);
  if (
    normalized === "strategic" ||
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "unrated"
  ) {
    return normalized as StrategicPriority;
  }
  return null;
}

function normalizeAutomationTier(value: string) {
  const normalized = normalizeToken(value);
  if (
    normalized === "very_high" ||
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low" ||
    normalized === "very_low" ||
    normalized === "unknown"
  ) {
    return normalized as AutomationPotentialTier;
  }
  return null;
}

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z_]/g, "");
}

function parsePassengers(value: string) {
  const normalizedValue = value.replace(/[,\s]/g, "").trim();
  if (!normalizedValue) return null;
  const passengers = Number.parseInt(normalizedValue, 10);
  return Number.isFinite(passengers) && passengers >= 0 ? passengers : null;
}

function normalizeTrafficForPreview(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function parseAutomationScore(value: string) {
  const score = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(score)) return null;
  return Math.min(100, Math.max(0, score));
}

function formatPassengers(value: number | null) {
  if (value === null) return "Unknown";
  return new Intl.NumberFormat("en").format(value);
}

function normalizeIata(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}

function isValidIata(value: string) {
  return /^[A-Z0-9]{3}$/.test(value);
}

function cleanText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}
