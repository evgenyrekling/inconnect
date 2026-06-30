"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { EmailOTPLoginModal } from "@/components/email-otp-login-modal";
import { getVerifiedAuthHeaders } from "@/lib/auth-client";

type Step = "entry" | "review" | "success";

type SmartDraft = {
  companies: CompanyDraft[];
  links: LinkDraft[];
  professionals: ProfessionalDraft[];
  relationships?: LinkDraft[];
};

type ProfessionalDraft = {
  confidence?: number;
  current_company: string;
  current_title: string;
  education_summary: string;
  experience_summary: string;
  full_name: string;
  headline: string;
  industry: string;
  linkedin_url: string;
  location: string;
  notes: string;
  phone: string;
  professional_email: string;
  profile_image_url: string;
  skills: string[];
};

type CompanyDraft = {
  city: string;
  company_type: string;
  confidence?: number;
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
  confidence?: number;
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

const emptyDraft: SmartDraft = {
  companies: [],
  links: [],
  professionals: [],
};

const emptyProfessional: ProfessionalDraft = {
  current_company: "",
  current_title: "",
  education_summary: "",
  experience_summary: "",
  full_name: "",
  headline: "",
  industry: "",
  linkedin_url: "",
  location: "",
  notes: "",
  phone: "",
  professional_email: "",
  profile_image_url: "",
  skills: [],
};

const emptyCompany: CompanyDraft = {
  city: "",
  company_type: "Other",
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
  const documentInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<SmartDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<ReviewResponse["review"] | null>(null);
  const [saveAfterSignIn, setSaveAfterSignIn] = useState(false);
  const [step, setStep] = useState<Step>("entry");
  const [success, setSuccess] = useState<SaveResult | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  async function analyzeInput() {
    setError("");
    setMessage("");
    setSuccess(null);

    if (!text.trim() && !url.trim() && !file) {
      setError("Paste text, add a URL, or upload a file first.");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      if (text.trim()) formData.append("text", text.trim());
      if (url.trim()) formData.append("url", url.trim());
      if (file) formData.append("file", file);

      const response = await fetch("/api/network/smart-entry/analyze", {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { draft?: SmartDraft; error?: string; summary?: { companies: number; professionals: number; relationships: number } }
        | null;

      if (!response.ok || !payload?.draft) {
        throw new Error(payload?.error || "Smart Entry analysis failed.");
      }

      const nextDraft = normalizeClientDraft(payload.draft);
      if (
        nextDraft.companies.length === 0 &&
        nextDraft.professionals.length === 0 &&
        nextDraft.links.length === 0
      ) {
        throw new Error("INConnect could not detect companies, professionals, or relationships. Try adding more context.");
      }

      await showReview(nextDraft);
      setMessage(
        `INConnect found ${nextDraft.companies.length} companies, ${nextDraft.professionals.length} professionals, and ${nextDraft.links.length} relationships.`,
      );
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Smart Entry analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function showReview(nextDraft: SmartDraft) {
    setDraft(nextDraft);
    try {
      const response = await fetch("/api/network/smart-entry", {
        body: JSON.stringify({ action: "review", draft: nextDraft }),
        headers: { "Content-Type": "application/json", ...(await getVerifiedAuthHeaders()) },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as ReviewResponse | null;
      setReview(payload?.review ?? null);
    } finally {
      setStep("review");
    }
  }

  async function saveEverything() {
    setError("");
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
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Smart Entry could not be saved.");
    } finally {
      setIsLoading(false);
    }
  }

  function resetEntry() {
    setDraft(emptyDraft);
    setError("");
    setFile(null);
    setMessage("");
    setReview(null);
    setStep("entry");
    setSuccess(null);
    setText("");
    setUrl("");
    if (documentInputRef.current) documentInputRef.current.value = "";
    if (photoInputRef.current) photoInputRef.current.value = "";
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
        <div className="mt-8 rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Network Smart Entry
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[#191919]">Add to Network</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666]">
            Upload or paste anything. INConnect will detect companies, professionals, and relationships automatically.
          </p>

          {message && (
            <p className="mt-5 rounded-lg border border-[#057642]/20 bg-[#F1F8F4] px-4 py-3 text-sm font-semibold text-[#057642]">
              {message}
            </p>
          )}
          {error && (
            <p className="mt-5 rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] px-4 py-3 text-sm font-semibold text-[#B24020]">
              {error}
            </p>
          )}

          {step === "entry" && (
            <div className="mt-8 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                    Paste text or LinkedIn URL
                    <textarea
                      className="min-h-52 rounded-lg border border-[#D9DDE3] bg-white px-4 py-4 text-base font-normal leading-7 outline-none focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                      onChange={(event) => setText(event.target.value)}
                      placeholder="Paste a LinkedIn URL, email signature, copied profile text, company website text, meeting notes, or anything useful."
                      value={text}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                    URL
                    <input
                      className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-4 text-sm font-normal outline-none focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="https://www.linkedin.com/in/name or https://company.com"
                      value={url}
                    />
                  </label>
                </div>

                <aside className="grid gap-4">
                  <UploadBox
                    description="PDF, TXT, LinkedIn PDF export, screenshots, or copied documents."
                    inputRef={documentInputRef}
                    label="Upload file"
                    onChange={setFile}
                  />
                  <UploadBox
                    accept="image/*"
                    capture="environment"
                    description="Take or upload a business card, badge, profile screenshot, or meeting photo."
                    inputRef={photoInputRef}
                    label="Take/upload photo"
                    onChange={setFile}
                  />
                  {file && (
                    <p className="rounded-lg border border-[#D9DDE3] bg-white px-3 py-2 text-xs font-semibold text-[#444444]">
                      Selected: {file.name}
                    </p>
                  )}
                </aside>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <PrimaryButton disabled={isLoading} onClick={analyzeInput}>
                  {isLoading ? "Analyzing..." : "Analyze and Add to Network"}
                </PrimaryButton>
                <p className="text-xs font-semibold leading-5 text-[#666666]">
                  Companies are public. Professionals are private to your account.
                </p>
              </div>
            </div>
          )}

          {step === "review" && (
            <ReviewScreen
              draft={draft}
              isLoading={isLoading}
              onAnalyzeAnother={resetEntry}
              onDraftChange={setDraft}
              onSave={saveEverything}
              review={review}
            />
          )}

          {step === "success" && success && <SuccessScreen onAddAnother={resetEntry} result={success} />}
        </div>
      </div>
    </section>
  );
}

function UploadBox({
  accept = ".pdf,.txt,image/jpeg,image/png,image/webp",
  capture,
  description,
  inputRef,
  label,
  onChange,
}: {
  accept?: string;
  capture?: "environment";
  description: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="grid cursor-pointer gap-2 rounded-lg border border-dashed border-[#B8C7DA] bg-white p-4 text-sm font-semibold text-[#191919] transition hover:border-[#0A66C2] hover:bg-[#F3F7FD]">
      {label}
      <span className="text-xs font-normal leading-5 text-[#666666]">{description}</span>
      <input
        accept={accept}
        capture={capture}
        className="mt-1 text-xs"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        ref={inputRef}
        type="file"
      />
    </label>
  );
}

function ReviewScreen({
  draft,
  isLoading,
  onAnalyzeAnother,
  onDraftChange,
  onSave,
  review,
}: {
  draft: SmartDraft;
  isLoading: boolean;
  onAnalyzeAnother: () => void;
  onDraftChange: (draft: SmartDraft) => void;
  onSave: () => void;
  review: ReviewResponse["review"] | null;
}) {
  return (
    <div className="mt-8">
      <div className="rounded-lg border border-[#D9DDE3] bg-[#F8FAFC] p-4">
        <h2 className="text-2xl font-semibold text-[#191919]">INConnect found:</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <CountCard label="companies" value={draft.companies.length} />
          <CountCard label="professionals" value={draft.professionals.length} />
          <CountCard label="relationships" value={draft.links.length} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ReviewColumn title="Companies">
          {draft.companies.length === 0 && <EmptyReview text="No companies detected." />}
          {draft.companies.map((company, index) => {
            const duplicates = review?.companies.find((item) => item.index === index)?.duplicates;
            return (
              <ReviewCard key={index}>
                <ReviewBadge label={getCompanyDuplicateLabel(duplicates)} />
                <Field label="Company name" onChange={(value) => updateCompany(draft, index, { display_name: value, name: value }, onDraftChange)} value={company.display_name} />
                <SelectField label="Type" onChange={(value) => updateCompany(draft, index, { company_type: value }, onDraftChange)} options={companyTypes} value={company.company_type} />
                <Field label="Industry" onChange={(value) => updateCompany(draft, index, { industry: value }, onDraftChange)} value={company.industry} />
                <Field label="Country" onChange={(value) => updateCompany(draft, index, { country_name: value }, onDraftChange)} value={company.country_name} />
                <Field label="City" onChange={(value) => updateCompany(draft, index, { city: value }, onDraftChange)} value={company.city} />
                <Field label="Website" onChange={(value) => updateCompany(draft, index, { website: value }, onDraftChange)} value={company.website} />
                <Field label="LinkedIn" onChange={(value) => updateCompany(draft, index, { linkedin_url: value }, onDraftChange)} value={company.linkedin_url} />
                <TextArea label="Description" onChange={(value) => updateCompany(draft, index, { description: value }, onDraftChange)} value={company.description} />
                <TextArea label="Notes" onChange={(value) => updateCompany(draft, index, { notes: value }, onDraftChange)} value={company.notes} />
                {duplicates && (duplicates.exactDuplicate || duplicates.possibleDuplicates.length > 0) && (
                  <CompanyDuplicateChooser
                    duplicates={duplicates}
                    onSelect={(id) => updateCompany(draft, index, { use_existing_company_id: id }, onDraftChange)}
                    selectedId={company.use_existing_company_id || duplicates.exactDuplicate?.id || ""}
                  />
                )}
              </ReviewCard>
            );
          })}
        </ReviewColumn>

        <ReviewColumn title="Professionals">
          {draft.professionals.length === 0 && <EmptyReview text="No professionals detected." />}
          {draft.professionals.map((professional, index) => {
            const duplicate = review?.professionals.find((item) => item.index === index)?.duplicate;
            return (
              <ReviewCard key={index}>
                <ReviewBadge label={duplicate ? "Existing private contact" : "Private to you"} />
                <Field label="Name" onChange={(value) => updateProfessional(draft, index, { full_name: value }, onDraftChange)} value={professional.full_name} />
                <Field label="Title" onChange={(value) => updateProfessional(draft, index, { current_title: value }, onDraftChange)} value={professional.current_title} />
                <Field label="Company" onChange={(value) => updateProfessional(draft, index, { current_company: value }, onDraftChange)} value={professional.current_company} />
                <Field label="Email" onChange={(value) => updateProfessional(draft, index, { professional_email: value }, onDraftChange)} value={professional.professional_email} />
                <Field label="Phone" onChange={(value) => updateProfessional(draft, index, { phone: value }, onDraftChange)} value={professional.phone} />
                <Field label="LinkedIn" onChange={(value) => updateProfessional(draft, index, { linkedin_url: value }, onDraftChange)} value={professional.linkedin_url} />
                <Field label="Location" onChange={(value) => updateProfessional(draft, index, { location: value }, onDraftChange)} value={professional.location} />
                <Field label="Industry" onChange={(value) => updateProfessional(draft, index, { industry: value }, onDraftChange)} value={professional.industry} />
                <TextArea label="Headline" onChange={(value) => updateProfessional(draft, index, { headline: value }, onDraftChange)} value={professional.headline} />
                <TextArea label="Notes" onChange={(value) => updateProfessional(draft, index, { notes: value }, onDraftChange)} value={professional.notes} />
              </ReviewCard>
            );
          })}
        </ReviewColumn>
      </div>

      <ReviewColumn title="Relationships">
        {draft.links.length === 0 ? (
          <EmptyReview text="No relationships detected." />
        ) : (
          draft.links.map((link, index) => (
            <ReviewCard key={index}>
              <p className="text-sm font-semibold text-[#191919]">
                {draft.professionals[link.professional_index]?.full_name || "Professional"} to{" "}
                {draft.companies[link.company_index]?.display_name || "Company"}
              </p>
              <Field label="Role / title" onChange={(value) => updateLink(draft, index, { title: value }, onDraftChange)} value={link.title} />
              <Field label="Department" onChange={(value) => updateLink(draft, index, { department: value }, onDraftChange)} value={link.department} />
              <Field label="Relationship type" onChange={(value) => updateLink(draft, index, { relationship_type: value }, onDraftChange)} value={link.relationship_type} />
            </ReviewCard>
          ))
        )}
      </ReviewColumn>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <PrimaryButton disabled={isLoading} onClick={onSave}>
          {isLoading ? "Saving..." : "Save Everything"}
        </PrimaryButton>
        <button
          className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#E8F1FB]"
          onClick={onAnalyzeAnother}
          type="button"
        >
          Analyze Another
        </button>
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
    <div className="rounded-lg border border-[#F5C542]/40 bg-[#FFF8E1] p-3 md:col-span-2">
      <p className="text-sm font-semibold text-[#191919]">Duplicate status</p>
      <div className="mt-3 grid gap-2">
        {options.map((duplicate) => (
          <label className="flex gap-2 text-sm text-[#444444]" key={duplicate.id}>
            <input checked={selectedId === duplicate.id} onChange={() => onSelect(duplicate.id)} type="radio" />
            Existing company: {duplicate.displayName} ({duplicate.matchReason})
          </label>
        ))}
        <label className="flex gap-2 text-sm text-[#444444]">
          <input checked={!selectedId} onChange={() => onSelect("")} type="radio" />
          New company
        </label>
      </div>
    </div>
  );
}

function SuccessScreen({ onAddAnother, result }: { onAddAnother: () => void; result: SaveResult }) {
  return (
    <div className="mt-8 rounded-lg border border-[#057642]/20 bg-[#F1F8F4] p-6">
      <h2 className="text-2xl font-semibold text-[#191919]">Saved to your network.</h2>
      <ul className="mt-4 grid gap-2 text-sm font-semibold text-[#444444]">
        <li>Created/updated: {result.companies.length} public companies</li>
        <li>Created/updated: {result.professionals.length} private professionals</li>
        <li>Created/updated: {result.links.length} relationships</li>
      </ul>
      <div className="mt-5 flex flex-wrap gap-3">
        {result.companies[0] && <ActionLink href={result.companies[0].url}>View Company</ActionLink>}
        {result.professionals[0] && <ActionLink href={result.professionals[0].url}>View Professional</ActionLink>}
        <button className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]" onClick={onAddAnother} type="button">
          Add Another
        </button>
      </div>
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#D9DDE3] bg-white p-4">
      <p className="text-3xl font-semibold text-[#0A66C2]">{value}</p>
      <p className="mt-1 text-sm font-semibold text-[#666666]">{label}</p>
    </div>
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
  return <article className="grid gap-4 rounded-lg border border-[#D9DDE3] bg-white p-4 md:grid-cols-2">{children}</article>;
}

function ReviewBadge({ label }: { label: string }) {
  return <p className="rounded-full bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2] md:col-span-2">{label}</p>;
}

function EmptyReview({ text }: { text: string }) {
  return <p className="text-sm leading-6 text-[#666666]">{text}</p>;
}

function Field({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#191919]">
      {label}
      <input className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none focus:border-[#0A66C2]" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#191919]">
      {label}
      <select className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none focus:border-[#0A66C2]" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#191919] md:col-span-2">
      {label}
      <textarea className="min-h-24 rounded-lg border border-[#D9DDE3] px-3 py-3 text-sm font-normal leading-6 outline-none focus:border-[#0A66C2]" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function PrimaryButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button className="inline-flex h-12 items-center justify-center rounded-lg bg-[#4A6FD0] px-6 text-sm font-semibold text-white transition hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3]" disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function ActionLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link className="inline-flex h-11 items-center justify-center rounded-lg border border-[#0A66C2]/30 bg-white px-5 text-sm font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB]" href={href}>
      {children}
    </Link>
  );
}

function updateProfessional(draft: SmartDraft, index: number, patch: Partial<ProfessionalDraft>, onDraftChange: (draft: SmartDraft) => void) {
  const professionals = [...draft.professionals];
  professionals[index] = { ...professionals[index], ...patch };
  onDraftChange({ ...draft, professionals });
}

function updateCompany(draft: SmartDraft, index: number, patch: Partial<CompanyDraft>, onDraftChange: (draft: SmartDraft) => void) {
  const companies = [...draft.companies];
  companies[index] = { ...companies[index], ...patch };
  onDraftChange({ ...draft, companies });
}

function updateLink(draft: SmartDraft, index: number, patch: Partial<LinkDraft>, onDraftChange: (draft: SmartDraft) => void) {
  const links = [...draft.links];
  links[index] = { ...links[index], ...patch };
  onDraftChange({ ...draft, links, relationships: links });
}

function normalizeClientDraft(draft: SmartDraft): SmartDraft {
  const links = draft.links ?? draft.relationships ?? [];
  return {
    companies: (draft.companies ?? []).map((company) => ({
      ...emptyCompany,
      ...company,
      display_name: company.display_name || company.name || "",
      name: company.name || company.display_name || "",
    })),
    links: links.map((link) => ({
      company_index: Number.isFinite(link.company_index) ? link.company_index : 0,
      confidence: normalizeConfidence(link.confidence),
      department: link.department ?? "",
      is_primary: Boolean(link.is_primary),
      professional_index: Number.isFinite(link.professional_index) ? link.professional_index : 0,
      relationship_type: link.relationship_type || "employee",
      title: link.title ?? "",
    })),
    professionals: (draft.professionals ?? []).map((professional) => ({
      ...emptyProfessional,
      ...professional,
      confidence: normalizeConfidence(professional.confidence),
      skills: Array.isArray(professional.skills) ? professional.skills : [],
    })),
  };
}

function getCompanyDuplicateLabel(duplicates?: NonNullable<ReviewResponse["review"]>["companies"][number]["duplicates"]) {
  if (duplicates?.exactDuplicate) return "Existing company";
  if (duplicates?.possibleDuplicates.length) return "Possible duplicate";
  return "New company";
}

function normalizeConfidence(value: unknown) {
  const confidence = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(1, confidence));
}
