"use client";

import {
  BadgeCheck,
  Check,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Zap,
} from "lucide-react";
import { toPng } from "html-to-image";
import { FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  getPositioningLevel,
  type ProfileIntelligenceAssessment,
} from "@/lib/authority-analysis";
import { Logo } from "@/components/Logo";

type ShareStatus = "idle" | "sharing" | "success" | "error";
type AssessmentDiagnostic = {
  stage: string;
  error: string;
  details: string;
};
type AssessmentDebug = {
  failedStage?: string;
  pdfUpload: "PENDING" | "SUCCESS" | "FAILED";
  pdfExtraction: "PENDING" | "SUCCESS" | "FAILED";
  extractedCharacters?: number;
  openAIRequest: "PENDING" | "SUCCESS" | "FAILED";
  supabaseInsert: "PENDING" | "SUCCESS" | "FAILED";
  actualError?: string;
  storageDiagnostic?: AssessmentDiagnostic;
};
type LimitState = {
  latestAssessment: ProfileIntelligenceAssessment | null;
  message: string;
};
type StoredReturningIdentity = {
  userKey: string;
  email: string;
  linkedinUrl: string;
  latestAssessmentId?: string;
};
type AssessmentHistoryEntry = {
  id: string;
  createdAt: string;
  totalScore: number | null;
};
type ReturningUserProfile = {
  hasPreviousAssessment: true;
  user: {
    userKey: string;
    email: string;
    linkedinUrl: string;
    planType: "admin" | "free" | "pro" | string;
    isAdmin: boolean;
  };
  latestAssessment: ProfileIntelligenceAssessment;
  selectedAssessment?: ProfileIntelligenceAssessment;
  latestAssessmentId: string;
  latestAssessmentDate: string;
  history: AssessmentHistoryEntry[];
  authorityTrend: {
    scores: number[];
    delta: number;
    message: string;
  };
  canRunNewAssessment: boolean;
  nextFreeAssessmentDate: string;
};

const LINKEDIN_FEED_URL = "https://www.linkedin.com/feed/";
const SCORE_IMAGE_FILENAME = "inconnect-linkedin-authority-score.png";
const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;
const RETURNING_USER_STORAGE_KEY = "inconnect:returning-user";

