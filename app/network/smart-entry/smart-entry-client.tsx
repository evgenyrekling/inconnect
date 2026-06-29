"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { EmailOTPLoginModal } from "@/components/email-otp-login-modal";
import { getVerifiedAuthHeaders } from "@/lib/auth-client";

type Mode = "linkedin" | "manual" | "pdf" | "card";
type ManualType = "both" | "professional" | "company";
type Step = "entry" | "review" | "success";

type SmartDraft = {
  professionals: ProfessionalDraft[];
  companies: CompanyDraft[];
  links: LinkDraft[];
};

type ProfessionalDraft = {
  current_company: string;
  current_title: string;
  full_name: string;
  headline: string;
  industry: string;
  linkedin_url: string;
  location: string;
  notes: string;
  professional_email: string;
  profile_image_url: string;
};

type CompanyDraft = {
  city: string;
  company_type: string;
  country_name: string;
  description: string;
  display_name: string;
  industry: string;
  linkedin_url: string;
  name: string;
  notes: string;
  use_existing_company_id?: string;
  website: string;
};

type LinkDraft = {
  company_index: number;
  department: string;
  is_primary: boolean;
  professional_index: number;
  relationship_type: string;
  title: string;
};

type Duplicate = {
  companyType: string;
  displayName: string;
  id: string;
  matchReason: string;
  url: string;
};

type ReviewResponse = {
  review?: {
    companies: Array<{
      duplicates: {
        exactDuplicate: Duplicate | null;
        possibleDuplicates: Duplicate[];
      };
      index: number;
    }>;
    professionals: Array<{
      duplicate: { display_name?: string; id: string; slug: string } | null;
      index: number;
    }>;
  };
};

type SaveResult = {
  companies: Array<{ displayName: string; id: string; url: string }>;
  links: Array<{ id: string }>;
  professionals: Array<{ displayName: string; id: string; url: string }>;
};

const emptyProfessional: ProfessionalDraft = {
  current_company: "",
  current_title: "",
  full_name: "",
  headline: "",
  industry: "",
  linkedin_url: "",
  location: "",
  notes: "",
  professional_email: "",
  profile_image_url: "",
};

const emptyCompany: CompanyDraft = {
  city: "",
  company_type: "Technology Supplier",
  country_name: "",
  description: "",
  display_name: "",
  industry: "",
  linkedin_url: "",
  name: "",
  notes: "",
  website: "",
};

const companyTypes = [
  "Airport Operator",
  "Airline",
  "Technology Supplier",
  "System Integrator",
  "Distributor",
  "Ground Handler",
  "Cargo Operator",
  "Consultant",
  "Authority",
  "OEM",
  "Other",
];

