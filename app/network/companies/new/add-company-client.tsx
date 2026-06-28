"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { EmailOTPLoginModal } from "@/components/email-otp-login-modal";
import {
  getVerifiedAuthHeaders,
  readStoredVerifiedIdentity,
} from "@/lib/auth-client";
import {
  ACCOUNT_STATUS_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  STRATEGIC_PRIORITY_OPTIONS,
  type CompanyDuplicate,
} from "@/lib/company-accounts";

type CompanyResponse = {
  company?: { displayName: string; id: string };
  duplicateType?: "exact" | "possible";
  duplicates?: {
    exactDuplicate: CompanyDuplicate | null;
    possibleDuplicates: CompanyDuplicate[];
  };
  error?: string;
  message?: string;
  url?: string;
};

const INDUSTRY_SUGGESTIONS = [
  "Airport Automation",
  "Industrial Automation",
  "Logistics Automation",
  "Aviation",
  "Ground Handling",
  "Security Technology",
  "Smart Infrastructure",
  "Consulting",
];

const STRATEGIC_LABELS: Record<string, string> = {
  high: "High",
  low: "Low",
  medium: "Medium",
  strategic: "Strategic",
  unrated: "Unrated",
};

const STATUS_LABELS: Record<string, string> = {
  competitor: "Competitor",
  customer: "Customer",
  inactive: "Inactive",
  partner: "Partner",
  prospect: "Prospect",
};

