"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmailOTPLoginModal } from "@/components/email-otp-login-modal";
import {
  getVerifiedAuthHeaders,
  readStoredVerifiedIdentity,
} from "@/lib/auth-client";

type CompanyOption = {
  accountType: string;
  city: string;
  countryName: string;
  displayName: string;
  iataCode: string;
  icaoCode: string;
  id: string;
};

type AttachmentPanelProps = {
  defaultTitle?: string;
  professionalId: string;
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

export function ProfessionalCompanyAttachmentPanel({
  defaultTitle = "",
  professionalId,
}: AttachmentPanelProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [department, setDepartment] = useState("");
  const [relationshipType, setRelationshipType] = useState("employee");
  const [isPrimary, setIsPrimary] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [resumeAttachAfterSignIn, setResumeAttachAfterSignIn] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      const response = await fetch(`/api/network/companies/search?${params.toString()}`);
      const data = (await response.json().catch(() => null)) as {
        companies?: CompanyOption[];
      } | null;
      setCompanies(data?.companies ?? []);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query]);

  async function attachProfessional() {
    const identity = readStoredVerifiedIdentity();
    if (!identity?.email) {
      setResumeAttachAfterSignIn(true);
      setIsSignInOpen(true);
      setMessage("Sign in to attach private professionals.");
      return;
    }

    if (!selectedCompany) {
      setMessage("Select a company first.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    const response = await fetch("/api/network/professional-company-links", {
      body: JSON.stringify({
        companyId: selectedCompany.id,
        department,
        isPrimary,
        professionalId,
        relationshipType,
        title,
      }),
      headers: { "content-type": "application/json", ...(await getVerifiedAuthHeaders()) },
      method: "POST",
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setIsLoading(false);

    if (!response.ok) {
      setMessage(data?.error ?? "Professional could not be attached.");
      return;
    }

    setMessage("Professional attached to company.");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-[#D9DDE3] bg-white p-5">
      {isSignInOpen && (
        <EmailOTPLoginModal
          onClose={() => {
            setIsSignInOpen(false);
            setResumeAttachAfterSignIn(false);
          }}
          onSignedIn={() => {
            setIsSignInOpen(false);
            if (resumeAttachAfterSignIn) {
              setResumeAttachAfterSignIn(false);
              window.setTimeout(() => void attachProfessional(), 0);
            }
          }}
        />
      )}
      <h3 className="text-lg font-semibold">Attach to Company</h3>
      <div className="mt-4 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-[#191919]">
          Search companies
          <input
            className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Company, airport, IATA, ICAO, country, or city"
            value={query}
          />
        </label>
        {companies.length > 0 && (
          <div className="grid gap-2">
            {companies.map((company) => (
              <button
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selectedCompany?.id === company.id
                    ? "border-[#0A66C2] bg-[#E8F1FB]"
                    : "border-[#D9DDE3] bg-[#F8F8F6] hover:border-[#0A66C2]/50"
                }`}
                key={company.id}
                onClick={() => setSelectedCompany(company)}
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
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Title" onChange={setTitle} value={title} />
          <TextField label="Department" onChange={setDepartment} value={department} />
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
          disabled={isLoading}
          onClick={attachProfessional}
          type="button"
        >
          {isLoading ? "Attaching..." : "Attach Professional"}
        </button>
        {message && <p className="text-sm font-semibold text-[#0A66C2]">{message}</p>}
      </div>
    </div>
  );
}

export function RemoveProfessionalCompanyLinkButton({ id }: { id: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function removeLink() {
    setIsLoading(true);
    const params = new URLSearchParams({ id });
    await fetch(`/api/network/professional-company-links?${params.toString()}`, {
      headers: await getVerifiedAuthHeaders(),
      method: "DELETE",
    });
    setIsLoading(false);
    router.refresh();
  }

  return (
    <button
      className="text-xs font-semibold text-[#B42318] transition hover:underline"
      disabled={isLoading}
      onClick={removeLink}
      type="button"
    >
      {isLoading ? "Removing..." : "Remove"}
    </button>
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