const navItems = [
  { label: "Assessment", href: "#assessment" },
  { label: "Trend Radar", href: "#trend-radar" },
  { label: "Content Intelligence", href: "#content-intelligence" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function readStoredReturningIdentity(): StoredReturningIdentity | null {
  try {
    const raw = window.localStorage.getItem(RETURNING_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isStoredReturningIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeReturningIdentity(identity: StoredReturningIdentity) {
  try {
    window.localStorage.setItem(RETURNING_USER_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // localStorage can be unavailable in private browsing or embedded contexts.
  }
}

function isStoredReturningIdentity(value: unknown): value is StoredReturningIdentity {
  return (
    typeof value === "object" &&
    value !== null &&
    "userKey" in value &&
    typeof value.userKey === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    "linkedinUrl" in value &&
    typeof value.linkedinUrl === "string"
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function compactLabel(value: string, max = 48) {
  const clean = value.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  return clean.length > max ? `${clean.slice(0, max - 3).trim()}...` : clean;
}

function formatDisplayDate(value?: string) {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getFirstName(assessment: ProfileIntelligenceAssessment) {
  const name = assessment.profileSnapshot?.name?.trim();
  if (!name || /^not clearly/i.test(name)) return "";
  return name.split(/\s+/)[0] ?? "";
}

function getAssessmentError({
  email,
  linkedinUrl,
  profilePdf,
}: {
  email: string;
  linkedinUrl: string;
  profilePdf: File | null;
}) {
  if (!linkedinUrl.trim()) return "LinkedIn profile URL is required.";
  if (!email.trim() || !isValidEmail(email)) return "A valid email address is required.";
  if (!profilePdf) return "LinkedIn Profile PDF is required.";
  const isPdfUpload =
    profilePdf.type === "application/pdf" ||
    profilePdf.type === "application/octet-stream" ||
    profilePdf.name.toLowerCase().endsWith(".pdf") ||
    !profilePdf.type;

  if (!isPdfUpload) {
    return "Please upload a PDF file.";
  }
  if (profilePdf.size > MAX_PDF_SIZE_BYTES) return "PDF file size must be 5 MB or less.";
  return "";
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back for browsers that require a focused document.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function isAssessmentDebug(value: unknown): value is AssessmentDebug {
  return (
    typeof value === "object" &&
    value !== null &&
    "pdfUpload" in value &&
    "pdfExtraction" in value &&
    "openAIRequest" in value &&
    "supabaseInsert" in value
  );
}

function isAssessmentDiagnostic(value: unknown): value is AssessmentDiagnostic {
  return (
    typeof value === "object" &&
    value !== null &&
    "stage" in value &&
    typeof value.stage === "string" &&
    "error" in value &&
    typeof value.error === "string" &&
    "details" in value &&
    typeof value.details === "string"
  );
}

function isReturningUserProfile(value: unknown): value is ReturningUserProfile {
  return (
    typeof value === "object" &&
    value !== null &&
    "hasPreviousAssessment" in value &&
    value.hasPreviousAssessment === true &&
    "user" in value &&
    typeof value.user === "object" &&
    value.user !== null &&
    "latestAssessment" in value &&
    typeof value.latestAssessment === "object" &&
    value.latestAssessment !== null &&
    "latestAssessmentId" in value &&
    typeof value.latestAssessmentId === "string" &&
    "history" in value &&
    Array.isArray(value.history) &&
    "authorityTrend" in value &&
    typeof value.authorityTrend === "object" &&
    value.authorityTrend !== null
  );
}

function ScoreRing({ score }: { score: number }) {
  const degrees = Math.round((score / 100) * 360);

  return (
    <div
      aria-label={`LinkedIn Authority Score ${score} out of 100`}
      className="score-reveal grid h-40 w-40 place-items-center rounded-full p-2 shadow-[0_16px_34px_rgba(10,25,47,0.16)]"
      style={{
        background: `conic-gradient(#0A66C2 0deg ${degrees}deg, #D9DDE3 ${degrees}deg 360deg)`,
      }}
    >
      <div className="grid h-full w-full place-items-center rounded-full border border-[#D9DDE3] bg-white text-center">
        <div>
          <span className="block text-5xl font-semibold tracking-normal text-[#191919]">
            {score}
          </span>
          <span className="text-xs font-semibold uppercase text-[#0A66C2]">
            / 100
          </span>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#D9DDE3] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
        <a href="#assessment" aria-label="INConnect assessment">
          <Logo markSize={46} />
        </a>
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <a
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#666666] transition hover:bg-[#E8F1FB] hover:text-[#0A66C2]"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      <nav className="flex gap-2 overflow-x-auto border-t border-[#D9DDE3] px-5 py-2 lg:hidden">
        {navItems.map((item) => (
          <a
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-[#666666]"
            href={item.href}
            key={item.label}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function AssessmentForm({
  debug,
  error,
  initialIdentity,
  isAnalyzing,
  limitState,
  onUpgrade,
  onViewLatest,
  onSubmit,
}: {
  debug: AssessmentDebug | null;
  error: string;
  initialIdentity: StoredReturningIdentity | null;
  isAnalyzing: boolean;
  limitState: LimitState | null;
  onUpgrade: () => void;
  onViewLatest: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [email, setEmail] = useState("");
  const [profilePdf, setProfilePdf] = useState<File | null>(null);
  const validationError = getAssessmentError({ email, linkedinUrl, profilePdf });
  const isDevelopment = process.env.NODE_ENV === "development";
  const storageDiagnostic = debug?.storageDiagnostic;
  const isSubmitDisabled = isAnalyzing || Boolean(validationError);
  const submitLabel = isAnalyzing
    ? "Analyzing Profile..."
    : isSubmitDisabled
      ? "Upload your LinkedIn Profile PDF to continue"
      : "Start Assessment";

  useEffect(() => {
    if (!initialIdentity) return;
    setEmail((current) => current || initialIdentity.email);
    setLinkedinUrl((current) => current || initialIdentity.linkedinUrl);
  }, [initialIdentity]);

  return (
    <form
      className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7"
      id="assessment-form"
      onSubmit={onSubmit}
    >
      <input name="linkedinUrl" type="hidden" value={linkedinUrl} />
      <input name="email" type="hidden" value={email} />
      <div className="border-b border-[#D9DDE3] pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Profile Intelligence Assessment
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#191919] sm:text-5xl">
          Your AI LinkedIn Profile Intelligence Platform
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666]">
          Upload your LinkedIn Profile PDF and receive a comprehensive authority,
          positioning, visibility, and profile-improvement assessment.
        </p>
      </div>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-[#191919]">
          LinkedIn profile URL
          <input
            className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
            onChange={(event) => setLinkedinUrl(event.target.value)}
            placeholder="https://www.linkedin.com/in/your-profile"
            required
            type="url"
            value={linkedinUrl}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#191919]">
          Email address
          <input
            className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
            type="email"
            value={email}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#191919]">
          LinkedIn Profile PDF
          <span className="flex min-h-28 cursor-pointer items-center gap-4 rounded-lg border border-dashed border-[#0A66C2]/35 bg-[#E8F1FB] p-4 text-[#191919] transition hover:border-[#0A66C2]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-[#0A66C2]">
              <Upload className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold">
                {profilePdf ? profilePdf.name : "Upload LinkedIn Profile PDF"}
              </span>
              <span className="mt-1 block text-sm font-normal text-[#666666]">
                Assessment cannot run without the exported PDF.
              </span>
            </span>
          </span>
          <input
            accept="application/pdf"
            className="sr-only"
            name="profilePdf"
            onChange={(event) => setProfilePdf(event.target.files?.[0] ?? null)}
            required
            type="file"
          />
        </label>
      </div>

      <button
        className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-5 py-3 text-center text-sm font-semibold leading-5 text-white shadow-[0_12px_28px_rgba(10,102,194,0.24)] transition hover:bg-[#004182] disabled:cursor-not-allowed disabled:bg-[#D9DDE3] disabled:text-[#666666] disabled:shadow-none sm:text-base"
        disabled={isSubmitDisabled}
        type="submit"
      >
        {isAnalyzing ? (
          <LoaderCircle className="h-5 w-5 animate-spin" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
        {submitLabel}
      </button>

      {(error || validationError) && (
        <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium leading-6 text-red-700">
          {error || validationError}
        </p>
      )}

      {isDevelopment && debug && (
        <section className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
          <h2 className="font-semibold text-red-900">Assessment Storage Diagnostics</h2>
          {storageDiagnostic && (
            <div className="mt-3 grid gap-3">
              <div>
                <p className="font-semibold text-red-900">Storage stage:</p>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap rounded-md border border-red-200 bg-white p-3 font-mono text-xs text-red-800">
                  {storageDiagnostic.stage}
                </pre>
              </div>
              <div>
                <p className="font-semibold text-red-900">Error:</p>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap rounded-md border border-red-200 bg-white p-3 font-mono text-xs text-red-800">
                  {storageDiagnostic.error}
                </pre>
              </div>
              <div>
                <p className="font-semibold text-red-900">Details:</p>
                <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap rounded-md border border-red-200 bg-white p-3 font-mono text-xs text-red-800">
                  {storageDiagnostic.details || "No additional details returned."}
                </pre>
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-1 font-mono text-xs">
            <p>Failed Stage: {debug.failedStage || "Unknown"}</p>
            <p>PDF Upload: {debug.pdfUpload}</p>
            <p>PDF Extraction: {debug.pdfExtraction}</p>
            <p>Extracted Characters: {debug.extractedCharacters ?? "N/A"}</p>
            <p>OpenAI Request: {debug.openAIRequest}</p>
            <p>Supabase Insert: {debug.supabaseInsert}</p>
          </div>
          {debug.actualError && (
            <>
              <p className="mt-3 font-semibold text-red-900">Actual Error:</p>
              <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-md border border-red-200 bg-white p-3 font-mono text-xs text-red-800">
                {debug.actualError}
              </pre>
            </>
          )}
        </section>
      )}

      {limitState && (
        <section className="mt-5 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4 text-sm leading-6 text-[#191919]">
          <h2 className="font-semibold">Free weekly assessment used</h2>
          <p className="mt-2 text-[#666666]">{limitState.message}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0A66C2] px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#D9DDE3] disabled:text-[#666666]"
              disabled={!limitState.latestAssessment}
              onClick={onViewLatest}
              type="button"
            >
              View Latest Assessment
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#0A66C2] bg-white px-4 font-semibold text-[#0A66C2]"
              onClick={onUpgrade}
              type="button"
            >
              Upgrade to Pro
            </button>
          </div>
        </section>
      )}

      <div className="mt-6 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
        <div className="flex items-start gap-3">
          <FileText className="mt-1 h-5 w-5 shrink-0 text-[#0A66C2]" />
          <div>
            <h2 className="font-semibold text-[#191919]">
              How to get your LinkedIn Profile PDF
            </h2>
            <ol className="mt-3 grid gap-2 text-sm leading-6 text-[#666666]">
              <li>1. Open LinkedIn on desktop</li>
              <li>2. Go to your profile</li>
              <li>3. Click More or Resources</li>
              <li>4. Select Save to PDF</li>
              <li>5. Upload the PDF here</li>
            </ol>
            <p className="mt-3 text-sm leading-6 text-[#666666]">
              LinkedIn Profile PDF export is only available on desktop and may
              not be available for all LinkedIn users.
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#191919]">
              For a reliable assessment, INConnect analyzes your LinkedIn
              profile PDF instead of scraping LinkedIn.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

function PlanLimits() {
  return (
    <section className="mt-6" id="pricing">
      <p className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4 text-sm leading-6 text-[#191919]">
        Your free plan includes one comprehensive LinkedIn profile assessment
        per week. Upgrade to Pro for unlimited assessments, Trend Radar, and
        Content Intelligence.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PlanCard
          name="FREE PLAN"
          items={[
            "1 comprehensive profile assessment per week",
            "Full profile intelligence assessment",
            "Authority score",
            "Positioning analysis",
            "Profile improvement recommendations",
            "Shareable authority score card",
          ]}
        />
        <PlanCard
          featured
          name="PRO PLAN"
          items={[
            "Unlimited profile assessments",
            "Trend Radar",
            "Content Intelligence",
            "Authority growth tracking",
            "Advanced positioning insights",
            "Weekly content roadmap",
          ]}
        />
      </div>
    </section>
  );
}

function PlanCard({
  featured,
  items,
  name,
}: {
  featured?: boolean;
  items: string[];
  name: string;
}) {
  return (
    <article
      className={classNames(
        "rounded-lg border p-4",
        featured ? "border-[#0A66C2]/35 bg-[#E8F1FB]" : "border-[#D9DDE3] bg-white",
      )}
    >
      <h3 className="font-semibold text-[#191919]">{name}</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#666666]">
        {items.map((item) => (
          <li className="flex gap-2" key={item}>
            <Check className="mt-1 h-4 w-4 shrink-0 text-[#057642]" />
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

function LoadingAssessment() {
  const steps = [
    "Extracting LinkedIn Profile PDF text",
    "Reading headline, About, experience, skills, and keywords",
    "Scoring authority, positioning, and visibility",
    "Preparing profile improvement recommendations",
  ];

  return (
    <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
        AI profile intelligence
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-[#191919]">
        INConnect is analyzing your LinkedIn Profile PDF...
      </h2>
      <div className="mt-6 grid gap-3">
        {steps.map((step) => (
          <div
            className="scanner-active flex items-center gap-3 rounded-lg border border-[#0A66C2]/25 bg-[#E8F1FB] p-4 text-sm font-semibold text-[#191919]"
            key={step}
          >
            <LoaderCircle className="h-4 w-4 animate-spin text-[#0A66C2]" />
            {step}
          </div>
        ))}
      </div>
    </section>
  );
}

function WelcomeBackSection({
  activeAssessmentId,
  isLoading,
  limitMessage,
  onOpenAssessment,
  onRunNew,
  onUpgrade,
  onViewLatest,
  profile,
}: {
  activeAssessmentId?: string;
  isLoading: boolean;
  limitMessage: string;
  onOpenAssessment: (assessmentId: string) => void;
  onRunNew: () => void;
  onUpgrade: () => void;
  onViewLatest: () => void;
  profile: ReturningUserProfile;
}) {
  const latest = profile.latestAssessment;
  const firstName = getFirstName(latest);
  const trend = profile.authorityTrend.scores.join(" → ");

  return (
    <section className="grid gap-4">
      <article className="rounded-lg border border-[#0A66C2]/20 bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
              Returning profile
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              Welcome back{firstName ? `, ${firstName}` : ""}.
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">
                  Latest assessment
                </p>
                <p className="mt-2 font-semibold">
                  {formatDisplayDate(profile.latestAssessmentDate)}
                </p>
              </div>
              <div className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">
                  LinkedIn Authority Score
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#0A66C2]">
                  {latest.totalScore}/100
                </p>
              </div>
              <div className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">
                  Plan
                </p>
                <p className="mt-2 font-semibold capitalize">{profile.user.planType}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 text-sm font-semibold text-white transition hover:bg-[#004182]"
              disabled={isLoading}
              onClick={onViewLatest}
              type="button"
            >
              <ExternalLink className="h-4 w-4" />
              View Latest Assessment
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#0A66C2] bg-white px-4 text-sm font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB]"
              disabled={isLoading}
              onClick={onRunNew}
              type="button"
            >
              <Sparkles className="h-4 w-4" />
              Run New Assessment
            </button>
          </div>
        </div>

        {limitMessage && (
          <div className="mt-5 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4 text-sm leading-6">
            <p className="font-semibold text-[#191919]">{limitMessage}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 font-semibold text-white"
                onClick={onViewLatest}
                type="button"
              >
                <ExternalLink className="h-4 w-4" />
                View Latest Assessment
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#0A66C2] bg-white px-4 font-semibold text-[#0A66C2]"
                onClick={onUpgrade}
                type="button"
              >
                <LockKeyhole className="h-4 w-4" />
                Upgrade to Pro
              </button>
            </div>
          </div>
        )}
      </article>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)]">
          <h2 className="font-semibold text-[#191919]">Recent Assessments</h2>
          <div className="mt-4 grid gap-2">
            {profile.history.map((entry) => (
              <button
                className={classNames(
                  "grid grid-cols-[1fr_auto] items-center gap-4 rounded-lg border p-3 text-left text-sm transition",
                  activeAssessmentId === entry.id
                    ? "border-[#0A66C2] bg-[#E8F1FB] text-[#191919]"
                    : "border-[#D9DDE3] bg-[#F8F8F6] text-[#666666] hover:border-[#0A66C2]",
                )}
                disabled={isLoading}
                key={entry.id}
                onClick={() => onOpenAssessment(entry.id)}
                type="button"
              >
                <span className="font-semibold">{formatDisplayDate(entry.createdAt)}</span>
                <span className="font-semibold text-[#0A66C2]">
                  {typeof entry.totalScore === "number" ? `${entry.totalScore}/100` : "N/A"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)]">
          <h2 className="font-semibold text-[#191919]">Authority Trend</h2>
          <p className="mt-4 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4 text-lg font-semibold text-[#0A66C2]">
            {trend || `${latest.totalScore}`}
          </p>
          <p className="mt-4 text-sm leading-6 text-[#666666]">
            {profile.authorityTrend.message}
          </p>
        </section>
      </div>
    </section>
  );
}

function AssessmentResults({
  assessment,
}: {
  assessment: ProfileIntelligenceAssessment;
}) {
  return (
    <div className="grid gap-6">
      {assessment.assessmentDate && (
        <section className="rounded-lg border border-[#D9DDE3] bg-white p-4 text-sm leading-6 text-[#666666] shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
          <span className="font-semibold text-[#191919]">Assessment date:</span>{" "}
          {formatDisplayDate(assessment.assessmentDate)}
        </section>
      )}

      {assessment.extractionStatus && (
        <section className="rounded-lg border border-[#057642]/20 bg-[#EEF7F2] p-4 text-sm leading-6 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#057642]" />
            <div>
              <p className="font-semibold">{assessment.extractionStatus.message}</p>
              {assessment.extractionStatus.warning && (
                <p className="mt-1 text-[#666666]">
                  {assessment.extractionStatus.warning}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {assessment.diagnostics && (
        <section className="rounded-lg border border-[#D9DDE3] bg-white p-4 text-xs leading-5 text-[#666666]">
          <p className="font-semibold text-[#191919]">Development diagnostics</p>
          <p className="mt-2">
            File: {assessment.diagnostics.fileName} | Size:{" "}
            {assessment.diagnostics.fileSize} bytes | Extracted characters:{" "}
            {assessment.diagnostics.characterCount} | Pages:{" "}
            {assessment.diagnostics.pageCount}
          </p>
          <p className="mt-3 font-semibold text-[#191919]">First 1000 extracted characters</p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-[#D9DDE3] bg-[#F3F2EF] p-3 font-sans text-[11px] leading-5 text-[#666666]">
            {assessment.diagnostics.first1000Characters}
          </pre>
        </section>
      )}

      <ProfileSnapshotSection assessment={assessment} />

      <InfoSection eyebrow="Market position" title="How The Market Sees You">
        <p className="text-xl font-semibold leading-8 text-[#191919]">
          {assessment.marketPosition}
        </p>
      </InfoSection>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <PositioningSnapshotSection assessment={assessment} />
        <InfoSection eyebrow="Differentiation" title="What Makes You Unique">
          <p className="text-base leading-7 text-[#666666]">
            {assessment.whatMakesYouUnique}
          </p>
        </InfoSection>
      </div>

      <section className="rounded-lg border border-[#0A66C2]/20 bg-[#0A192F] p-5 text-white shadow-[0_24px_70px_rgba(10,25,47,0.2)] sm:p-7">
        <div className="grid gap-7 lg:grid-cols-[auto_1fr] lg:items-center">
          <ScoreRing score={assessment.totalScore} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#78B7F4]">
              LinkedIn Authority Score
            </p>
            <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">
              {assessment.totalScore} / 100
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/12 bg-white/[0.07] px-3 py-2 text-xs font-semibold text-[#78B7F4]">
                {assessment.assessmentConfidence} confidence
              </span>
              <span className="rounded-lg border border-white/12 bg-white/[0.07] px-3 py-2 text-xs font-semibold text-white/80">
                {assessment.scoreLevel}
              </span>
            </div>
            <p className="mt-4 max-w-3xl text-base leading-7 text-white/75">
              {assessment.confidenceReason}
            </p>
            <p className="mt-3 max-w-3xl text-base leading-7 text-white/75">
              {assessment.scoreExplanation}
            </p>
            <p className="mt-4 text-xl font-semibold">
              {assessment.corePositioning}
            </p>
          </div>
        </div>
      </section>

      <AuthorityBreakdownSection assessment={assessment} />

      <PositioningGapSection assessment={assessment} />

      <InfoSection eyebrow="Competencies" title="Top Competencies">
        <TagGrid items={assessment.topCompetencies} />
      </InfoSection>

      <InfoSection eyebrow="Expertise" title="Key Expertise Domains">
        <TagGrid items={assessment.keyExpertiseDomains} />
      </InfoSection>

      <InfoSection eyebrow="Authority growth" title="Authority Growth Areas">
        <TagGrid items={assessment.authorityGrowthAreas} />
      </InfoSection>

      <ImprovementSection assessment={assessment} />

      <InfoSection eyebrow="Visibility gaps" title="What Is Missing">
        <div className="grid gap-3">
          {assessment.visibilityGaps.map((gap) => (
            <article
              className="flex gap-3 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-sm leading-6 text-[#666666]"
              key={gap}
            >
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#0A66C2]" />
              {gap}
            </article>
          ))}
        </div>
      </InfoSection>

      <ShareableResults assessment={assessment} />
    </div>
  );
}

function ProfileSnapshotSection({
  assessment,
}: {
  assessment: ProfileIntelligenceAssessment;
}) {
  const [accuracyFeedback, setAccuracyFeedback] = useState<"yes" | "needs-improvement" | null>(
    null,
  );
  const snapshot = assessment.profileSnapshot;
  const details = [
    ["Name", snapshot.name],
    ["Current role", snapshot.currentRole],
    ["Current company", snapshot.currentCompany],
    ["Location", snapshot.location],
    ["Estimated experience", snapshot.estimatedYearsOfExperience],
  ];

  return (
    <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
      <div className="flex flex-col gap-4 border-b border-[#D9DDE3] pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Profile intelligence
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Profile Snapshot</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#666666]">
            This is how INConnect currently understands your professional profile.
          </p>
        </div>
        <div className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] px-4 py-3 text-sm font-semibold text-[#0A66C2]">
          PDF-based understanding
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <article className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4" key={label}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">
                {label}
              </p>
              <p className="mt-2 font-semibold text-[#191919]">{value}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-4">
          <article className="rounded-lg border border-[#D9DDE3] bg-white p-4">
            <h3 className="font-semibold text-[#191919]">Top 5 skills</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {snapshot.topSkills.slice(0, 5).map((skill) => (
                <span
                  className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] px-3 py-2 text-xs font-semibold text-[#0A66C2]"
                  key={skill}
                >
                  {skill}
                </span>
              ))}
            </div>
          </article>
          <article className="rounded-lg border border-[#D9DDE3] bg-white p-4">
            <h3 className="font-semibold text-[#191919]">Top 3 industries</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {snapshot.topIndustries.slice(0, 3).map((industry) => (
                <span
                  className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-3 py-2 text-xs font-semibold text-[#191919]"
                  key={industry}
                >
                  {industry}
                </span>
              ))}
            </div>
          </article>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold text-[#191919]">Is this accurate?</p>
        <div className="flex gap-2">
          <button
            className={classNames(
              "inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition",
              accuracyFeedback === "yes"
                ? "border-[#057642] bg-[#EEF7F2] text-[#057642]"
                : "border-[#D9DDE3] bg-white text-[#191919] hover:border-[#057642]",
            )}
            onClick={() => setAccuracyFeedback("yes")}
            type="button"
          >
            Yes
          </button>
          <button
            className={classNames(
              "inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition",
              accuracyFeedback === "needs-improvement"
                ? "border-[#0A66C2] bg-[#E8F1FB] text-[#0A66C2]"
                : "border-[#D9DDE3] bg-white text-[#191919] hover:border-[#0A66C2]",
            )}
            onClick={() => setAccuracyFeedback("needs-improvement")}
            type="button"
          >
            Needs Improvement
          </button>
        </div>
      </div>
    </section>
  );
}

function PositioningSnapshotSection({
  assessment,
}: {
  assessment: ProfileIntelligenceAssessment;
}) {
  return (
    <InfoSection eyebrow="Positioning snapshot" title="Current Association Signals">
      <div className="grid gap-4">
        {assessment.positioningSnapshot.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-[#191919]">{item.label}</span>
              <span className="font-semibold text-[#0A66C2]">{item.percentage}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#D9DDE3]">
              <div
                className="h-full rounded-full bg-[#0A66C2]"
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </InfoSection>
  );
}

function AuthorityBreakdownSection({
  assessment,
}: {
  assessment: ProfileIntelligenceAssessment;
}) {
  return (
    <InfoSection eyebrow="Authority score framework" title="Authority Score Breakdown">
      <div className="grid gap-4 lg:grid-cols-2">
        {assessment.scoreBreakdown.map((item) => (
          <article className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4" key={item.category}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#191919]">{item.category}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#666666]">
                  Weight {item.weight}%
                </p>
              </div>
              <span className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] px-3 py-2 text-sm font-semibold text-[#0A66C2]">
                {item.score}/100
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#666666]">{item.explanation}</p>
            <p className="mt-3 rounded-lg border border-[#0A66C2]/20 bg-white p-3 text-sm leading-6 text-[#191919]">
              {item.improvementHint}
            </p>
          </article>
        ))}
      </div>
    </InfoSection>
  );
}

function PositioningGapSection({
  assessment,
}: {
  assessment: ProfileIntelligenceAssessment;
}) {
  const gap = assessment.positioningGap;

  return (
    <InfoSection eyebrow="Positioning opportunity" title="Positioning Gap">
      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
          <h3 className="font-semibold text-[#191919]">Current Position</h3>
          <p className="mt-2 text-sm leading-6 text-[#666666]">{gap.currentPosition}</p>
        </article>
        <article className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4">
          <h3 className="font-semibold text-[#191919]">Potential Position</h3>
          <p className="mt-2 text-sm leading-6 text-[#191919]">{gap.potentialPosition}</p>
        </article>
        <article className="rounded-lg border border-[#D9DDE3] bg-white p-4">
          <h3 className="font-semibold text-[#191919]">Gap Explanation</h3>
          <p className="mt-2 text-sm leading-6 text-[#666666]">{gap.gapExplanation}</p>
        </article>
      </div>
    </InfoSection>
  );
}

function InfoSection({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TagGrid({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4 text-sm font-semibold text-[#191919]"
          key={item}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function ImprovementSection({
  assessment,
}: {
  assessment: ProfileIntelligenceAssessment;
}) {
  const rec = assessment.profileImprovementRecommendations;
  const groups = [
    ["Keywords to Add", rec.keywordsToAdd],
    ["Authority Signals to Strengthen", rec.authoritySignalsToStrengthen],
    ["Missing Professional Themes", rec.missingProfessionalThemes],
  ] as const;

  return (
    <InfoSection eyebrow="Profile recommendations" title="How To Improve Your Profile">
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
          <h3 className="font-semibold">Headline Improvement</h3>
          <p className="mt-2 text-sm leading-6 text-[#666666]">{rec.headlineImprovement}</p>
        </article>
        <article className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4">
          <h3 className="font-semibold">About Section Improvement</h3>
          <p className="mt-2 text-sm leading-6 text-[#191919]">{rec.aboutSectionImprovement}</p>
        </article>
        <article className="rounded-lg border border-[#0A66C2]/20 bg-white p-4 lg:col-span-2">
          <h3 className="font-semibold">Suggested Positioning Angle</h3>
          <p className="mt-2 text-sm leading-6 text-[#191919]">{rec.suggestedPositioningAngle}</p>
        </article>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {groups.map(([title, items]) => (
          <article className="rounded-lg border border-[#D9DDE3] bg-white p-4" key={title}>
            <h3 className="font-semibold text-[#191919]">{title}</h3>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#666666]">
              {items.map((item) => (
                <li className="flex gap-2" key={item}>
                  <Target className="mt-1 h-4 w-4 shrink-0 text-[#0A66C2]" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </InfoSection>
  );
}

function ShareableResults({
  assessment,
}: {
  assessment: ProfileIntelligenceAssessment;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareMessage, setShareMessage] = useState("");

  function showToast(status: Exclude<ShareStatus, "idle" | "sharing">, message: string) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setShareStatus(status);
    setShareMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setShareStatus("idle");
      setShareMessage("");
    }, 4800);
  }

  async function handleShare() {
    const card = cardRef.current;
    if (!card) {
      showToast("error", "Could not download score card. Please try again.");
      return;
    }

    setShareStatus("sharing");
    const copied = await copyTextToClipboard(assessment.shareText);
    if (!copied) {
      showToast("error", "Could not copy text automatically. Please copy it manually.");
      return;
    }

    try {
      const imageUrl = await toPng(card, {
        backgroundColor: "#FFFFFF",
        cacheBust: true,
        pixelRatio: 2,
        style: { margin: "0" },
      });
      downloadDataUrl(imageUrl, SCORE_IMAGE_FILENAME);
    } catch (error) {
      console.error(error);
      showToast("error", "Could not download score card. Please try again.");
      return;
    }

    const linkedInTab = window.open(LINKEDIN_FEED_URL, "_blank", "noopener,noreferrer");
    showToast(
      linkedInTab ? "success" : "error",
      linkedInTab
        ? "Post text copied. Score card downloaded. Open LinkedIn and attach the image to your post."
        : "LinkedIn could not open automatically. Please open LinkedIn manually.",
    );
  }

  return (
    <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Shareable results
          </p>
          <h2 className="mt-3 text-2xl font-semibold">
            Share your authority score
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            Your post text will be copied automatically. Your score card image
            will be downloaded, please attach it manually to your LinkedIn post.
          </p>
          <button
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 font-semibold text-white transition hover:bg-[#004182] disabled:opacity-70 sm:w-auto"
            disabled={shareStatus === "sharing"}
            onClick={handleShare}
            type="button"
          >
            {shareStatus === "sharing" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Copy Text, Download Card & Open LinkedIn
          </button>
        </div>

        <div
          className="share-card rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_12px_34px_rgba(10,25,47,0.1)]"
          ref={cardRef}
        >
          <div className="flex items-center justify-between gap-4 border-b border-[#D9DDE3] pb-4">
            <Logo markSize={40} showSubtitle={false} />
            <span className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
              in-connect.app
            </span>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
            <ScoreRing score={assessment.totalScore} />
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[#666666]">
                LinkedIn Authority Score
              </p>
              <p className="mt-3 text-4xl font-semibold">
                {assessment.totalScore} / 100
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
                  {assessment.assessmentConfidence} confidence
                </span>
                <span className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-3 py-1 text-xs font-semibold text-[#666666]">
                  {assessment.scoreLevel}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
              Market Position
            </p>
            <p className="mt-2 text-lg font-semibold">
              {compactLabel(assessment.marketPosition, 110)}
            </p>
          </div>
          <div className="mt-4 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">
              Core Positioning
            </p>
            <p className="mt-2 font-semibold text-[#191919]">
              {compactLabel(assessment.corePositioning, 72)}
            </p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <ShareList title="Key Expertise Areas" items={assessment.keyExpertiseDomains.slice(0, 3)} />
            <ShareList title="Top Authority Areas" items={assessment.authorityGrowthAreas.slice(0, 3)} />
            <ShareList title="Positive Highlights" items={assessment.positiveHighlights.slice(0, 3)} />
          </div>
        </div>
      </div>

      {shareStatus !== "idle" && shareStatus !== "sharing" && (
        <div
          className={classNames(
            "fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border bg-white px-4 py-3 text-sm font-semibold shadow-[0_18px_48px_rgba(10,25,47,0.18)]",
            shareStatus === "success"
              ? "border-[#057642]/25 text-[#057642]"
              : "border-red-300 text-red-600",
          )}
          role="status"
        >
          {shareMessage}
        </div>
      )}
    </section>
  );
}

function ShareList({ items, title }: { items: string[]; title: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#191919]">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm text-[#666666]">
        {items.map((item) => (
          <li className="flex items-center gap-2" key={item}>
            <BadgeCheck className="h-4 w-4 shrink-0 text-[#057642]" />
            {compactLabel(item, 38)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LockedPreview({
  id,
  items,
  subtitle,
  title,
}: {
  id: string;
  items: string[];
  subtitle: string;
  title: string;
}) {
  return (
    <section
      className="relative overflow-hidden bg-[#F3F2EF] px-5 py-10 sm:px-8 lg:px-10"
      id={id}
    >
      <div className="mx-auto max-w-7xl rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
        <div className="pointer-events-none select-none blur-[2px]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Pro intelligence
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[#191919]">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#666666]">
            {subtitle}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {items.map((item) => (
              <article className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4" key={item}>
                <Radar className="h-5 w-5 text-[#0A66C2]" />
                <h3 className="mt-4 font-semibold text-[#191919]">{item}</h3>
              </article>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 grid place-items-center bg-white/55">
          <div className="rounded-lg border border-[#0A66C2]/20 bg-white px-5 py-4 text-center shadow-[0_18px_48px_rgba(10,25,47,0.14)]">
            <span aria-hidden="true" className="block text-2xl">
              🔒
            </span>
            <p className="mt-3 font-semibold text-[#191919]">
              Coming soon in Pro
            </p>
            <p className="mt-2 text-sm leading-6 text-[#666666]">
              Available in a future Pro release.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="border-t border-[#D9DDE3] bg-white px-5 py-8 text-[#666666] sm:px-8 lg:px-10"
      id="contact"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <Logo markSize={38} />
        <div className="flex flex-wrap gap-4 text-sm">
          <span>Copyright 2026 INConnect</span>
          <a href="#contact">Privacy</a>
          <a href="#contact">Terms</a>
          <a href="mailto:hello@in-connect.app">Contact</a>
        </div>
      </div>
    </footer>
  );
}

export function INConnectPlatform() {
  const [assessment, setAssessment] =
    useState<ProfileIntelligenceAssessment | null>(null);
  const [assessmentDebug, setAssessmentDebug] = useState<AssessmentDebug | null>(null);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [limitState, setLimitState] = useState<LimitState | null>(null);
  const [returningIdentity, setReturningIdentity] =
    useState<StoredReturningIdentity | null>(null);
  const [returningUser, setReturningUser] = useState<ReturningUserProfile | null>(null);
  const [returningUserLimitMessage, setReturningUserLimitMessage] = useState("");
  const [isLoadingReturningUser, setIsLoadingReturningUser] = useState(false);

  useEffect(() => {
    const storedIdentity = readStoredReturningIdentity();
    if (!storedIdentity?.userKey) return;
    setReturningIdentity(storedIdentity);
    void loadReturningUser(storedIdentity);
  }, []);

  async function loadReturningUser(
    identity: StoredReturningIdentity,
    options?: { assessmentId?: string; showSelectedAssessment?: boolean },
  ) {
    setIsLoadingReturningUser(true);
    try {
      const params = new URLSearchParams({ userKey: identity.userKey });
      if (options?.assessmentId) params.set("assessmentId", options.assessmentId);
      const response = await fetch(`/api/returning-user?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok || !isReturningUserProfile(payload)) {
        setReturningUser(null);
        return null;
      }

      setReturningUser(payload);
      const nextIdentity = {
        userKey: payload.user.userKey,
        email: payload.user.email || identity.email,
        linkedinUrl: payload.user.linkedinUrl || identity.linkedinUrl,
        latestAssessmentId: payload.latestAssessmentId,
      };
      setReturningIdentity(nextIdentity);
      storeReturningIdentity(nextIdentity);

      if (options?.showSelectedAssessment) {
        setAssessment(payload.selectedAssessment ?? payload.latestAssessment);
        setAssessmentDebug(null);
        setError("");
        setLimitState(null);
      }

      return payload;
    } catch (loadError) {
      console.error("Returning user lookup failed", loadError);
      setReturningUser(null);
      return null;
    } finally {
      setIsLoadingReturningUser(false);
    }
  }

  function handleViewLatestAssessment() {
    if (!returningUser?.latestAssessment) return;
    setAssessment(returningUser.latestAssessment);
    setAssessmentDebug(null);
    setError("");
    setLimitState(null);
    setReturningUserLimitMessage("");
  }

  async function handleOpenAssessment(assessmentId: string) {
    if (!returningIdentity) return;
    await loadReturningUser(returningIdentity, {
      assessmentId,
      showSelectedAssessment: true,
    });
    setReturningUserLimitMessage("");
  }

  function handleRunNewAssessment() {
    if (!returningUser) return;
    if (!returningUser.canRunNewAssessment) {
      setReturningUserLimitMessage(
        `You already used your free weekly assessment. Your next free assessment will be available on ${formatDisplayDate(
          returningUser.nextFreeAssessmentDate,
        )}.`,
      );
      return;
    }

    setReturningUserLimitMessage("");
    setAssessment(null);
    setAssessmentDebug(null);
    setError("");
    setLimitState(null);
    document.getElementById("assessment-form")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleUpgrade() {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleAssessmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const linkedinUrl = String(formData.get("linkedinUrl") ?? "");
    const email = String(formData.get("email") ?? "");
    const profilePdf = formData.get("profilePdf");
    const validationError = getAssessmentError({
      email,
      linkedinUrl,
      profilePdf: profilePdf instanceof File ? profilePdf : null,
    });

    if (validationError) {
      setError(validationError);
      setAssessmentDebug(null);
      setLimitState(null);
      setReturningUserLimitMessage("");
      return;
    }

    setError("");
    setAssessmentDebug(null);
    setLimitState(null);
    setAssessment(null);
    setReturningUserLimitMessage("");
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze-profile", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      const diagnostic =
        payload && typeof payload === "object" && isAssessmentDiagnostic(payload)
          ? payload
          : null;
      const parsedDebug =
        payload &&
        typeof payload === "object" &&
        "debug" in payload &&
        isAssessmentDebug(payload.debug)
          ? payload.debug
          : null;
      const debug =
        parsedDebug && diagnostic
          ? {
              ...parsedDebug,
              storageDiagnostic: parsedDebug.storageDiagnostic ?? diagnostic,
            }
          : parsedDebug;
      const limitExceeded =
        payload &&
        typeof payload === "object" &&
        "limitExceeded" in payload &&
        payload.limitExceeded === true;
      const latestAssessment =
        payload &&
        typeof payload === "object" &&
        "latestAssessment" in payload &&
        payload.latestAssessment &&
        typeof payload.latestAssessment === "object"
          ? (payload.latestAssessment as ProfileIntelligenceAssessment)
          : null;
      const nextFreeAssessmentDate =
        payload &&
        typeof payload === "object" &&
        "nextFreeAssessmentDate" in payload &&
        typeof payload.nextFreeAssessmentDate === "string"
          ? payload.nextFreeAssessmentDate
          : "";
      const errorMessage =
        payload &&
        typeof payload === "object" &&
        "userMessage" in payload &&
        typeof payload.userMessage === "string"
          ? payload.userMessage
          : payload &&
              typeof payload === "object" &&
              "error" in payload &&
              typeof payload.error === "string"
            ? payload.error
            : "";

      if (!response.ok || !payload || errorMessage) {
        setAssessmentDebug(debug);
        if (limitExceeded) {
          setLimitState({
            latestAssessment,
            message:
              errorMessage ||
              `You already used your free weekly assessment. Your next free assessment will be available on ${formatDisplayDate(
                nextFreeAssessmentDate,
              )}.`,
          });
        }
        throw new Error(errorMessage || "Assessment generation failed.");
      }

      setAssessmentDebug(null);
      setLimitState(null);
      const nextAssessment = payload as ProfileIntelligenceAssessment;
      setAssessment(nextAssessment);
      if (nextAssessment.userKey) {
        const nextIdentity = {
          userKey: nextAssessment.userKey,
          email,
          linkedinUrl,
          latestAssessmentId: nextAssessment.assessmentId,
        };
        setReturningIdentity(nextIdentity);
        storeReturningIdentity(nextIdentity);
        void loadReturningUser(nextIdentity);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Assessment generation failed.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <section className="px-5 py-8 sm:px-8 lg:px-10" id="assessment">
        <div className="mx-auto grid max-w-7xl gap-6">
          {returningUser && (
            <WelcomeBackSection
              activeAssessmentId={assessment?.assessmentId}
              isLoading={isLoadingReturningUser}
              limitMessage={returningUserLimitMessage}
              onOpenAssessment={handleOpenAssessment}
              onRunNew={handleRunNewAssessment}
              onUpgrade={handleUpgrade}
              onViewLatest={handleViewLatestAssessment}
              profile={returningUser}
            />
          )}
          <AssessmentForm
            debug={assessmentDebug}
            error={error}
            initialIdentity={returningIdentity}
            isAnalyzing={isAnalyzing}
            limitState={limitState}
            onUpgrade={handleUpgrade}
            onViewLatest={() => {
              const latestAssessment = limitState?.latestAssessment ?? returningUser?.latestAssessment;
              if (latestAssessment) {
                setAssessment(latestAssessment);
                setError("");
              }
            }}
            onSubmit={handleAssessmentSubmit}
          />
          {isAnalyzing && <LoadingAssessment />}
          {assessment && <AssessmentResults assessment={assessment} />}
        </div>
      </section>
      <LockedPreview
        id="trend-radar"
        title="Trend Radar"
        subtitle="Discover relevant industry trends matched to your positioning."
        items={[
          "Emerging Industry Trends",
          "Authority Opportunities",
          "Fast-Growing Topics",
          "Industry Momentum Signals",
        ]}
      />
      <LockedPreview
        id="content-intelligence"
        title="Content Intelligence"
        subtitle="Generate personalized LinkedIn content opportunities based on your profile and market position."
        items={[
          "Personalized Post Ideas",
          "Content Pillars",
          "Weekly Topic Suggestions",
          "Authority Building Opportunities",
          "LinkedIn Content Roadmap",
        ]}
      />
      <section className="bg-[#F3F2EF] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <PlanLimits />
          <div className="mt-5 rounded-lg border border-[#D9DDE3] bg-white p-4 text-sm leading-6 text-[#666666]">
            <p>
              We store your uploaded PDF and assessment result so you can track your
              LinkedIn authority over time.
            </p>
            <p className="mt-2 font-semibold text-[#191919]">
              We do not scrape LinkedIn and never post to LinkedIn automatically.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
