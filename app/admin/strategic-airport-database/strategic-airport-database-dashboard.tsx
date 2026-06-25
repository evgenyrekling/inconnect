"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { getCsvValue, normalizeCsvHeader, parseCsvRows } from "@/lib/csv";

type IdentityAirport = {
  airportType: string;
  city: string;
  countryCode: string;
  countryName: string;
  iataCode: string;
  icaoCode: string;
  latitude: number | null;
  longitude: number | null;
  municipality: string;
  name: string;
  ourairportsIdent: string;
  regionCode: string;
  scheduledService: string;
};

type TrafficAirport = {
  annualPassengers: number | null;
  iataCode: string;
  passengerYear: number | null;
  sourceTraffic: string;
  sourceUrl: string;
};

type MergedAirport = IdentityAirport & {
  annualPassengers: number | null;
  importable: boolean;
  passengerTier: PassengerTier;
  passengerYear: number | null;
  sourceTraffic: string;
  sourceUrl: string;
  strategicPriority: StrategicPriority;
  validationReason: string;
};

type PassengerTier = "mega_hub" | "large_airport" | "medium_airport" | "unknown";
type StrategicPriority = "strategic" | "high" | "medium" | "unrated";

type ImportSummary = {
  countries: number;
  created: number;
  errors: string[];
  highAutomationPotential: number;
  largeAirports: number;
  mediumAirports: number;
  megaHubs: number;
  missingPassengerData: number;
  recalculatedScores: number;
  skipped: number;
  totalReceived: number;
  totalImported: number;
  updated: number;
  veryHighAutomationPotential: number;
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

const ADMIN_EMAIL_STORAGE_KEY = "inconnect:strategic-airport-database-email";
const MIN_STRATEGIC_PASSENGERS = 5_000_000;
const PASSENGER_TIER_LABELS: Record<PassengerTier, string> = {
  large_airport: "Large Airport, 15M to 40M",
  medium_airport: "Medium Airport, 5M to 15M",
  mega_hub: "Mega Hub, 40M+",
  unknown: "Unknown, no traffic data",
};
const STRATEGIC_PRIORITY_LABELS: Record<StrategicPriority, string> = {
  high: "High",
  medium: "Medium",
  strategic: "Strategic",
  unrated: "Unrated",
};

export function StrategicAirportDatabaseDashboard() {
  const [adminEmail, setAdminEmail] = useState("");
  const [identityText, setIdentityText] = useState("");
  const [trafficText, setTrafficText] = useState("");
  const [manualPassengers, setManualPassengers] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY);
    if (storedEmail) setAdminEmail(storedEmail);
  }, []);

  const identityAirports = useMemo(() => parseIdentityAirports(identityText), [identityText]);
  const trafficAirports = useMemo(() => parseTrafficAirports(trafficText), [trafficText]);
  const trafficByIata = useMemo(() => {
    const trafficMap = new Map<string, TrafficAirport>();
    for (const traffic of trafficAirports) {
      if (traffic.iataCode) trafficMap.set(traffic.iataCode, traffic);
    }
    return trafficMap;
  }, [trafficAirports]);
  const mergedAirports = useMemo(
    () => mergeStrategicAirports(identityAirports, trafficByIata, manualPassengers),
    [identityAirports, manualPassengers, trafficByIata],
  );
  const stats = useMemo(() => createStrategicStats(mergedAirports), [mergedAirports]);
  const visibleAirports = useMemo(
    () =>
      filterMergedAirports(mergedAirports, {
        priority: priorityFilter,
        query,
        tier: tierFilter,
      }).slice(0, 300),
    [mergedAirports, priorityFilter, query, tierFilter],
  );
  const importableAirports = useMemo(
    () => mergedAirports.filter((airport) => airport.importable),
    [mergedAirports],
  );

  async function handleFileRead(
    event: ChangeEvent<HTMLInputElement>,
    onRead: (text: string) => void,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      onRead("");
      return;
    }

    try {
      onRead(await file.text());
      setSummary(null);
      setError("");
    } catch {
      setError("Could not read CSV file.");
    }
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminEmail.trim()) {
      setError("Admin email is required.");
      return;
    }

    if (importableAirports.length === 0) {
      setError("No airports qualify for import. Add passenger traffic of 5M+ first.");
      return;
    }

    setError("");
    setSummary(null);
    setIsImporting(true);
    window.localStorage.setItem(ADMIN_EMAIL_STORAGE_KEY, adminEmail.trim());

    try {
      const response = await fetch("/api/admin/strategic-airport-database/import", {
        body: JSON.stringify({
          adminEmail: adminEmail.trim(),
          airports: importableAirports,
        }),
        headers: {
          "Content-Type": "application/json",
        },
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
            : "Strategic Airport Database import failed.",
        );
      }

      setSummary(payload.summary);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Strategic Airport Database import failed.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#191919] sm:text-5xl">
          Strategic Airport Database
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#666666]">
          Merge OurAirports identity data with trusted passenger traffic before
          importing. Only airports with scheduled service, IATA codes, large or
          medium OurAirports type, and 5M+ passengers are imported by default.
        </p>

        <form className="mt-8 grid gap-5" onSubmit={handleImport}>
          <div className="grid gap-5 xl:grid-cols-3">
            <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)]">
              <h2 className="text-xl font-semibold">Import Airport Identity</h2>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                Upload OurAirports `airports.csv`. This file supplies airport identity
                only, not traffic.
              </p>
              <label className="mt-5 grid gap-2 text-sm font-semibold text-[#191919]">
                OurAirports airports.csv
                <input
                  accept=".csv,text/csv"
                  className="rounded-lg border border-dashed border-[#A7B3C2] bg-[#F8F8F6] px-3 py-4 text-sm font-normal text-[#666666] outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-[#4A6FD0] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:border-[#0A66C2]/50"
                  onChange={(event) => handleFileRead(event, setIdentityText)}
                  type="file"
                />
              </label>
              <SummaryRow label="Identity rows" value={identityAirports.length} />
            </section>

            <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)]">
              <h2 className="text-xl font-semibold">Import Passenger Traffic</h2>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                Upload enrichment CSV with `iata_code`, `annual_passengers`,
                `passenger_year`, `source_traffic`, and `source_url`.
              </p>
              <label className="mt-5 grid gap-2 text-sm font-semibold text-[#191919]">
                Passenger traffic CSV
                <input
                  accept=".csv,text/csv"
                  className="rounded-lg border border-dashed border-[#A7B3C2] bg-[#F8F8F6] px-3 py-4 text-sm font-normal text-[#666666] outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-[#4A6FD0] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:border-[#0A66C2]/50"
                  onChange={(event) => handleFileRead(event, setTrafficText)}
                  type="file"
                />
              </label>
              <SummaryRow label="Traffic rows" value={trafficAirports.length} />
            </section>

            <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)]">
              <h2 className="text-xl font-semibold">Import</h2>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                Preview the merged airport database, edit missing passenger values if
                needed, then import only qualifying strategic airport accounts.
              </p>
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
              <button
                className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition-colors duration-200 ease-[ease] hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3] disabled:text-[#666666]"
                disabled={isImporting || importableAirports.length === 0}
                type="submit"
              >
                {isImporting ? "Importing Strategic Airports..." : "Import Strategic Airports"}
              </button>
              {summary && (
                <div className="mt-5 grid gap-2">
                  <SummaryRow label="Created" value={summary.created} compact />
                  <SummaryRow label="Updated" value={summary.updated} compact />
                  <SummaryRow label="Total imported" value={summary.totalImported} compact />
                  <SummaryRow
                    label="Scores recalculated"
                    value={summary.recalculatedScores}
                    compact
                  />
                  <SummaryRow
                    label="Very High potential"
                    value={summary.veryHighAutomationPotential}
                    compact
                  />
                  <SummaryRow
                    label="High potential"
                    value={summary.highAutomationPotential}
                    compact
                  />
                  <SummaryRow
                    label="Missing passenger data"
                    value={summary.missingPassengerData}
                    compact
                  />
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

          <StrategicStats stats={stats} totalImported={summary?.totalImported ?? 0} />

          <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Merge Preview</h2>
                <p className="mt-2 text-sm leading-6 text-[#666666]">
                  Missing passenger traffic is highlighted. Edit passenger values
                  directly to include manually validated airports.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3 lg:w-[720px]">
                <input
                  className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search airport, IATA, ICAO, city, country"
                  value={query}
                />
                <select
                  className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => setTierFilter(event.target.value)}
                  value={tierFilter}
                >
                  <option value="">All passenger tiers</option>
                  {Object.entries(PASSENGER_TIER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => setPriorityFilter(event.target.value)}
                  value={priorityFilter}
                >
                  <option value="">All priorities</option>
                  {Object.entries(STRATEGIC_PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-[#D9DDE3]">
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
                  <thead className="bg-[#F8F8F6] text-xs font-semibold uppercase tracking-[0.14em] text-[#666666]">
                    <tr>
                      <th className="px-4 py-3">Airport</th>
                      <th className="px-4 py-3">IATA</th>
                      <th className="px-4 py-3">ICAO</th>
                      <th className="px-4 py-3">Country</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Passengers</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAirports.map((airport) => (
                      <tr
                        className={
                          airport.importable
                            ? "border-t border-[#D9DDE3]"
                            : "border-t border-[#D9DDE3] bg-[#FFF9E8]"
                        }
                        key={airport.iataCode}
                      >
                        <td className="px-4 py-3 font-semibold text-[#191919]">
                          {airport.name}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#0A66C2]">
                          {airport.iataCode}
                        </td>
                        <td className="px-4 py-3">{airport.icaoCode || "-"}</td>
                        <td className="px-4 py-3">{airport.countryName || airport.countryCode}</td>
                        <td className="px-4 py-3">{airport.city || airport.municipality || "-"}</td>
                        <td className="px-4 py-3">
                          <input
                            className="h-10 w-36 rounded-lg border border-[#D9DDE3] px-3 text-sm outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                            onChange={(event) =>
                              setManualPassengers((current) => ({
                                ...current,
                                [airport.iataCode]: event.target.value,
                              }))
                            }
                            placeholder="Passengers"
                            value={
                              manualPassengers[airport.iataCode] ??
                              (airport.annualPassengers
                                ? String(airport.annualPassengers)
                                : "")
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={airport.passengerTier === "unknown" ? "gray" : "blue"}>
                            {PASSENGER_TIER_LABELS[airport.passengerTier]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            tone={airport.strategicPriority === "unrated" ? "gray" : "green"}
                          >
                            {STRATEGIC_PRIORITY_LABELS[airport.strategicPriority]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-[#666666]">
                          {airport.validationReason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {visibleAirports.length === 300 && (
              <p className="mt-3 text-xs leading-5 text-[#666666]">
                Showing first 300 matching rows. Use search or filters to narrow
                the preview.
              </p>
            )}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
            <div className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)]">
              <h2 className="text-2xl font-semibold">Top 20 Busiest Airports</h2>
              <div className="mt-5 grid gap-2">
                {stats.top20.map((airport, index) => (
                  <div
                    className="grid grid-cols-[40px_1fr_auto] gap-3 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-4 py-3 text-sm"
                    key={airport.iataCode}
                  >
                    <span className="font-semibold text-[#0A66C2]">{index + 1}</span>
                    <span className="font-semibold">{airport.name}</span>
                    <span className="text-[#666666]">
                      {formatPassengers(airport.annualPassengers)}
                    </span>
                  </div>
                ))}
                {stats.top20.length === 0 && (
                  <p className="text-sm leading-6 text-[#666666]">
                    Upload and merge traffic data to show busiest airports.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)]">
              <h2 className="text-2xl font-semibold">Country Distribution</h2>
              <div className="mt-5 grid gap-2">
                {stats.countryDistribution.slice(0, 20).map((item) => (
                  <div
                    className="flex items-center justify-between gap-4 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-4 py-3 text-sm"
                    key={item.country}
                  >
                    <span className="font-semibold">{item.country}</span>
                    <span className="font-semibold text-[#0A66C2]">{item.count}</span>
                  </div>
                ))}
                {stats.countryDistribution.length === 0 && (
                  <p className="text-sm leading-6 text-[#666666]">
                    Country distribution appears after identity and traffic data are
                    merged.
                  </p>
                )}
              </div>
            </div>
          </section>
        </form>
      </div>
    </section>
  );
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
      className={`mt-4 flex items-center justify-between gap-4 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-4 ${
        compact ? "py-2" : "py-3"
      }`}
    >
      <span className="text-sm font-semibold text-[#444444]">{label}</span>
      <span className="text-lg font-semibold text-[#0A66C2]">{value}</span>
    </div>
  );
}

function StrategicStats({
  stats,
  totalImported,
}: {
  stats: ReturnType<typeof createStrategicStats>;
  totalImported: number;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
      <StatCard label="Mega Hubs" value={stats.megaHubCount} />
      <StatCard label="Large Airports" value={stats.largeAirportCount} />
      <StatCard label="Medium Airports" value={stats.mediumAirportCount} />
      <StatCard label="Countries" value={stats.countryCount} />
      <StatCard label="Importable" value={stats.totalImportable} />
      <StatCard label="Total Imported" value={totalImported} />
      <StatCard label="Missing Traffic" value={stats.missingTrafficCount} warning />
    </section>
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

function Badge({
  children,
  tone,
}: {
  children: string;
  tone: "blue" | "gray" | "green";
}) {
  const className =
    tone === "blue"
      ? "border-[#0A66C2]/20 bg-[#E8F1FB] text-[#0A66C2]"
      : tone === "green"
        ? "border-[#2E7D32]/20 bg-[#EAF6EC] text-[#2E7D32]"
        : "border-[#D9DDE3] bg-[#F8F8F6] text-[#666666]";

  return (
    <span
      className={`inline-flex w-fit items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function parseIdentityAirports(csvText: string) {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return [];
  const header = rows[0].map(normalizeCsvHeader);

  return rows.slice(1).flatMap((row): IdentityAirport[] => {
    if (row.every((cell) => !cell.trim())) return [];
    const countryCode = cleanText(getCsvValue(row, header, "iso_country"), 8).toUpperCase();
    const municipality = cleanText(getCsvValue(row, header, "municipality"), 180);
    const ourairportsIdent = cleanText(getCsvValue(row, header, "ident"), 80);

    return [
      {
        airportType: cleanText(getCsvValue(row, header, "type"), 80),
        city: municipality,
        countryCode,
        countryName: getCountryName(countryCode),
        iataCode: normalizeIata(getCsvValue(row, header, "iata_code")),
        icaoCode:
          cleanText(getCsvValue(row, header, "gps_code"), 12).toUpperCase() ||
          inferIcaoCode(ourairportsIdent),
        latitude: parseCoordinate(getCsvValue(row, header, "latitude_deg")),
        longitude: parseCoordinate(getCsvValue(row, header, "longitude_deg")),
        municipality,
        name: cleanText(getCsvValue(row, header, "name"), 240),
        ourairportsIdent,
        regionCode: cleanText(getCsvValue(row, header, "iso_region"), 40),
        scheduledService: cleanText(getCsvValue(row, header, "scheduled_service"), 20).toLowerCase(),
      },
    ];
  });
}

function parseTrafficAirports(csvText: string) {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return [];
  const header = rows[0].map(normalizeTrafficHeader);

  return rows.slice(1).flatMap((row): TrafficAirport[] => {
    if (row.every((cell) => !cell.trim())) return [];

    return [
      {
        annualPassengers: parsePassengers(getCsvValue(row, header, "annual_passengers")),
        iataCode: normalizeIata(getCsvValue(row, header, "iata_code")),
        passengerYear: parseYear(getCsvValue(row, header, "passenger_year")),
        sourceTraffic: cleanText(getCsvValue(row, header, "source_traffic"), 240),
        sourceUrl: cleanText(getCsvValue(row, header, "source_url"), 500),
      },
    ];
  });
}

function mergeStrategicAirports(
  identityAirports: IdentityAirport[],
  trafficByIata: Map<string, TrafficAirport>,
  manualPassengers: Record<string, string>,
) {
  return identityAirports
    .filter((airport) => isIdentityCandidate(airport))
    .map((airport): MergedAirport => {
      const traffic = trafficByIata.get(airport.iataCode);
      const manualPassengerValue = manualPassengers[airport.iataCode];
      const manualPassengerCount =
        typeof manualPassengerValue === "string" && manualPassengerValue.trim()
          ? parsePassengers(manualPassengerValue)
          : null;
      const annualPassengers = manualPassengerCount ?? traffic?.annualPassengers ?? null;
      const passengerTier = getPassengerTier(annualPassengers);
      const strategicPriority = getStrategicPriorityFromTier(passengerTier);
      const importable =
        typeof annualPassengers === "number" &&
        annualPassengers >= MIN_STRATEGIC_PASSENGERS;

      return {
        ...airport,
        annualPassengers,
        importable,
        passengerTier,
        passengerYear: traffic?.passengerYear ?? null,
        sourceTraffic:
          traffic?.sourceTraffic ||
          (manualPassengerCount !== null ? "Manual admin passenger value" : ""),
        sourceUrl: traffic?.sourceUrl ?? "",
        strategicPriority,
        validationReason: getValidationReason(annualPassengers),
      };
    })
    .sort((first, second) => {
      const firstPassengers = first.annualPassengers ?? -1;
      const secondPassengers = second.annualPassengers ?? -1;
      return secondPassengers - firstPassengers || first.name.localeCompare(second.name);
    });
}

function createStrategicStats(airports: MergedAirport[]) {
  const importableAirports = airports.filter((airport) => airport.importable);
  const countries = new Map<string, number>();

  for (const airport of importableAirports) {
    const country = airport.countryName || airport.countryCode || "Unknown";
    countries.set(country, (countries.get(country) ?? 0) + 1);
  }

  return {
    countryCount: countries.size,
    countryDistribution: Array.from(countries.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((first, second) => second.count - first.count || first.country.localeCompare(second.country)),
    largeAirportCount: importableAirports.filter(
      (airport) => airport.passengerTier === "large_airport",
    ).length,
    mediumAirportCount: importableAirports.filter(
      (airport) => airport.passengerTier === "medium_airport",
    ).length,
    megaHubCount: importableAirports.filter(
      (airport) => airport.passengerTier === "mega_hub",
    ).length,
    missingTrafficCount: airports.filter((airport) => airport.annualPassengers === null).length,
    top20: importableAirports.slice(0, 20),
    totalImportable: importableAirports.length,
  };
}

function filterMergedAirports(
  airports: MergedAirport[],
  filters: {
    priority: string;
    query: string;
    tier: string;
  },
) {
  return airports.filter((airport) => {
    if (
      filters.query &&
      !matchesText(
        filters.query,
        airport.name,
        airport.iataCode,
        airport.icaoCode,
        airport.city,
        airport.municipality,
        airport.countryCode,
        airport.countryName,
        PASSENGER_TIER_LABELS[airport.passengerTier],
        STRATEGIC_PRIORITY_LABELS[airport.strategicPriority],
      )
    ) {
      return false;
    }

    if (filters.tier && filters.tier !== airport.passengerTier) return false;
    if (filters.priority && filters.priority !== airport.strategicPriority) return false;
    return true;
  });
}

function isIdentityCandidate(airport: IdentityAirport) {
  return (
    Boolean(airport.iataCode) &&
    airport.scheduledService === "yes" &&
    (airport.airportType === "large_airport" || airport.airportType === "medium_airport")
  );
}

function getValidationReason(annualPassengers: number | null) {
  if (annualPassengers === null) return "Missing passenger traffic";
  if (annualPassengers < MIN_STRATEGIC_PASSENGERS) return "Below 5M, excluded";
  return "Ready to import";
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

function formatPassengers(value: number | null) {
  if (value === null) return "Missing";
  return new Intl.NumberFormat("en").format(value);
}

function parsePassengers(value: string) {
  const normalizedValue = value.replace(/[,\s]/g, "").trim();
  if (!normalizedValue) return null;
  const passengers = Number.parseInt(normalizedValue, 10);
  return Number.isFinite(passengers) && passengers >= 0 ? passengers : null;
}

function parseYear(value: string) {
  const year = Number.parseInt(value.trim(), 10);
  const currentYear = new Date().getFullYear() + 1;
  if (!Number.isFinite(year) || year < 1900 || year > currentYear) return null;
  return year;
}

function parseCoordinate(value: string) {
  const coordinate = Number.parseFloat(value.trim());
  return Number.isFinite(coordinate) ? coordinate : null;
}

function normalizeIata(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}

function inferIcaoCode(ident: string) {
  const normalizedIdent = ident.trim().toUpperCase();
  return /^[A-Z]{4}$/.test(normalizedIdent) ? normalizedIdent : "";
}

function getCountryName(countryCode: string) {
  if (!countryCode) return "";
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return displayNames.of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}

function matchesText(filterValue: string, ...values: string[]) {
  const normalizedFilter = filterValue.trim().toLowerCase();
  return values.some((value) => value.toLowerCase().includes(normalizedFilter));
}

function cleanText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}