export function SmartEntryClient() {
  const [draft, setDraft] = useState<SmartDraft>({
    companies: [],
    links: [],
    professionals: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [manualType, setManualType] = useState<ManualType>("both");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<Mode>("linkedin");
  const [review, setReview] = useState<ReviewResponse["review"] | null>(null);
  const [saveAfterSignIn, setSaveAfterSignIn] = useState(false);
  const [step, setStep] = useState<Step>("entry");
  const [success, setSuccess] = useState<SaveResult | null>(null);

  async function createLinkedInDraft() {
    setMessage("");
    if (!linkedinUrl.trim()) {
      setMessage("Paste a LinkedIn profile URL first.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/professionals/fetch-linkedin", {
        body: JSON.stringify({ linkedin_url: linkedinUrl }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            current_company?: string;
            current_title?: string;
            full_name?: string;
            headline?: string;
            industry?: string;
            linkedin_url?: string;
            location?: string;
            profile_image_url?: string;
          }
        | null;

      if (!response.ok || !payload) {
        throw new Error("Could not read LinkedIn metadata. A basic draft was created from the URL.");
      }

      const professional = {
        ...emptyProfessional,
        current_company: payload.current_company ?? "",
        current_title: payload.current_title ?? "",
        full_name: payload.full_name ?? inferNameFromLinkedInUrl(linkedinUrl),
        headline: payload.headline ?? "",
        industry: payload.industry ?? "",
        linkedin_url: payload.linkedin_url ?? linkedinUrl,
        location: payload.location ?? "",
        profile_image_url: payload.profile_image_url ?? "",
      };
      const companies = professional.current_company
        ? [
            {
              ...emptyCompany,
              display_name: professional.current_company,
              industry: professional.industry,
              name: professional.current_company,
            },
          ]
        : [];
      const links =
        companies.length > 0
          ? [
              {
                company_index: 0,
                department: "",
                is_primary: true,
                professional_index: 0,
                relationship_type: "employee",
                title: professional.current_title,
              },
            ]
          : [];

      await showReview({ companies, links, professionals: [professional] });
    } catch (error) {
      const fallback = {
        companies: [],
        links: [],
        professionals: [
          {
            ...emptyProfessional,
            full_name: inferNameFromLinkedInUrl(linkedinUrl),
            linkedin_url: linkedinUrl,
          },
        ],
      };
      setMessage(error instanceof Error ? error.message : "Basic draft created.");
      await showReview(fallback);
    } finally {
      setIsLoading(false);
    }
  }

  async function createManualDraft() {
    const professional = draft.professionals[0] ?? emptyProfessional;
    const company = draft.companies[0] ?? emptyCompany;
    const nextDraft: SmartDraft = {
      companies: manualType === "professional" ? [] : [company],
      links:
        manualType === "both"
          ? [
              {
                company_index: 0,
                department: "",
                is_primary: true,
                professional_index: 0,
                relationship_type: "employee",
                title: professional.current_title,
              },
            ]
          : [],
      professionals: manualType === "company" ? [] : [professional],
    };

    const error = validateDraft(nextDraft);
    if (error) {
      setMessage(error);
      return;
    }

    await showReview(nextDraft);
  }

  async function showReview(nextDraft: SmartDraft) {
    setDraft(nextDraft);
    setIsLoading(true);
    try {
      const response = await fetch("/api/network/smart-entry", {
        body: JSON.stringify({ action: "review", draft: nextDraft }),
        headers: { "Content-Type": "application/json", ...(await getVerifiedAuthHeaders()) },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as ReviewResponse | null;
      setReview(payload?.review ?? null);
      setStep("review");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveEverything() {
    setMessage("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/network/smart-entry", {
        body: JSON.stringify({ action: "save", draft }),
        headers: { "Content-Type": "application/json", ...(await getVerifiedAuthHeaders()) },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; result?: SaveResult }
        | null;

      if (response.status === 401) {
        setSaveAfterSignIn(true);
        setIsSignInOpen(true);
        setMessage("Sign in with a verified email to save Smart Entry results.");
        return;
      }

      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error || "Smart Entry could not be saved.");
      }

      setSuccess(payload.result);
      setStep("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Smart Entry could not be saved.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="px-5 py-10 sm:px-8 lg:px-10">
      {isSignInOpen && (
        <EmailOTPLoginModal
          onClose={() => {
            setIsSignInOpen(false);
            setSaveAfterSignIn(false);
          }}
          onSignedIn={() => {
            setIsSignInOpen(false);
            if (saveAfterSignIn) {
              setSaveAfterSignIn(false);
              window.setTimeout(() => void saveEverything(), 0);
            }
          }}
        />
      )}

      <div className="mx-auto max-w-6xl">
        <Link className="text-sm font-semibold text-[#0A66C2]" href="/network">
          Back to Network
        </Link>
        <div className="mt-8 rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Network Smart Entry
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[#191919]">Add to Network</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666]">
            Capture a professional, company, or both from one simple entry.
          </p>

          {message && (
            <p className="mt-5 rounded-lg border border-[#D9DDE3] bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-[#444444]">
              {message}
            </p>
          )}

          {step === "entry" && (
            <div className="mt-8 grid gap-5 lg:grid-cols-[320px_1fr]">
              <div className="grid gap-3">
                <ModeButton active={mode === "linkedin"} label="Paste LinkedIn URL" onClick={() => setMode("linkedin")} />
                <ModeButton active={mode === "pdf"} disabled label="Upload LinkedIn PDF" onClick={() => setMode("pdf")} />
                <ModeButton active={mode === "card"} disabled label="Upload Business Card" onClick={() => setMode("card")} />
                <ModeButton active={mode === "manual"} label="Add Manually" onClick={() => setMode("manual")} />
              </div>

              <div className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-5">
                {mode === "linkedin" && (
                  <div className="grid gap-4">
                    <h2 className="text-2xl font-semibold text-[#191919]">Paste LinkedIn URL</h2>
                    <p className="text-sm leading-6 text-[#666666]">
                      INConnect uses only public metadata when available and falls back to the profile slug.
                    </p>
                    <input
                      className="h-12 rounded-lg border border-[#D9DDE3] px-3 text-sm outline-none focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                      onChange={(event) => setLinkedinUrl(event.target.value)}
                      placeholder="https://www.linkedin.com/in/name/"
                      value={linkedinUrl}
                    />
                    <PrimaryButton disabled={isLoading} onClick={createLinkedInDraft}>
                      {isLoading ? "Reading..." : "Create Draft"}
                    </PrimaryButton>
                  </div>
                )}

                {(mode === "pdf" || mode === "card") && (
                  <div className="rounded-lg border border-dashed border-[#A7B3C2] bg-white p-6 text-center">
                    <h2 className="text-2xl font-semibold text-[#191919]">Coming soon</h2>
                    <p className="mt-3 text-sm leading-6 text-[#666666]">
                      Upload extraction will plug into this same review workflow when ready.
                    </p>
                  </div>
                )}

                {mode === "manual" && (
                  <ManualEntry
                    draft={draft}
                    manualType={manualType}
                    onContinue={createManualDraft}
                    onDraftChange={setDraft}
                    onManualTypeChange={setManualType}
                  />
                )}
              </div>
            </div>
          )}

          {step === "review" && (
            <ReviewScreen
              draft={draft}
              isLoading={isLoading}
              onBack={() => setStep("entry")}
              onDraftChange={setDraft}
              onSave={saveEverything}
              review={review}
            />
          )}

          {step === "success" && success && (
            <SuccessScreen
              onAddAnother={() => {
                setDraft({ companies: [], links: [], professionals: [] });
                setReview(null);
                setStep("entry");
                setSuccess(null);
              }}
              result={success}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function ManualEntry({
  draft,
  manualType,
  onContinue,
  onDraftChange,
  onManualTypeChange,
}: {
  draft: SmartDraft;
  manualType: ManualType;
  onContinue: () => void;
  onDraftChange: (draft: SmartDraft) => void;
  onManualTypeChange: (type: ManualType) => void;
}) {
  const professional = draft.professionals[0] ?? emptyProfessional;
  const company = draft.companies[0] ?? emptyCompany;

  function setProfessional(next: ProfessionalDraft) {
    onDraftChange({ ...draft, professionals: [next] });
  }

  function setCompany(next: CompanyDraft) {
    onDraftChange({ ...draft, companies: [next] });
  }

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-2xl font-semibold text-[#191919]">Add Manually</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["both", "Professional + Company"],
            ["professional", "Professional only"],
            ["company", "Company only"],
          ].map(([value, label]) => (
            <button
              className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                manualType === value
                  ? "border-[#0A66C2] bg-[#E8F1FB] text-[#0A66C2]"
                  : "border-[#D9DDE3] bg-white text-[#444444] hover:border-[#0A66C2]/40"
              }`}
              key={value}
              onClick={() => onManualTypeChange(value as ManualType)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {manualType !== "company" && (
        <DraftPanel title="Professional">
          <Field label="Full name *" onChange={(value) => setProfessional({ ...professional, full_name: value })} value={professional.full_name} />
          <Field label="LinkedIn URL" onChange={(value) => setProfessional({ ...professional, linkedin_url: value })} value={professional.linkedin_url} />
          <Field label="Email" onChange={(value) => setProfessional({ ...professional, professional_email: value })} value={professional.professional_email} />
          <Field label="Headline" onChange={(value) => setProfessional({ ...professional, headline: value })} value={professional.headline} />
          <Field label="Title" onChange={(value) => setProfessional({ ...professional, current_title: value })} value={professional.current_title} />
          <Field label="Company" onChange={(value) => setProfessional({ ...professional, current_company: value })} value={professional.current_company} />
          <Field label="Location" onChange={(value) => setProfessional({ ...professional, location: value })} value={professional.location} />
          <Field label="Industry" onChange={(value) => setProfessional({ ...professional, industry: value })} value={professional.industry} />
          <TextArea label="Notes" onChange={(value) => setProfessional({ ...professional, notes: value })} value={professional.notes} />
        </DraftPanel>
      )}

      {manualType !== "professional" && (
        <DraftPanel title="Company">
          <Field label="Company name *" onChange={(value) => setCompany({ ...company, display_name: value, name: value })} value={company.display_name} />
          <SelectField label="Company type" onChange={(value) => setCompany({ ...company, company_type: value })} options={companyTypes} value={company.company_type} />
          <Field label="Industry" onChange={(value) => setCompany({ ...company, industry: value })} value={company.industry} />
          <Field label="Country" onChange={(value) => setCompany({ ...company, country_name: value })} value={company.country_name} />
          <Field label="City" onChange={(value) => setCompany({ ...company, city: value })} value={company.city} />
          <Field label="Website" onChange={(value) => setCompany({ ...company, website: value })} value={company.website} />
          <Field label="LinkedIn URL" onChange={(value) => setCompany({ ...company, linkedin_url: value })} value={company.linkedin_url} />
          <TextArea label="Description" onChange={(value) => setCompany({ ...company, description: value })} value={company.description} />
          <TextArea label="Notes" onChange={(value) => setCompany({ ...company, notes: value })} value={company.notes} />
        </DraftPanel>
      )}

      <PrimaryButton onClick={onContinue}>Review Draft</PrimaryButton>
    </div>
  );
}

function ReviewScreen({
  draft,
  isLoading,
  onBack,
  onDraftChange,
  onSave,
  review,
}: {
  draft: SmartDraft;
  isLoading: boolean;
  onBack: () => void;
  onDraftChange: (draft: SmartDraft) => void;
  onSave: () => void;
  review: ReviewResponse["review"] | null;
}) {
  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold text-[#191919]">I found:</h2>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ReviewColumn title="Professionals">
          {draft.professionals.length === 0 && <EmptyReview text="No professionals in this draft." />}
          {draft.professionals.map((professional, index) => {
            const duplicate = review?.professionals.find((item) => item.index === index)?.duplicate;
            return (
              <ReviewCard key={index}>
                <Field
                  label="Full name"
                  onChange={(value) => updateProfessional(draft, index, { full_name: value }, onDraftChange)}
                  value={professional.full_name}
                />
                <Field
                  label="Title"
                  onChange={(value) => updateProfessional(draft, index, { current_title: value }, onDraftChange)}
                  value={professional.current_title}
                />
                <Field
                  label="LinkedIn URL"
                  onChange={(value) => updateProfessional(draft, index, { linkedin_url: value }, onDraftChange)}
                  value={professional.linkedin_url}
                />
                <Field
                  label="Email"
                  onChange={(value) => updateProfessional(draft, index, { professional_email: value }, onDraftChange)}
                  value={professional.professional_email}
                />
                {duplicate && (
                  <p className="rounded-lg border border-[#F5C542]/40 bg-[#FFF8E1] px-3 py-2 text-sm font-semibold text-[#7A5A00]">
                    Existing private professional found: {duplicate.display_name || "professional"}. Saving will update it.
                  </p>
                )}
              </ReviewCard>
            );
          })}
        </ReviewColumn>

        <ReviewColumn title="Companies">
          {draft.companies.length === 0 && <EmptyReview text="No companies in this draft." />}
          {draft.companies.map((company, index) => {
            const duplicates = review?.companies.find((item) => item.index === index)?.duplicates;
            return (
              <ReviewCard key={index}>
                <Field
                  label="Company name"
                  onChange={(value) => updateCompany(draft, index, { display_name: value, name: value }, onDraftChange)}
                  value={company.display_name}
                />
                <SelectField
                  label="Company type"
                  onChange={(value) => updateCompany(draft, index, { company_type: value }, onDraftChange)}
                  options={companyTypes}
                  value={company.company_type}
                />
                <Field
                  label="Industry"
                  onChange={(value) => updateCompany(draft, index, { industry: value }, onDraftChange)}
                  value={company.industry}
                />
                <Field
                  label="Country"
                  onChange={(value) => updateCompany(draft, index, { country_name: value }, onDraftChange)}
                  value={company.country_name}
                />
                {duplicates && (duplicates.exactDuplicate || duplicates.possibleDuplicates.length > 0) && (
                  <CompanyDuplicateChooser
                    duplicates={duplicates}
                    onSelect={(id) => updateCompany(draft, index, { use_existing_company_id: id }, onDraftChange)}
                    selectedId={company.use_existing_company_id ?? ""}
                  />
                )}
              </ReviewCard>
            );
          })}
        </ReviewColumn>
      </div>

      <ReviewColumn title="Relationships">
        {draft.links.length === 0 ? (
          <EmptyReview text="No relationships in this draft." />
        ) : (
          draft.links.map((link, index) => (
            <ReviewCard key={index}>
              <Field
                label="Title"
                onChange={(value) => {
                  const links = [...draft.links];
                  links[index] = { ...link, title: value };
                  onDraftChange({ ...draft, links });
                }}
                value={link.title}
              />
              <Field
                label="Relationship type"
                onChange={(value) => {
                  const links = [...draft.links];
                  links[index] = { ...link, relationship_type: value };
                  onDraftChange({ ...draft, links });
                }}
                value={link.relationship_type}
              />
            </ReviewCard>
          ))
        )}
      </ReviewColumn>

      <div className="mt-6 flex flex-wrap gap-3">
        <PrimaryButton disabled={isLoading} onClick={onSave}>
          {isLoading ? "Saving..." : "Save Everything"}
        </PrimaryButton>
        <button
          className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#E8F1FB]"
          onClick={onBack}
          type="button"
        >
          Edit
        </button>
        <Link
          className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#666666] transition hover:border-[#0A66C2] hover:text-[#0A66C2]"
          href="/network"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}

function CompanyDuplicateChooser({
  duplicates,
  onSelect,
  selectedId,
}: {
  duplicates: NonNullable<ReviewResponse["review"]>["companies"][number]["duplicates"];
  onSelect: (id: string) => void;
  selectedId: string;
}) {
  const options = [duplicates.exactDuplicate, ...duplicates.possibleDuplicates].filter(Boolean) as Duplicate[];
  return (
    <div className="rounded-lg border border-[#F5C542]/40 bg-[#FFF8E1] p-3">
      <p className="text-sm font-semibold text-[#191919]">Possible duplicate company found.</p>
      <div className="mt-3 grid gap-2">
        {options.map((duplicate) => (
          <label className="flex gap-2 text-sm text-[#444444]" key={duplicate.id}>
            <input
              checked={selectedId === duplicate.id}
              onChange={() => onSelect(duplicate.id)}
              type="radio"
            />
            Use existing: {duplicate.displayName} ({duplicate.matchReason})
          </label>
        ))}
        <label className="flex gap-2 text-sm text-[#444444]">
          <input checked={!selectedId} onChange={() => onSelect("")} type="radio" />
          Create new company
        </label>
      </div>
    </div>
  );
}

function SuccessScreen({
  onAddAnother,
  result,
}: {
  onAddAnother: () => void;
  result: SaveResult;
}) {
  return (
    <div className="mt-8 rounded-lg border border-[#057642]/20 bg-[#F1F8F4] p-6">
      <h2 className="text-2xl font-semibold text-[#191919]">Saved to your network.</h2>
      <ul className="mt-4 grid gap-2 text-sm font-semibold text-[#444444]">
        <li>Created or updated: {result.professionals.length} professionals</li>
        <li>Created or selected: {result.companies.length} companies</li>
        <li>Created or updated: {result.links.length} relationships</li>
      </ul>
      <div className="mt-5 flex flex-wrap gap-3">
        {result.professionals[0] && (
          <Link
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#0A66C2]/30 bg-white px-5 text-sm font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB]"
            href={result.professionals[0].url}
          >
            View Professional
          </Link>
        )}
        {result.companies[0] && (
          <Link
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#0A66C2]/30 bg-white px-5 text-sm font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB]"
            href={result.companies[0].url}
          >
            View Company
          </Link>
        )}
        <button
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
          onClick={onAddAnother}
          type="button"
        >
          Add Another
        </button>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-lg border px-4 py-4 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-[#F8F8F6] disabled:text-[#888888] ${
        active
          ? "border-[#0A66C2] bg-[#E8F1FB] text-[#0A66C2]"
          : "border-[#D9DDE3] bg-white text-[#444444] hover:border-[#0A66C2]/40"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
      {disabled && <span className="mt-1 block text-xs font-semibold">Coming soon</span>}
    </button>
  );
}

function DraftPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-[#D9DDE3] bg-white p-4">
      <h3 className="text-lg font-semibold text-[#191919]">{title}</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function ReviewColumn({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="mt-5 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
      <h3 className="text-lg font-semibold text-[#191919]">{title}</h3>
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

function ReviewCard({ children }: { children: ReactNode }) {
  return <article className="grid gap-4 rounded-lg border border-[#D9DDE3] bg-white p-4">{children}</article>;
}

function EmptyReview({ text }: { text: string }) {
  return <p className="text-sm leading-6 text-[#666666]">{text}</p>;
}

function Field({
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
        className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none focus:border-[#0A66C2]"
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
  options: string[];
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#191919]">
      {label}
      <select
        className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none focus:border-[#0A66C2]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#191919] md:col-span-2">
      {label}
      <textarea
        className="min-h-24 rounded-lg border border-[#D9DDE3] px-3 py-3 text-sm font-normal leading-6 outline-none focus:border-[#0A66C2]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function updateProfessional(
  draft: SmartDraft,
  index: number,
  patch: Partial<ProfessionalDraft>,
  onDraftChange: (draft: SmartDraft) => void,
) {
  const professionals = [...draft.professionals];
  professionals[index] = { ...professionals[index], ...patch };
  onDraftChange({ ...draft, professionals });
}

function updateCompany(
  draft: SmartDraft,
  index: number,
  patch: Partial<CompanyDraft>,
  onDraftChange: (draft: SmartDraft) => void,
) {
  const companies = [...draft.companies];
  companies[index] = { ...companies[index], ...patch };
  onDraftChange({ ...draft, companies });
}

function validateDraft(draft: SmartDraft) {
  for (const professional of draft.professionals) {
    if (!professional.full_name.trim()) return "Professional full name is required.";
  }
  for (const company of draft.companies) {
    if (!company.display_name.trim() && !company.name.trim()) return "Company name is required.";
  }
  return "";
}

function inferNameFromLinkedInUrl(value: string) {
  const match = value.match(/linkedin\.[a-z.]+\/in\/([^/?#]+)/i);
  const slug = decodeURIComponent(match?.[1] ?? "").replace(/[^a-zA-Z0-9-]/g, "");
  if (!slug) return "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
