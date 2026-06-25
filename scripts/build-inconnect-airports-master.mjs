import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const SOURCE_DIR = path.join(DATA_DIR, "source");
const OUTPUT_MASTER = path.join(DATA_DIR, "inconnect_airports_master_v1.csv");
const OUTPUT_REJECTED = path.join(DATA_DIR, "rejected_airports.csv");
const OUTPUT_MISSING = path.join(DATA_DIR, "missing_passenger_data.csv");
const OUTPUT_SUMMARY = path.join(DATA_DIR, "import_summary.json");

const OURAIRPORTS_AIRPORTS_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";
const OURAIRPORTS_COUNTRIES_URL =
  "https://davidmegginson.github.io/ourairports-data/countries.csv";
const WIKIDATA_PATRONAGE_URL =
  "https://www.wikidata.org/wiki/Property:P3872";
const WIKIDATA_PATRONAGE_QUERY = `
SELECT ?airport ?airportLabel ?iata ?passengers ?pointInTime ?website ?refUrl WHERE {
  ?airport wdt:P238 ?iata ;
    p:P3872 ?statement .
  ?statement ps:P3872 ?passengers .
  OPTIONAL { ?statement pq:P585 ?pointInTime . }
  OPTIONAL { ?airport wdt:P856 ?website . }
  OPTIONAL {
    ?statement prov:wasDerivedFrom ?ref .
    ?ref pr:P854 ?refUrl .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

const MASTER_COLUMNS = [
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

const REJECTED_COLUMNS = [
  ...MASTER_COLUMNS,
  "rejection_reason",
  "traffic_source_url",
];

const MISSING_COLUMNS = [
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
  "source_identity",
];

await mkdir(DATA_DIR, { recursive: true });
await mkdir(SOURCE_DIR, { recursive: true });
await ensureSourceFiles();

const airports = parseCsv(
  await readFile(path.join(SOURCE_DIR, "ourairports_airports.csv"), "utf8"),
);
const countries = parseCsv(
  await readFile(path.join(SOURCE_DIR, "ourairports_countries.csv"), "utf8"),
);
const wikidata = JSON.parse(
  await readFile(path.join(SOURCE_DIR, "wikidata_airport_patronage.json"), "utf8"),
);

const countryNameByCode = new Map(
  countries
    .map((country) => [clean(country.code).toUpperCase(), clean(country.name)])
    .filter(([code]) => code),
);
const patronageByIata = getLatestPatronageByIata(wikidata);
const strategicCandidates = airports
  .map(normalizeAirport)
  .filter(
    (airport) =>
      airport.iata_code &&
      airport.scheduled_service === "yes" &&
      (airport.airport_type === "large_airport" ||
        airport.airport_type === "medium_airport"),
  );

const masterRows = [];
const rejectedRows = [];
const missingRows = [];

for (const airport of strategicCandidates) {
  const patronage = patronageByIata.get(airport.iata_code);

  if (!patronage) {
    missingRows.push(toMissingRow(airport));
    rejectedRows.push({
      ...toMasterRow(airport, null),
      rejection_reason: "missing_passenger_data",
      traffic_source_url: "",
    });
    continue;
  }

  if (patronage.passengers < 5_000_000) {
    rejectedRows.push({
      ...toMasterRow(airport, patronage),
      rejection_reason: "below_5m_passengers",
      traffic_source_url: patronage.sourceUrl,
    });
    continue;
  }

  masterRows.push(toMasterRow(airport, patronage));
}

masterRows.sort((a, b) => Number(b.annual_passengers) - Number(a.annual_passengers));
rejectedRows.sort((a, b) => String(a.iata_code).localeCompare(String(b.iata_code)));
missingRows.sort((a, b) => String(a.iata_code).localeCompare(String(b.iata_code)));

await writeFile(OUTPUT_MASTER, stringifyCsv(MASTER_COLUMNS, masterRows), "utf8");
await writeFile(OUTPUT_REJECTED, stringifyCsv(REJECTED_COLUMNS, rejectedRows), "utf8");
await writeFile(OUTPUT_MISSING, stringifyCsv(MISSING_COLUMNS, missingRows), "utf8");

const summary = createSummary({
  masterRows,
  rejectedRows,
  missingRows,
  patronageByIata,
  strategicCandidates,
});
await writeFile(OUTPUT_SUMMARY, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      masterRows: masterRows.length,
      rejectedRows: rejectedRows.length,
      missingPassengerData: missingRows.length,
      outputs: {
        importSummary: OUTPUT_SUMMARY,
        master: OUTPUT_MASTER,
        missingPassengerData: OUTPUT_MISSING,
        rejected: OUTPUT_REJECTED,
      },
    },
    null,
    2,
  ),
);

function normalizeAirport(row) {
  const countryCode = clean(row.iso_country).toUpperCase();
  const airportName = clean(row.name);

  return {
    airport_name: airportName,
    display_name: airportName,
    iata_code: clean(row.iata_code).toUpperCase(),
    icao_code: clean(row.icao_code).toUpperCase(),
    ourairports_ident: clean(row.ident),
    country_code: countryCode,
    country_name: countryNameByCode.get(countryCode) ?? countryCode,
    region_code: clean(row.iso_region),
    city: clean(row.municipality),
    municipality: clean(row.municipality),
    latitude: clean(row.latitude_deg),
    longitude: clean(row.longitude_deg),
    airport_type: clean(row.type),
    scheduled_service: clean(row.scheduled_service).toLowerCase(),
    website: clean(row.home_link),
  };
}

function getLatestPatronageByIata(wikidataPayload) {
  const result = new Map();
  const bindings = wikidataPayload?.results?.bindings ?? [];

  for (const binding of bindings) {
    const iata = clean(binding.iata?.value).toUpperCase();
    const passengers = parseInteger(binding.passengers?.value);
    if (!/^[A-Z0-9]{3}$/.test(iata) || passengers === null || passengers <= 0) {
      continue;
    }

    const year = parseYear(binding.pointInTime?.value);
    const sourceUrl = clean(binding.refUrl?.value) || clean(binding.airport?.value);
    const website = clean(binding.website?.value);
    const itemUrl = clean(binding.airport?.value);
    const current = result.get(iata);
    const candidate = {
      itemUrl,
      passengers,
      sourceUrl,
      website,
      year,
    };

    if (!current || isBetterPatronage(candidate, current)) {
      result.set(iata, candidate);
    }
  }

  return result;
}

function isBetterPatronage(candidate, current) {
  const candidateYear = candidate.year ?? 0;
  const currentYear = current.year ?? 0;
  if (candidateYear !== currentYear) return candidateYear > currentYear;

  const candidateHasReference = candidate.sourceUrl && candidate.sourceUrl !== candidate.itemUrl;
  const currentHasReference = current.sourceUrl && current.sourceUrl !== current.itemUrl;
  if (candidateHasReference !== currentHasReference) return candidateHasReference;

  return candidate.passengers > current.passengers;
}

function toMasterRow(airport, patronage) {
  const annualPassengers = patronage?.passengers ?? "";
  const passengerTier =
    typeof annualPassengers === "number" ? getPassengerTier(annualPassengers) : "unknown";
  const strategicPriority = getStrategicPriority(passengerTier);
  const automationScore =
    typeof annualPassengers === "number"
      ? calculateAutomationScore({
          airportType: airport.airport_type,
          annualPassengers,
          passengerTier,
          strategicPriority,
        })
      : "";
  const automationTier =
    typeof automationScore === "number" ? getAutomationTier(automationScore) : "unknown";

  return {
    airport_name: airport.airport_name,
    display_name: airport.display_name,
    iata_code: airport.iata_code,
    icao_code: airport.icao_code,
    ourairports_ident: airport.ourairports_ident,
    country_code: airport.country_code,
    country_name: airport.country_name,
    region_code: airport.region_code,
    city: airport.city,
    municipality: airport.municipality,
    latitude: airport.latitude,
    longitude: airport.longitude,
    airport_type: airport.airport_type,
    scheduled_service: airport.scheduled_service,
    annual_passengers: annualPassengers,
    passenger_year: patronage?.year ?? "",
    passenger_tier: passengerTier,
    strategic_priority: strategicPriority,
    automation_potential_score: automationScore,
    automation_potential_tier: automationTier,
    website: airport.website || patronage?.website || "",
    linkedin_url: "",
    source_identity: OURAIRPORTS_AIRPORTS_URL,
    source_traffic: patronage ? "Wikidata P3872 patronage" : "",
    source_url: patronage?.sourceUrl ?? "",
  };
}

function toMissingRow(airport) {
  return {
    airport_name: airport.airport_name,
    display_name: airport.display_name,
    iata_code: airport.iata_code,
    icao_code: airport.icao_code,
    ourairports_ident: airport.ourairports_ident,
    country_code: airport.country_code,
    country_name: airport.country_name,
    region_code: airport.region_code,
    city: airport.city,
    municipality: airport.municipality,
    latitude: airport.latitude,
    longitude: airport.longitude,
    airport_type: airport.airport_type,
    scheduled_service: airport.scheduled_service,
    source_identity: OURAIRPORTS_AIRPORTS_URL,
  };
}

function createSummary({
  masterRows,
  rejectedRows,
  missingRows,
  patronageByIata,
  strategicCandidates,
}) {
  const importedByTier = countBy(masterRows, "passenger_tier");
  const importedByPriority = countBy(masterRows, "strategic_priority");
  const importedByCountry = countBy(masterRows, "country_name");
  const importedByTrafficYear = countBy(masterRows, "passenger_year");
  const rejectedByReason = countBy(rejectedRows, "rejection_reason");

  return {
    generated_at: new Date().toISOString(),
    target_requested: "800-1000 strategic commercial airports worldwide",
    target_result_note:
      "Open-source passenger traffic rows meeting the strict >=5M rule are below the requested target. No passenger numbers were guessed; airports without traffic were written to missing_passenger_data.csv.",
    source_identity: {
      name: "OurAirports airports.csv",
      url: OURAIRPORTS_AIRPORTS_URL,
      countries_url: OURAIRPORTS_COUNTRIES_URL,
    },
    source_traffic: {
      name: "Wikidata P3872 patronage statements",
      url: WIKIDATA_PATRONAGE_URL,
      extraction_rule:
        "Latest point-in-time patronage statement per IATA code; if no point-in-time exists, keep the highest referenced value only after year-qualified values.",
    },
    import_criteria: {
      annual_passengers_minimum: 5_000_000,
      airport_types: ["large_airport", "medium_airport"],
      iata_code_required: true,
      scheduled_service: "yes",
    },
    counts: {
      imported: masterRows.length,
      missing_passenger_data: missingRows.length,
      passenger_rows_available_by_iata: patronageByIata.size,
      rejected: rejectedRows.length,
      strategic_identity_candidates: strategicCandidates.length,
    },
    imported_by_tier: importedByTier,
    imported_by_strategic_priority: importedByPriority,
    imported_by_country_top_25: Object.fromEntries(
      Object.entries(importedByCountry)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 25),
    ),
    imported_by_passenger_year: importedByTrafficYear,
    rejected_by_reason: rejectedByReason,
    top_20_busiest_airports: masterRows.slice(0, 20).map((row) => ({
      annual_passengers: Number(row.annual_passengers),
      airport_name: row.airport_name,
      country_name: row.country_name,
      iata_code: row.iata_code,
      passenger_year: row.passenger_year,
      source_url: row.source_url,
    })),
    output_files: {
      master: "data/inconnect_airports_master_v1.csv",
      rejected: "data/rejected_airports.csv",
      missing_passenger_data: "data/missing_passenger_data.csv",
      summary: "data/import_summary.json",
    },
  };
}

function getPassengerTier(annualPassengers) {
  if (annualPassengers >= 40_000_000) return "mega_hub";
  if (annualPassengers >= 15_000_000) return "large_airport";
  return "medium_airport";
}

function getStrategicPriority(passengerTier) {
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
}) {
  let score =
    passengerTier === "mega_hub"
      ? 70
      : passengerTier === "large_airport"
        ? 55
        : passengerTier === "medium_airport"
          ? 40
          : 20;

  if (annualPassengers >= 70_000_000) score += 10;
  else if (annualPassengers >= 40_000_000) score += 8;
  else if (annualPassengers >= 15_000_000) score += 5;

  if (strategicPriority === "strategic") score += 5;
  else if (strategicPriority === "high") score += 3;
  if (airportType === "large_airport") score += 5;

  return Math.min(100, Math.max(0, score));
}

function getAutomationTier(score) {
  if (score >= 80) return "very_high";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "very_low";
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);

  const header = rows.shift()?.map((cell) => cell.trim()) ?? [];
  return rows.map((values) =>
    Object.fromEntries(header.map((column, index) => [column, values[index] ?? ""])),
  );
}

function stringifyCsv(columns, rows) {
  return [
    columns.map(escapeCsv).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column] ?? "")).join(",")),
  ].join("\n");
}

function escapeCsv(value) {
  const stringValue = String(value ?? "");
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseYear(value) {
  const match = String(value ?? "").match(/^(\d{4})/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    const value = String(row[key] || "unknown");
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

async function ensureSourceFiles() {
  await ensureFile(
    path.join(SOURCE_DIR, "ourairports_airports.csv"),
    OURAIRPORTS_AIRPORTS_URL,
  );
  await ensureFile(
    path.join(SOURCE_DIR, "ourairports_countries.csv"),
    OURAIRPORTS_COUNTRIES_URL,
  );

  const wikidataPath = path.join(SOURCE_DIR, "wikidata_airport_patronage.json");
  if (!existsSync(wikidataPath)) {
    const endpoint = new URL("https://query.wikidata.org/sparql");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("query", WIKIDATA_PATRONAGE_QUERY);
    await ensureFile(wikidataPath, endpoint.toString());
  }
}

async function ensureFile(filePath, url) {
  if (existsSync(filePath)) return;

  console.log(`Downloading ${url}`);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "INConnect airport database builder/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed for ${url}: ${response.status}`);
  }

  await writeFile(filePath, await response.text(), "utf8");
}