export function AddCompanyClient() {
  const router = useRouter();
  const [createAnyway, setCreateAnyway] = useState(false);
  const [duplicates, setDuplicates] = useState<CompanyResponse["duplicates"] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    accountStatus: "prospect",
    city: "",
    companyName: "",
    companyType: "Technology Supplier",
    country: "",
    description: "",
    industry: "",
    linkedinUrl: "",
    notes: "",
    strategicPriority: "unrated",
    website: "",
  });

  const requiredError = getRequiredError(form);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setDuplicates(null);

    if (requiredError) {
      setMessage(requiredError);
      return;
    }

    const identity = readStoredVerifiedIdentity();
    if (!identity?.email) {
      setIsSignInOpen(true);
      setMessage("Sign in with a verified email before adding a company.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/network/companies", {
        body: JSON.stringify({ ...form, createAnyway }),
        headers: { "Content-Type": "application/json", ...(await getVerifiedAuthHeaders()) },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as CompanyResponse | null;

      if (response.status === 409 && payload?.duplicates) {
        setDuplicates(payload.duplicates);
        setMessage(payload.error || "Possible duplicate found.");
        setCreateAnyway(payload.duplicateType !== "exact");
        return;
      }

      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Company could not be created.");
      }

      setMessage(payload.message || "Company created successfully.");
      router.push(payload.url);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Company could not be created.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateField(field: keyof typeof form, value: string) {
    setCreateAnyway(false);
    setDuplicates(null);
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="px-5 py-12 sm:px-8 lg:px-10">
      {isSignInOpen && (
        <EmailOTPLoginModal
          onClose={() => setIsSignInOpen(false)}
          onSignedIn={() => {
            setIsSignInOpen(false);
            setMessage("Verified. Review the company details and save again.");
          }}
        />
      )}

      <div className="mx-auto max-w-5xl">
        <Link className="text-sm font-semibold text-[#0A66C2]" href="/network/accounts">
          Back to Companies
        </Link>
        <div className="mt-8 rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Add Company
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-[#191919]">
            Add a company to INConnect
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#666666]">
            Add suppliers, integrators, distributors, airlines, ground handlers,
            consultants, and other companies to the shared INConnect Companies database.
          </p>

          {message && (
            <p className="mt-5 rounded-lg border border-[#D9DDE3] bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-[#444444]">
              {message}
            </p>
          )}

          {duplicates && (
            <DuplicateWarning
              duplicates={duplicates}
              onCreateAnyway={() => {
                setCreateAnyway(true);
                setMessage("Possible duplicate acknowledged. Click Save Company again to create anyway.");
              }}
            />
          )}

          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <TextField
                label="Company name *"
                onChange={(value) => updateField("companyName", value)}
                placeholder="SICK Sensor Intelligence"
                value={form.companyName}
              />
              <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                Company type *
                <select
                  className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => updateField("companyType", event.target.value)}
                  value={form.companyType}
                >
                  {COMPANY_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Industry *"
                list="industry-suggestions"
                onChange={(value) => updateField("industry", value)}
                placeholder="Airport Automation"
                value={form.industry}
              />
              <TextField
                label="Country *"
                onChange={(value) => updateField("country", value)}
                placeholder="Germany"
                value={form.country}
              />
              <TextField
                label="City"
                onChange={(value) => updateField("city", value)}
                placeholder="Waldkirch"
                value={form.city}
              />
              <TextField
                label="Website"
                onChange={(value) => updateField("website", value)}
                placeholder="https://www.sick.com"
                value={form.website}
              />
              <TextField
                label="LinkedIn URL"
                onChange={(value) => updateField("linkedinUrl", value)}
                placeholder="https://www.linkedin.com/company/..."
                value={form.linkedinUrl}
              />
              <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                Strategic Priority
                <select
                  className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => updateField("strategicPriority", event.target.value)}
                  value={form.strategicPriority}
                >
                  {STRATEGIC_PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {STRATEGIC_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                Account Status
                <select
                  className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => updateField("accountStatus", event.target.value)}
                  value={form.accountStatus}
                >
                  {ACCOUNT_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {STATUS_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <TextArea
              label="Description"
              onChange={(value) => updateField("description", value)}
              placeholder="What this company does, where it fits in the market, and why it matters."
              value={form.description}
            />
            <TextArea
              label="Notes"
              onChange={(value) => updateField("notes", value)}
              placeholder="Private CRM notes, relationship context, or next steps."
              value={form.notes}
            />

            <datalist id="industry-suggestions">
              {INDUSTRY_SUGGESTIONS.map((industry) => (
                <option key={industry} value={industry} />
              ))}
            </datalist>

            <div className="flex flex-wrap gap-3 border-t border-[#EEF0F3] pt-5">
              <button
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Saving..." : "Save Company"}
              </button>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#E8F1FB]"
                href="/network/accounts"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function TextField({
  label,
  list,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  list?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#191919]">
      {label}
      <input
        className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
        list={list}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function TextArea({
  label,
  onChange,
  placeholder,
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
      <textarea
        className="min-h-28 rounded-lg border border-[#D9DDE3] px-3 py-3 text-sm font-normal leading-6 outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function DuplicateWarning({
  duplicates,
  onCreateAnyway,
}: {
  duplicates: NonNullable<CompanyResponse["duplicates"]>;
  onCreateAnyway: () => void;
}) {
  const exact = duplicates.exactDuplicate;
  const possible = duplicates.possibleDuplicates;

  return (
    <div className="mt-5 rounded-lg border border-[#F5C542]/40 bg-[#FFF8E1] p-4">
      <h2 className="text-sm font-semibold text-[#191919]">Possible duplicate found.</h2>
      <div className="mt-3 grid gap-3">
        {exact && <DuplicateRow duplicate={exact} exact />}
        {possible.map((duplicate) => (
          <DuplicateRow duplicate={duplicate} key={duplicate.id} />
        ))}
      </div>
      {!exact && (
        <button
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[#4A6FD0] px-4 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
          onClick={onCreateAnyway}
          type="button"
        >
          Create anyway
        </button>
      )}
    </div>
  );
}

function DuplicateRow({ duplicate, exact }: { duplicate: CompanyDuplicate; exact?: boolean }) {
  return (
    <div className="rounded-lg border border-[#E6D58D] bg-white p-3 text-sm">
      <p className="font-semibold text-[#191919]">{duplicate.displayName}</p>
      <p className="mt-1 text-[#666666]">
        {duplicate.matchReason}
        {exact ? " This exact match cannot be duplicated." : ""}
      </p>
      <Link className="mt-2 inline-flex font-semibold text-[#0A66C2]" href={duplicate.url}>
        Open existing company
      </Link>
    </div>
  );
}

function getRequiredError(form: {
  companyName: string;
  companyType: string;
  country: string;
  industry: string;
}) {
  if (!form.companyName.trim()) return "Company name is required.";
  if (!form.industry.trim()) return "Industry is required.";
  if (!form.country.trim()) return "Country is required.";
  if (!form.companyType.trim()) return "Company type is required.";
  return "";
}
