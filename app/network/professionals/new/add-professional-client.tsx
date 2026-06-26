"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ParsedLinkedInProfile = {
  linkedinUrl: string;
  metadataSource: string;
  profileImageUrl: string;
  publicSlug: string;
  suggestedHeadline: string;
  suggestedName: string;
};

type CompanyOption = {
  city: string;
  countryName: string;
  displayName: string;
  iataCode: string;
  icaoCode: string;
  id: string;
};

type SavedProfessional = {
  id: string;
  displayName: string;
  headline: string;
};

const RELATIONSHIP_OPTIONS = [
  ["employee", "Employee"],
  ["decision_maker", "Decision maker"],
  ["influencer", "Influencer"],
  ["consultant", "Consultant"],
  ["supplier_contact", "Supplier contact"],
  ["partner_contact", "Partner contact"],
  ["former_employee", "Former employee"],
  ["other", "Other"],
];

const STORAGE_KEY = "inconnect:returning-user";
const UNIFIED_STORAGE_KEY = "inconnect:user-identity";

export function AddProfessionalClient({
  initialCompanyId = "",
}: {
  initialCompanyId?: string;
}) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [parsedProfile, setParsedProfile] = useState<ParsedLinkedInProfile | null>(null);
  const [form, setForm] = useState({
    currentCompany: "",
    currentTitle: "",
    displayName: "",
    headline: "",
    industry: "",
    location: "",
    profileImageUrl: "",
  });
  const [companyQuery, setCompanyQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [relationshipType, setRelationshipType] = useState("employee");
  const [department, setDepartment] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [message, setMessage] = useState("");
  const [savedProfessional, setSavedProfessional] = useState<SavedProfessional | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!initialCompanyId) return;

    async function loadInitialCompany() {
      const response = await fetch(
        `/api/network/companies/search?id=${encodeURIComponent(initialCompanyId)}`,
      );
      const data = (await response.json().catch(() => null)) as {
        companies?: CompanyOption[];
      } | null;
      const company = data?.companies?.[0] ?? null;
      setSelectedCompany(company);
      if (company) setCompanyQuery(company.displayName);
    }

    void loadInitialCompany();
  }, [initialCompanyId]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const params = new URLSearchParams();
      if (companyQuery.trim()) params.set("query", companyQuery.trim());
      const response = await fetch(`/api/network/companies/search?${params.toString()}`);
      const data = (await response.json().catch(() => null)) as {
        companies?: CompanyOption[];
      } | null;
      setCompanies(data?.companies ?? []);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [companyQuery]);

  async function parseLinkedInUrl() {
    setIsParsing(true);
    setMessage("");
    setSavedProfessional(null);

    const response = await fetch("/api/network/professionals/parse", {
      body: JSON.stringify({ linkedinUrl }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const data = (await response.json().catch(() => null)) as
      | (ParsedLinkedInProfile & { error?: string })
      | null;

    setIsParsing(false);
    if (!response.ok || !data) {
      setMessage(data?.error ?? "LinkedIn URL could not be parsed.");
      return;
    }

    setParsedProfile(data);
    setLinkedinUrl(data.linkedinUrl);
    setForm({
      currentCompany: "",
      currentTitle: "",
      displayName: data.suggestedName,
      headline: data.suggestedHeadline,
      industry: "",
      location: "",
      profileImageUrl: data.profileImageUrl,
    });
    setMessage(
      data.metadataSource === "open_graph"
        ? "Available public metadata was found. Please confirm before saving."
        : "LinkedIn URL parsed. Please confirm the professional details before saving.",
    );
  }

  async function saveProfessional() {
    if (!parsedProfile) {
      setMessage("Fetch available data before saving.");
      return;
    }

    if (!form.displayName.trim() || !linkedinUrl.trim()) {
      setMessage("Full name and LinkedIn URL are required.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    const ownerEmail = readStoredEmail();
    const response = await fetch("/api/network/professionals", {
      body: JSON.stringify({
        ...form,
        linkedinUrl,
        ownerEmail,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      existing?: boolean;
      profile?: SavedProfessional;
    } | null;

    if (!response.ok || !data?.profile) {
      setIsSaving(false);
      setMessage(data?.error ?? "Professional could not be saved.");
      return;
    }

    setSavedProfessional(data.profile);

    if (selectedCompany) {
      const attachResponse = await fetch("/api/network/professional-company-links", {
        body: JSON.stringify({
          companyId: selectedCompany.id,
          createdByEmail: ownerEmail,
          department,
          isPrimary,
          professionalId: data.profile.id,
          relationshipType,
          title: form.currentTitle,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const attachData = (await attachResponse.json().catch(() => null)) as {
        error?: string;
      } | null;
      setIsSaving(false);

      if (!attachResponse.ok) {
        setMessage(
          `${data.existing ? "Professional already exists." : "Professional saved."} ${attachData?.error ?? "Company attachment failed."}`,
        );
        return;
      }

      setMessage(
        data.existing
          ? "Professional already exists and is attached to the selected company."
          : "Professional saved and attached to the selected company.",
      );
      return;
    }

    setIsSaving(false);
    setMessage(data.existing ? "Professional already exists." : "Professional saved.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
          Step 1
        </p>
        <h2 className="mt-3 text-2xl font-semibold">Paste LinkedIn profile URL</h2>
        <div className="mt-5 grid gap-3">
          <TextField
            label="LinkedIn URL"
            onChange={setLinkedinUrl}
            placeholder="https://www.linkedin.com/in/example-name/"
            value={linkedinUrl}
          />
          <button
            className="inline-flex h-11 w-fit items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#A7B3C2]"
            disabled={isParsing}
            onClick={parseLinkedInUrl}
            type="button"
          >
            {isParsing ? "Fetching..." : "Fetch Available Data"}
          </button>
          <p className="text-sm leading-6 text-[#666666]">
            INConnect only parses the public URL and optional public metadata. It
            does not scrape LinkedIn behind login or verify private data.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
          Step 2
        </p>
        <h2 className="mt-3 text-2xl font-semibold">Confirm professional details</h2>
        <div className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Full name *"
              onChange={(value) => setForm({ ...form, displayName: value })}
              value={form.displayName}
            />
            <TextField
              label="Current title"
              onChange={(value) => setForm({ ...form, currentTitle: value })}
              value={form.currentTitle}
            />
            <TextField
              label="Headline"
              onChange={(value) => setForm({ ...form, headline: value })}
              value={form.headline}
            />
            <TextField
              label="Current company"
              onChange={(value) => setForm({ ...form, currentCompany: value })}
              value={form.currentCompany}
            />
            <TextField
              label="Location"
              onChange={(value) => setForm({ ...form, location: value })}
              value={form.location}
            />
            <TextField
              label="Industry"
              onChange={(value) => setForm({ ...form, industry: value })}
              value={form.industry}
            />
          </div>
          <TextField
            label="Profile photo URL"
            onChange={(value) => setForm({ ...form, profileImageUrl: value })}
            value={form.profileImageUrl}
          />
        </div>
      </section>

      <section className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)] lg:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
          Step 3
        </p>
        <h2 className="mt-3 text-2xl font-semibold">Attach to Company</h2>
        <div className="mt-5 grid gap-4">
          <TextField
            label="Search companies"
            onChange={setCompanyQuery}
            placeholder="Airport name, company, IATA, ICAO, country, or city"
            value={companyQuery}
          />
          {companies.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {companies.map((company) => (
                <button
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedCompany?.id === company.id
                      ? "border-[#0A66C2] bg-[#E8F1FB]"
                      : "border-[#D9DDE3] bg-[#F8F8F6] hover:border-[#0A66C2]/50"
                  }`}
                  key={company.id}
                  onClick={() => {
                    setSelectedCompany(company);
                    setCompanyQuery(company.displayName);
                  }}
                  type="button"
                >
                  <span className="font-semibold">{company.displayName}</span>
                  <span className="ml-2 text-[#666666]">
                    {[company.iataCode, company.icaoCode, company.city, company.countryName]
                      .filter(Boolean)
                      .join(" / ")}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-[#191919]">
              Relationship type
              <select
                className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                onChange={(event) => setRelationshipType(event.target.value)}
                value={relationshipType}
              >
                {RELATIONSHIP_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <TextField label="Department" onChange={setDepartment} value={department} />
            <label className="flex items-center gap-3 self-end text-sm font-semibold text-[#191919]">
              <input
                checked={isPrimary}
                className="h-4 w-4"
                onChange={(event) => setIsPrimary(event.target.checked)}
                type="checkbox"
              />
              Primary relationship
            </label>
          </div>
          <button
            className="inline-flex h-11 w-fit items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#A7B3C2]"
            disabled={isSaving}
            onClick={saveProfessional}
            type="button"
          >
            {isSaving ? "Saving..." : "Save Professional"}
          </button>
          {message && (
            <div className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4 text-sm font-semibold text-[#0A66C2]">
              {message}
            </div>
          )}
          {savedProfessional && (
            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#0A66C2]/30 bg-white px-4 text-sm font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB]"
                href={`/network/professionals/${savedProfessional.id}`}
              >
                View Professional
              </Link>
              {selectedCompany && (
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-4 text-sm font-semibold text-[#191919] transition hover:border-[#0A66C2]/40"
                  href={`/network/accounts/airports/${selectedCompany.id}`}
                >
                  View Company
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TextField({
  label,
  onChange,
  placeholder = "",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#191919]">
      {label}
      <input
        className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function readStoredEmail() {
  try {
    const raw =
      window.localStorage.getItem(UNIFIED_STORAGE_KEY) ??
      window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { email?: string };
    return typeof parsed.email === "string" ? parsed.email : "";
  } catch {
    return "";
  }
}
