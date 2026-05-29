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
import { FormEvent, type ReactNode, useRef, useState } from "react";
import {
  getPositioningLevel,
  type ProfileIntelligenceAssessment,
} from "@/lib/authority-analysis";
import { Logo } from "@/components/Logo";

type ShareStatus = "idle" | "sharing" | "success" | "error";

const LINKEDIN_FEED_URL = "https://www.linkedin.com/feed/";
const SCORE_IMAGE_FILENAME = "inconnect-linkedin-authority-score.png";

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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function compactLabel(value: string, max = 48) {
  const clean = value.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  return clean.length > max ? `${clean.slice(0, max - 3).trim()}...` : clean;
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
  if (profilePdf.type && profilePdf.type !== "application/pdf") {
    return "Please upload a PDF file.";
  }
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
  error,
  isAnalyzing,
  onSubmit,
}: {
  error: string;
  isAnalyzing: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [email, setEmail] = useState("");
  const [profilePdf, setProfilePdf] = useState<File | null>(null);
  const validationError = getAssessmentError({ email, linkedinUrl, profilePdf });

  return (
    <form
      className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7"
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

      {(error || validationError) && (
        <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium leading-6 text-red-700">
          {error || validationError}
        </p>
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

      <PlanLimits />

      <button
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 font-semibold text-white transition hover:bg-[#004182] disabled:cursor-not-allowed disabled:bg-[#D9DDE3] disabled:text-[#666666]"
        disabled={isAnalyzing || Boolean(validationError)}
        type="submit"
      >
        {isAnalyzing ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isAnalyzing ? "Analyzing profile PDF..." : "Start Profile Intelligence Assessment"}
      </button>
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

function AssessmentResults({
  assessment,
}: {
  assessment: ProfileIntelligenceAssessment;
}) {
  return (
    <div className="grid gap-6">
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
            {assessment.diagnostics.extractedCharacterCount} | Pages:{" "}
            {assessment.diagnostics.detectedPageCount}
          </p>
          <p className="mt-3 font-semibold text-[#191919]">First 500 extracted characters</p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-[#D9DDE3] bg-[#F3F2EF] p-3 font-sans text-[11px] leading-5 text-[#666666]">
            {assessment.diagnostics.firstExtractedCharacters}
          </pre>
        </section>
      )}

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
                {getPositioningLevel(assessment.totalScore)}
              </span>
            </div>
            <p className="mt-4 max-w-3xl text-base leading-7 text-white/75">
              {assessment.confidenceReason}
            </p>
            <p className="mt-4 text-xl font-semibold">
              {assessment.corePositioning}
            </p>
          </div>
        </div>
      </section>

      <ShareableResults assessment={assessment} />

      <InfoSection
        eyebrow="Profile clarity"
        title="How Your Profile Is Currently Positioned"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            ["External reader view", assessment.profileClarity.externalReaderView],
            ["Professional image", assessment.profileClarity.professionalImage],
            ["Positioning clarity", assessment.profileClarity.positioningClarity],
            ["Positioning focus", assessment.profileClarity.positioningFocus],
          ].map(([label, text]) => (
            <article className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4" key={label}>
              <h3 className="font-semibold text-[#191919]">{label}</h3>
              <p className="mt-2 text-sm leading-6 text-[#666666]">{text}</p>
            </article>
          ))}
        </div>
      </InfoSection>

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
    </div>
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
    ["Headline Improvements", rec.headlineImprovements],
    ["About Section Improvements", rec.aboutSectionImprovements],
    ["Positioning Improvements", rec.positioningImprovements],
    ["Missing Authority Signals", rec.missingAuthoritySignals],
    ["Missing Keywords", rec.missingKeywords],
    ["Missing Industry Themes", rec.missingIndustryThemes],
  ] as const;

  return (
    <InfoSection eyebrow="Profile recommendations" title="How To Improve Your Profile">
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
          <h3 className="font-semibold">Current Headline</h3>
          <p className="mt-2 text-sm leading-6 text-[#666666]">{rec.currentHeadline}</p>
        </article>
        <article className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4">
          <h3 className="font-semibold">Suggested Headline</h3>
          <p className="mt-2 text-sm leading-6 text-[#191919]">{rec.suggestedHeadline}</p>
        </article>
        <article className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
          <h3 className="font-semibold">Current Positioning</h3>
          <p className="mt-2 text-sm leading-6 text-[#666666]">{rec.currentPositioning}</p>
        </article>
        <article className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4">
          <h3 className="font-semibold">Recommended Positioning</h3>
          <p className="mt-2 text-sm leading-6 text-[#191919]">{rec.recommendedPositioning}</p>
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
                  {getPositioningLevel(assessment.totalScore)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
              Core Positioning
            </p>
            <p className="mt-2 text-lg font-semibold">
              {compactLabel(assessment.corePositioning, 68)}
            </p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ShareList title="Key Expertise Areas" items={assessment.keyExpertiseDomains.slice(0, 3)} />
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
  title,
}: {
  id: string;
  items: string[];
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
            <LockKeyhole className="mx-auto h-6 w-6 text-[#0A66C2]" />
            <p className="mt-3 font-semibold text-[#191919]">
              Unlock {title} with Pro
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
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
      return;
    }

    setError("");
    setAssessment(null);
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze-profile", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      const errorMessage =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "";

      if (!response.ok || !payload || errorMessage) {
        throw new Error(errorMessage || "Profile assessment failed.");
      }

      setAssessment(payload as ProfileIntelligenceAssessment);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Profile assessment failed.",
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
          <AssessmentForm
            error={error}
            isAnalyzing={isAnalyzing}
            onSubmit={handleAssessmentSubmit}
          />
          {isAnalyzing && <LoadingAssessment />}
          {assessment && <AssessmentResults assessment={assessment} />}
        </div>
      </section>
      <LockedPreview
        id="trend-radar"
        title="Trend Radar"
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
        items={[
          "Personalized Post Ideas",
          "Content Pillars",
          "Weekly Topic Suggestions",
          "Authority Building Opportunities",
          "LinkedIn Content Roadmap",
        ]}
      />
      <Footer />
    </main>
  );
}
