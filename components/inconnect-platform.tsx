"use client";

import {
  BadgeCheck,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Zap,
} from "lucide-react";
import {
  type DragEvent,
  FormEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getPositioningLevel,
  type ProfileIntelligenceAssessment,
} from "@/lib/authority-analysis";
import type { BlogPost } from "@/lib/blog-posts";
import { Logo } from "@/components/Logo";

type ShareStatus = "idle" | "saving" | "sharing" | "success" | "error";
type AssessmentDiagnostic = {
  stage: string;
  error: string;
  details: string;
};
type UserProfileDebug = {
  userFound: boolean;
  userCreated: boolean;
  userKeyUpdated: boolean;
  profileFound: boolean;
  profileCreated: boolean;
  profileUpdated: boolean;
  profileMergeCompleted: boolean;
  fieldsUpdated: string[];
};
type AssessmentDebug = {
  failedStage?: string;
  pdfUpload: "PENDING" | "SUCCESS" | "FAILED";
  pdfExtraction: "PENDING" | "SUCCESS" | "FAILED";
  extractedCharacters?: number;
  openAIRequest: "PENDING" | "SUCCESS" | "FAILED";
  supabaseInsert: "PENDING" | "SUCCESS" | "FAILED";
  actualError?: string;
  profile?: UserProfileDebug;
  storageDiagnostic?: AssessmentDiagnostic;
};
type LimitState = {
  latestAssessment: ProfileIntelligenceAssessment | null;
  message: string;
};
type StoredReturningIdentity = {
  userKey: string;
  name?: string;
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
    name?: string;
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
type HeadlineOption = {
  style: string;
  headline: string;
  score: number;
  reason: string;
  bestFor: string;
};
type HeadlineGeneratorResponse = {
  recommendedIndex: number;
  headlines: HeadlineOption[];
  profileDebug?: UserProfileDebug;
  userKey?: string;
};
type AboutOption = {
  style: string;
  aboutSection: string;
  bestUseCase: string;
  toneScore: number;
  whyThisWorks: string;
};
type AboutGeneratorResponse = {
  generationId?: string;
  recommendedIndex: number;
  versions: AboutOption[];
  profileDebug?: UserProfileDebug;
  userKey?: string;
};
type ArticleGeneratorResponse = {
  announcementPost: string;
  article: string;
  generationId?: string;
  hashtags: string[];
  headline: string;
  profileDebug?: UserProfileDebug;
  subtitle: string;
  userKey?: string;
};
type AboutStorageDiagnostic = {
  error: string;
  stage: string;
  supabaseMessage: string | null;
  supabaseDetails: string | null;
  supabaseHint: string | null;
  supabaseCode: string | null;
};
type HeadlineInputs = {
  roles: string[];
  industries: string[];
  expertise: string[];
  values: string[];
  perceptions: string[];
};
type AboutInputs = {
  roles: string[];
  industries: string[];
  expertise: string[];
  values: string[];
  identities: string[];
  writingStyles: string[];
  callsToAction: string[];
};
type HeadlineGenerationRecord = {
  name: string;
  email: string;
  inputs: HeadlineInputs;
  outputs: HeadlineGeneratorResponse;
  createdAt: string;
  futureSupabaseTable: "headline_generations";
};
type AboutGenerationRecord = {
  name: string;
  email: string;
  inputs: AboutInputs;
  outputs: AboutGeneratorResponse;
  createdAt: string;
  supabaseTable: "about_generations";
};
type ArticleAccessState = "checking" | "locked" | "admin";
type IntelligenceSubscriptionResponse = {
  alreadySubscribed: boolean;
  email: string;
  intelligenceType: string;
  message: string;
  userKey: string;
};

const LINKEDIN_FEED_URL = "https://www.linkedin.com/feed/";
const ASSESSMENT_IMAGE_FILENAME = "inconnect-profile-intelligence-assessment.png";
const ADSENSE_PUBLISHER_ID = "ca-pub-6306589054094473";
const ADS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ADS === "true";
const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;
const RETURNING_USER_STORAGE_KEY = "inconnect:returning-user";
const HEADLINE_GENERATIONS_STORAGE_KEY = "inconnect:headline-generations";
const ABOUT_GENERATIONS_STORAGE_KEY = "inconnect:about-generations";
const HEADLINE_SELECTION_LIMIT = 10;
const ARTICLE_TONES = [
  "Professional",
  "Thought leadership",
  "Technical",
  "Executive",
  "Educational",
  "Provocative",
  "Story-driven",
];
const PRIMARY_CTA_CLASS =
  "bg-[#4A6FD0] font-semibold text-[#FFFFFF] transition-colors duration-200 ease-[ease] hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3] disabled:text-[#666666] disabled:shadow-none";
const PRIMARY_CTA_SHADOW = "shadow-[0_12px_28px_rgba(74,111,208,0.24)]";

const navItems = [
  { label: "Assessment", href: "/assessment" },
  { label: "Headline Generator", href: "/headline-generator" },
  { label: "About Generator", href: "/about-generator" },
  { label: "Intelligence", href: "/intelligence" },
  { label: "Pricing", href: "/pricing" },
];

const roleOptions = [
  "Specialist",
  "Manager",
  "Director",
  "Executive",
  "Founder",
  "Entrepreneur",
  "Consultant",
  "Freelancer",
  "Student",
  "Creator",
  "Sales Professional",
  "Marketing Professional",
  "Engineer",
  "Product Manager",
  "Project Manager",
  "Business Developer",
  "Recruiter",
  "HR Professional",
  "Other",
];

const industryOptions = [
  "Technology",
  "AI",
  "SaaS",
  "Industrial Automation",
  "Manufacturing",
  "Logistics",
  "Airports",
  "Smart Mobility",
  "Transportation",
  "Healthcare",
  "Finance",
  "Real Estate",
  "Construction",
  "Energy",
  "Education",
  "Consulting",
  "Marketing",
  "Sales",
  "HR & Recruiting",
  "Hospitality",
  "Tourism",
  "Retail",
  "E-commerce",
  "Cybersecurity",
  "Data & Analytics",
  "Robotics",
  "Sustainability",
  "Other",
];

const expertiseOptions = [
  "Business Development",
  "Sales Leadership",
  "Market Development",
  "Strategic Partnerships",
  "Solution Selling",
  "Innovation",
  "Product Management",
  "Project Management",
  "Operations",
  "Team Leadership",
  "Digital Transformation",
  "Automation",
  "AI Strategy",
  "Data Analytics",
  "Customer Experience",
  "Revenue Growth",
  "Go-to-Market Strategy",
  "Brand Building",
  "Content Strategy",
  "Recruiting",
  "Engineering",
  "Software Development",
  "Process Improvement",
  "Change Management",
  "Other",
];

const businessValueOptions = [
  "Drive business growth",
  "Increase revenue",
  "Open new markets",
  "Enable automation",
  "Improve efficiency",
  "Reduce costs",
  "Improve safety",
  "Improve customer experience",
  "Build strategic partnerships",
  "Scale global business",
  "Accelerate digital transformation",
  "Launch new products",
  "Improve operations",
  "Build high-performing teams",
  "Strengthen brand authority",
  "Generate leads",
  "Improve decision-making",
  "Create innovation",
  "Other",
];

const perceptionOptions = [
  "Trusted Expert",
  "Industry Authority",
  "Innovator",
  "Strategic Thinker",
  "Business Builder",
  "Market Leader",
  "Connector of People and Ideas",
  "Technology Evangelist",
  "Thought Leader",
  "Visionary",
  "Problem Solver",
  "Growth Driver",
  "Customer Advocate",
  "Transformation Leader",
  "Technical Specialist",
  "Executive Leader",
  "Other",
];

const aboutRoleOptions = [
  "Specialist",
  "Manager",
  "Director",
  "Executive",
  "Founder",
  "Entrepreneur",
  "Consultant",
  "Freelancer",
  "Business Developer",
  "Sales Professional",
  "Engineer",
  "Product Manager",
  "Project Manager",
  "Marketing Professional",
  "Researcher",
  "Investor",
  "Advisor",
  "Other",
];

const aboutIndustryOptions = [
  "Technology",
  "AI",
  "SaaS",
  "Industrial Automation",
  "Manufacturing",
  "Logistics",
  "Airports",
  "Transportation",
  "Smart Mobility",
  "Rail",
  "Ports",
  "Construction",
  "Energy",
  "Healthcare",
  "Finance",
  "Consulting",
  "Cybersecurity",
  "Robotics",
  "Data Analytics",
  "Education",
  "Sustainability",
];

const aboutExpertiseOptions = [
  "Business Development",
  "Sales Leadership",
  "Market Development",
  "Strategic Partnerships",
  "Solution Selling",
  "Innovation",
  "Product Management",
  "Project Management",
  "Operations",
  "Leadership",
  "Team Building",
  "Automation",
  "Digital Transformation",
  "AI Strategy",
  "Engineering",
  "Marketing",
  "Revenue Growth",
  "Go-To-Market",
  "Customer Success",
  "Public Speaking",
];

const aboutBusinessValueOptions = [
  "Drive business growth",
  "Increase revenue",
  "Open new markets",
  "Enable automation",
  "Improve efficiency",
  "Reduce costs",
  "Improve safety",
  "Improve customer experience",
  "Scale operations",
  "Accelerate innovation",
  "Build partnerships",
  "Improve productivity",
  "Improve sustainability",
  "Strengthen brand authority",
  "Generate leads",
];

const aboutIdentityOptions = [
  "Industry Authority",
  "Trusted Expert",
  "Thought Leader",
  "Innovator",
  "Strategic Leader",
  "Visionary",
  "Problem Solver",
  "Connector",
  "Growth Driver",
  "Technical Expert",
  "Business Builder",
  "Change Maker",
];

const aboutWritingStyleOptions = [
  "Executive",
  "Professional",
  "Human",
  "Commercial",
  "Thought Leadership",
  "Technical",
  "Inspirational",
  "Founder Style",
  "Consultant Style",
];

const aboutCallToActionOptions = [
  "Connect with me",
  "Follow my content",
  "Contact me",
  "Explore partnerships",
  "Discuss opportunities",
  "Reach out for consulting",
  "Visit my website",
  "Book a meeting",
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

function clearReturningIdentity() {
  try {
    window.localStorage.removeItem(RETURNING_USER_STORAGE_KEY);
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

function getAssessmentDisplayName(assessment?: ProfileIntelligenceAssessment | null) {
  const name = assessment?.profileSnapshot?.name?.trim() ?? "";
  return name && !/^not clearly/i.test(name) ? name : "";
}

function getIdentityDisplayName(identity?: StoredReturningIdentity | null) {
  const name = identity?.name?.trim() ?? "";
  return name && !/^not clearly/i.test(name) ? name : "";
}

function getFirstNameFromDisplayName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

function getAssessmentError({
  email,
  hasProfileConsent,
  linkedinUrl,
  profilePdf,
}: {
  email: string;
  hasProfileConsent: boolean;
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
  if (!hasProfileConsent) {
    return "Consent is required before INConnect can store your profile information and assessment result.";
  }
  return "";
}

function ProfileConsentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-sm leading-6 text-[#666666]">
      <input
        checked={checked}
        className="mt-1 h-4 w-4 rounded border-[#D9DDE3] text-[#0A66C2] focus:ring-[#0A66C2]"
        onChange={(event) => onChange(event.target.checked)}
        required
        type="checkbox"
      />
      <span>
        <span className="font-semibold text-[#191919]">
          I agree that INConnect may store my profile information and tool
          results to provide assessments, recommendations, and personalized
          LinkedIn growth features.
        </span>
        <span className="mt-1 block">
          We store your profile data so INConnect can remember your results and
          improve future recommendations. You can request deletion anytime.
        </span>
      </span>
    </label>
  );
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

function waitForRenderFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
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

function isUserProfileDebug(value: unknown): value is UserProfileDebug {
  return (
    typeof value === "object" &&
    value !== null &&
    "userFound" in value &&
    typeof value.userFound === "boolean" &&
    "userCreated" in value &&
    typeof value.userCreated === "boolean" &&
    "userKeyUpdated" in value &&
    typeof value.userKeyUpdated === "boolean" &&
    "profileFound" in value &&
    typeof value.profileFound === "boolean" &&
    "profileCreated" in value &&
    typeof value.profileCreated === "boolean" &&
    "profileUpdated" in value &&
    typeof value.profileUpdated === "boolean" &&
    "profileMergeCompleted" in value &&
    typeof value.profileMergeCompleted === "boolean" &&
    "fieldsUpdated" in value &&
    Array.isArray(value.fieldsUpdated)
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

function readReturningUserIdentityPayload(
  value: unknown,
  fallback: StoredReturningIdentity,
): StoredReturningIdentity | null {
  if (typeof value !== "object" || value === null || !("user" in value)) return null;
  const user = value.user;
  if (typeof user !== "object" || user === null) return null;

  const userKey =
    "userKey" in user && typeof user.userKey === "string" ? user.userKey : fallback.userKey;
  const email =
    "email" in user && typeof user.email === "string" ? user.email : fallback.email;
  const linkedinUrl =
    "linkedinUrl" in user && typeof user.linkedinUrl === "string"
      ? user.linkedinUrl
      : fallback.linkedinUrl;
  const name =
    "name" in user && typeof user.name === "string" ? user.name : fallback.name ?? "";

  if (!userKey || !email) return null;

  return {
    userKey,
    name,
    email,
    linkedinUrl,
    latestAssessmentId:
      "latestAssessmentId" in value && typeof value.latestAssessmentId === "string"
        ? value.latestAssessmentId
        : fallback.latestAssessmentId,
  };
}

function isHeadlineGeneratorResponse(value: unknown): value is HeadlineGeneratorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "recommendedIndex" in value &&
    typeof value.recommendedIndex === "number" &&
    "headlines" in value &&
    Array.isArray(value.headlines) &&
    value.headlines.every(
      (headline) =>
        typeof headline === "object" &&
        headline !== null &&
        "style" in headline &&
        typeof headline.style === "string" &&
        "headline" in headline &&
        typeof headline.headline === "string" &&
        "score" in headline &&
        typeof headline.score === "number" &&
        "reason" in headline &&
        typeof headline.reason === "string" &&
        "bestFor" in headline &&
        typeof headline.bestFor === "string",
    )
  );
}

function isAboutGeneratorResponse(value: unknown): value is AboutGeneratorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "recommendedIndex" in value &&
    typeof value.recommendedIndex === "number" &&
    "versions" in value &&
    Array.isArray(value.versions) &&
    value.versions.every(
      (version) =>
        typeof version === "object" &&
        version !== null &&
        "style" in version &&
        typeof version.style === "string" &&
        "aboutSection" in version &&
        typeof version.aboutSection === "string" &&
        "bestUseCase" in version &&
        typeof version.bestUseCase === "string" &&
        "toneScore" in version &&
        typeof version.toneScore === "number" &&
        "whyThisWorks" in version &&
        typeof version.whyThisWorks === "string",
    )
  );
}

function isArticleGeneratorResponse(value: unknown): value is ArticleGeneratorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "headline" in value &&
    typeof value.headline === "string" &&
    "subtitle" in value &&
    typeof value.subtitle === "string" &&
    "article" in value &&
    typeof value.article === "string" &&
    "announcementPost" in value &&
    typeof value.announcementPost === "string" &&
    "hashtags" in value &&
    Array.isArray(value.hashtags) &&
    value.hashtags.every((hashtag) => typeof hashtag === "string")
  );
}

function isIntelligenceSubscriptionResponse(
  value: unknown,
): value is IntelligenceSubscriptionResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string" &&
    "userKey" in value &&
    typeof value.userKey === "string"
  );
}

function isAboutStorageDiagnostic(value: unknown): value is AboutStorageDiagnostic {
  if (typeof value !== "object" || value === null) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.error === "string" &&
    typeof record.stage === "string" &&
    isNullableString(record.supabaseMessage) &&
    isNullableString(record.supabaseDetails) &&
    isNullableString(record.supabaseHint) &&
    isNullableString(record.supabaseCode)
  );
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function getAboutGeneratorErrorMessage(
  errorMessage: string,
  diagnostic: AboutStorageDiagnostic | null,
) {
  if (process.env.NODE_ENV === "development" && diagnostic?.supabaseMessage) {
    return `${diagnostic.error}: ${diagnostic.supabaseMessage}`;
  }

  if (diagnostic?.error) {
    return `${diagnostic.error}. Please try again.`;
  }

  return errorMessage || "About section generation failed.";
}

function storeHeadlineGeneration(record: HeadlineGenerationRecord) {
  try {
    const raw = window.localStorage.getItem(HEADLINE_GENERATIONS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const existing = Array.isArray(parsed) ? parsed : [];
    window.localStorage.setItem(
      HEADLINE_GENERATIONS_STORAGE_KEY,
      JSON.stringify([record, ...existing].slice(0, 20)),
    );
  } catch {
    // Local storage is best-effort until Supabase headline storage is added.
  }
}

function storeAboutGeneration(record: AboutGenerationRecord) {
  try {
    const raw = window.localStorage.getItem(ABOUT_GENERATIONS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const existing = Array.isArray(parsed) ? parsed : [];
    window.localStorage.setItem(
      ABOUT_GENERATIONS_STORAGE_KEY,
      JSON.stringify([record, ...existing].slice(0, 20)),
    );
  } catch {
    // Local storage is best-effort; Supabase remains the source of truth.
  }
}

function toggleSelection(value: string, selected: string[], maxSelections = 99) {
  if (selected.includes(value)) return selected.filter((item) => item !== value);
  if (selected.length >= maxSelections) return selected;
  return [...selected, value];
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function moveItem(items: string[], fromIndex: number, toIndex: number) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
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

export function Header({ showSocialProof = false }: { showSocialProof?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#D9DDE3] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
        <a href="/" aria-label="INConnect home">
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
      {showSocialProof && <UserCountSocialProof />}
    </header>
  );
}

function UserCountSocialProof() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadUsersCount() {
      try {
        const response = await fetch("/api/stats/users-count", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as unknown;

        if (!isActive) return;

        if (!response.ok || !isUsersCountResponse(payload)) {
          setMessage("Professionals are already joining INConnect");
          return;
        }

        setMessage(getUsersCountMessage(payload.usersCount));
      } catch {
        if (isActive) {
          setMessage("Professionals are already joining INConnect");
        }
      }
    }

    void loadUsersCount();
    return () => {
      isActive = false;
    };
  }, []);

  if (!message) return null;

  return (
    <div className="border-t border-[#D9DDE3] bg-[#F3F7FD] px-5 py-2 text-center sm:px-8 lg:px-10">
      <p className="text-sm font-semibold leading-6 text-[#0A66C2]">
        {message}
      </p>
    </div>
  );
}

function isUsersCountResponse(value: unknown): value is { usersCount: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "usersCount" in value &&
    typeof value.usersCount === "number" &&
    Number.isFinite(value.usersCount) &&
    value.usersCount >= 0
  );
}

function getUsersCountMessage(usersCount: number) {
  const count = Math.floor(usersCount);
  if (count === 0) return "Be among the first professionals to join INConnect";
  if (count === 1) return "1 professional has already joined INConnect";
  return `${count.toLocaleString("en-US")} professionals have already joined INConnect`;
}

function HeroSection() {
  return (
    <section
      className="relative flex min-h-[620px] items-center overflow-hidden bg-[#0A192F] bg-cover bg-center px-5 py-16 text-white sm:px-8 sm:py-20 lg:min-h-[680px] lg:px-10"
      style={{ backgroundImage: "url('/hero-professionals-collage.png')" }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[#0A192F]/70" />
      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#78B7F4]">
            INConnect
          </p>
          <p className="mt-3 text-lg font-semibold text-white/82">
            Professional Intelligence Platform
          </p>
          <h1 className="mt-5 max-w-5xl text-4xl font-semibold leading-tight sm:text-6xl">
            Discover opportunities, stay informed, and connect with the right professionals.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/72 sm:text-lg">
            INConnect combines professional profile intelligence, industry
            insights, and future networking opportunities to help professionals
            and companies grow.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              className={classNames(
                "inline-flex h-12 items-center justify-center rounded-lg px-5",
                PRIMARY_CTA_CLASS,
              )}
              href="/assessment"
            >
              Start Assessment
            </a>
            <a
              className={classNames(
                "inline-flex h-12 items-center justify-center rounded-lg px-5",
                PRIMARY_CTA_CLASS,
              )}
              href="/headline-generator"
            >
              Generate Headlines
            </a>
            <a
              className={classNames(
                "inline-flex h-12 items-center justify-center rounded-lg px-5",
                PRIMARY_CTA_CLASS,
              )}
              href="/about-generator"
            >
              Generate About Section
            </a>
          </div>
        </div>
        <div aria-hidden="true" className="hidden lg:block" />
      </div>
    </section>
  );
}

function ModuleGrid() {
  const { isAdmin: articleAccessIsAdmin, isChecking: articleAccessIsChecking } =
    useArticleGeneratorAccess();
  const modules = [
    {
      title: "Profile Intelligence Assessment",
      status: "Active",
      description: "Upload your LinkedIn Profile PDF and discover how the market sees you.",
      features: [
        "Authority Score",
        "Professional Archetype",
        "Market Position",
        "Assessment History",
      ],
      href: "/assessment",
    },
    {
      title: "Headline Generator",
      status: "Active",
      description:
        "Create strategic LinkedIn headlines based on your expertise, value, and desired market perception.",
      features: [
        "5-step questionnaire",
        "AI-generated headlines",
        "Recommended headline",
        "Copy and regenerate",
      ],
      href: "/headline-generator",
    },
    {
      title: "About Generator",
      status: "Active",
      description:
        "Create a powerful LinkedIn About section from your expertise, business value, and positioning goals.",
      features: [
        "7-step positioning wizard",
        "AI-generated About sections",
        "Recommended version",
        "Copy and regenerate",
      ],
      href: "/about-generator",
    },
    {
      title: "LinkedIn Article Generator",
      status: "PRO",
      description:
        "Create long-form LinkedIn articles, industry insights, newsletters, and thought leadership content.",
      features: [
        "AI-generated articles",
        "Industry-focused content",
        "Thought leadership positioning",
        "Article announcement post",
        "Newsletter-ready output",
      ],
      href: "/article-generator",
    },
    {
      title: "Trend Radar",
      status: "Coming Soon in Pro",
      description: "Discover emerging industry trends aligned with your expertise and positioning.",
      features: [
        "Industry trend detection",
        "Growth opportunities",
        "Technology trends",
        "Authority themes",
      ],
      href: "#trend-radar",
    },
    {
      title: "Content Intelligence",
      status: "Coming Soon in Pro",
      description:
        "Generate personalized LinkedIn content opportunities based on your expertise and positioning.",
      features: [
        "Content pillars",
        "Post ideas",
        "Newsletter ideas",
        "Weekly roadmap",
      ],
      href: "#content-intelligence",
    },
    {
      title: "Profile Optimization Suite",
      status: "Coming Soon",
      description:
        "Future tools for rewriting, strengthening, and optimizing every major LinkedIn profile section.",
      features: [
        "Experience Rewriter",
        "Skills Optimizer",
        "Profile Strength Check",
        "Keyword Optimizer",
      ],
      href: "#profile-optimization-suite",
    },
    {
      title: "Personal Brand Intelligence",
      status: "Future",
      description:
        "Future assessments for leadership style, communication style, and personal brand positioning.",
      features: [
        "Archetype Assessment",
        "Leadership Style",
        "Communication Style",
        "Brand Positioning",
      ],
      href: "#personal-brand-intelligence",
    },
  ];

  return (
    <section className="bg-[#F3F2EF] px-5 py-10 sm:px-8 lg:px-10" id="modules">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Professional Intelligence Platform
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[#191919]">
            One platform for intelligence, insight, authority, and opportunity.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            LinkedIn tools remain a practical entry point. INConnect is growing
            into a broader professional intelligence platform for industry
            insights, authority building, future business matching, and
            professional opportunity discovery.
          </p>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => {
            const isActive = module.status === "Active";
            const isArticleModule = module.title === "LinkedIn Article Generator";
            const isPremium = module.status === "PRO";
            return (
              <article
                className={classNames(
                  "flex min-h-full flex-col rounded-lg border p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]",
                  isActive || isPremium
                    ? "border-[#0A66C2]/25 bg-white"
                    : "border-[#D9DDE3] bg-[#F8F8F6]",
                )}
                key={module.title}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-[#191919]">{module.title}</h3>
                  <span
                    className={classNames(
                      "shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold",
                      isActive
                        ? "border-[#057642]/20 bg-[#EEF7F2] text-[#057642]"
                        : isPremium
                          ? "border-[#0A66C2]/20 bg-[#E8F1FB] text-[#0A66C2]"
                          : "border-[#D9DDE3] bg-white text-[#666666]",
                    )}
                  >
                    {module.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#666666]">
                  {module.description}
                </p>
                <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#666666]">
                  {module.features.map((feature) => (
                    <li className="flex gap-2" key={feature}>
                      {isActive || isPremium ? (
                        <Check className="mt-1 h-4 w-4 shrink-0 text-[#057642]" />
                      ) : (
                        <LockKeyhole className="mt-1 h-4 w-4 shrink-0 text-[#0A66C2]" />
                      )}
                      {feature}
                    </li>
                  ))}
                </ul>
                {isActive ? (
                  <a
                    className={classNames(
                      "mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg px-4 text-sm",
                      PRIMARY_CTA_CLASS,
                    )}
                    href={module.href}
                  >
                    {module.title === "Headline Generator"
                      ? "Generate Headlines"
                      : module.title === "About Generator"
                        ? "Generate About Section"
                        : "Start Assessment"}
                  </a>
                ) : isArticleModule ? (
                  <a
                    aria-disabled={!articleAccessIsAdmin}
                    className={classNames(
                      "mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors duration-200 ease-[ease]",
                      articleAccessIsAdmin
                        ? `${PRIMARY_CTA_CLASS}`
                        : "border border-[#D9DDE3] bg-[#F8F8F6] text-[#666666] hover:border-[#0A66C2] hover:text-[#0A66C2]",
                    )}
                    href={articleAccessIsAdmin ? "/article-generator" : "/pricing"}
                  >
                    {articleAccessIsChecking
                      ? "Checking Access..."
                      : articleAccessIsAdmin
                        ? "Generate Article"
                        : "Available in Pro"}
                  </a>
                ) : (
                  <p className="mt-5 rounded-lg border border-[#D9DDE3] bg-white px-4 py-3 text-center text-sm font-semibold text-[#666666]">
                    Coming Soon
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
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
  const [hasProfileConsent, setHasProfileConsent] = useState(false);
  const validationError = getAssessmentError({
    email,
    hasProfileConsent,
    linkedinUrl,
    profilePdf,
  });
  const isDevelopment = process.env.NODE_ENV === "development";
  const storageDiagnostic = debug?.storageDiagnostic;
  const isSubmitDisabled = isAnalyzing || Boolean(validationError);
  const submitLabel = isAnalyzing
    ? "Analyzing Profile..."
    : isSubmitDisabled
      ? profilePdf && !hasProfileConsent
        ? "Agree to profile storage to continue"
        : "Upload your LinkedIn Profile PDF to continue"
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
      <input
        name="profileConsent"
        type="hidden"
        value={hasProfileConsent ? "true" : "false"}
      />
      <div className="border-b border-[#D9DDE3] pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Profile Intelligence Assessment
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#191919] sm:text-5xl">
          Discover how the market sees you.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666]">
          Upload your LinkedIn Profile PDF and receive a comprehensive assessment
          of authority, archetype, market position, positioning gaps, and profile
          improvement opportunities.
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

      <label className="mt-5 flex items-start gap-3 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-sm leading-6 text-[#666666]">
        <input
          checked={hasProfileConsent}
          className="mt-1 h-4 w-4 rounded border-[#D9DDE3] text-[#0A66C2] focus:ring-[#0A66C2]"
          onChange={(event) => setHasProfileConsent(event.target.checked)}
          required
          type="checkbox"
        />
        <span>
          <span className="font-semibold text-[#191919]">
            I agree that INConnect may store my profile information and tool
            results to provide assessments, recommendations, and personalized
            LinkedIn growth features.
          </span>
          <span className="mt-1 block">
            We store your profile data so INConnect can remember your results
            and improve future recommendations. You can request deletion anytime.
          </span>
        </span>
      </label>

      <button
        className={classNames(
          "mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-center text-sm leading-5 sm:text-base",
          PRIMARY_CTA_CLASS,
          PRIMARY_CTA_SHADOW,
        )}
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
            {debug.profile && (
              <>
                <p>User Found: {String(debug.profile.userFound)}</p>
                <p>User Created: {String(debug.profile.userCreated)}</p>
                <p>User Key Updated: {String(debug.profile.userKeyUpdated)}</p>
                <p>Profile Found: {String(debug.profile.profileFound)}</p>
                <p>Profile Created: {String(debug.profile.profileCreated)}</p>
                <p>Profile Updated: {String(debug.profile.profileUpdated)}</p>
                <p>
                  Profile Merge Completed:{" "}
                  {String(debug.profile.profileMergeCompleted)}
                </p>
                <p>
                  Profile Fields Updated:{" "}
                  {debug.profile.fieldsUpdated.join(", ") || "None"}
                </p>
              </>
            )}
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
              className={classNames(
                "inline-flex h-10 items-center justify-center rounded-lg px-4",
                PRIMARY_CTA_CLASS,
              )}
              disabled={!limitState.latestAssessment}
              onClick={onViewLatest}
              type="button"
            >
              View Latest Assessment
            </button>
            <button
              className={classNames(
                "inline-flex h-10 items-center justify-center rounded-lg px-4",
                PRIMARY_CTA_CLASS,
              )}
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

function HeadlineGenerator({
  identity,
  onSwitchUser,
}: {
  identity: StoredReturningIdentity | null;
  onSwitchUser: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRole, setCustomRole] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [customIndustry, setCustomIndustry] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [customExpertise, setCustomExpertise] = useState("");
  const [selectedValue, setSelectedValue] = useState<string[]>([]);
  const [customValue, setCustomValue] = useState("");
  const [selectedPerception, setSelectedPerception] = useState<string[]>([]);
  const [customPerception, setCustomPerception] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<HeadlineGeneratorResponse | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [hasProfileConsent, setHasProfileConsent] = useState(false);
  const [profileDebug, setProfileDebug] = useState<UserProfileDebug | null>(null);
  const recognizedName = getIdentityDisplayName(identity);
  const recognizedEmail = identity?.email.trim() ?? "";
  const isRecognizedUser = Boolean(
    identity?.userKey && recognizedName && isValidEmail(recognizedEmail),
  );
  const shouldShowWizard = hasStarted || isRecognizedUser;
  const effectiveName = isRecognizedUser ? recognizedName : name;
  const effectiveEmail = isRecognizedUser ? recognizedEmail : email;
  const recognizedFirstName = getFirstNameFromDisplayName(recognizedName);

  useEffect(() => {
    if (isRecognizedUser) {
      setName(recognizedName);
      setEmail(recognizedEmail);
      setHasStarted(true);
      setError("");
      return;
    }

    if (identity) {
      setName(identity.name ?? "");
      setEmail(identity.email ?? "");
      setHasStarted(false);
      setHasProfileConsent(false);
      return;
    }

    setName("");
    setEmail("");
    setHasStarted(false);
    setHasProfileConsent(false);
    setResults(null);
    setCopiedIndex(null);
    setProfileDebug(null);
    setError("");
  }, [identity, isRecognizedUser, recognizedEmail, recognizedName]);

  const inputs: HeadlineInputs = {
    roles: uniqueItems(selectedRoles),
    industries: uniqueItems(selectedIndustries),
    expertise: uniqueItems(selectedExpertise),
    values: uniqueItems(selectedValue),
    perceptions: uniqueItems(selectedPerception),
  };
  const identityIsValid =
    effectiveName.trim().length > 1 && isValidEmail(effectiveEmail);
  const steps = [
    {
      question: "What is your current professional role?",
      helper: "Select up to 10 roles.",
      options: roleOptions,
      selected: inputs.roles,
      setSelected: setSelectedRoles,
      customLabel: "Add your own role",
      customPlaceholder: "Example: Airport Automation Leader",
      customValue: customRole,
      setCustomValue: setCustomRole,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
    {
      question: "Which industries do you want people to associate you with?",
      helper: "Select up to 10 industries.",
      options: industryOptions,
      selected: inputs.industries,
      setSelected: setSelectedIndustries,
      customLabel: "Add your own industry",
      customPlaceholder: "Example: Baggage Handling Systems",
      customValue: customIndustry,
      setCustomValue: setCustomIndustry,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
    {
      question: "What are your strongest professional skills or expertise areas?",
      helper: "Select up to 10 expertise areas.",
      options: expertiseOptions,
      selected: inputs.expertise,
      setSelected: setSelectedExpertise,
      customLabel: "Add your own expertise",
      customPlaceholder: "Example: Partner Ecosystem Strategy",
      customValue: customExpertise,
      setCustomValue: setCustomExpertise,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
    {
      question: "What business value or outcome do you help create?",
      helper: "Select up to 10 outcomes.",
      options: businessValueOptions,
      selected: inputs.values,
      setSelected: setSelectedValue,
      customLabel: "Add your own value",
      customPlaceholder: "Example: Improve airport throughput",
      customValue: customValue,
      setCustomValue: setCustomValue,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
    {
      question:
        "If someone remembers only one thing about you after visiting your profile, what should it be?",
      helper: "Select up to 10 desired perceptions.",
      options: perceptionOptions,
      selected: inputs.perceptions,
      setSelected: setSelectedPerception,
      customLabel: "Add your own perception",
      customPlaceholder: "Example: Trusted international growth partner",
      customValue: customPerception,
      setCustomValue: setCustomPerception,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
  ];
  const activeStep = steps[stepIndex];
  const currentStepIsComplete =
    activeStep.selected.length >= activeStep.minSelections &&
    activeStep.selected.length <= activeStep.maxSelections;
  const canGenerate =
    identityIsValid &&
    hasProfileConsent &&
    steps.every((step) => step.selected.length >= step.minSelections) &&
    steps.every((step) => step.selected.length <= step.maxSelections);
  const progressPercent = ((stepIndex + 1) / steps.length) * 100;
  const isFinalStep = stepIndex === steps.length - 1;

  function startGenerator() {
    if (!identityIsValid) {
      setError("Add your name and a valid email address to continue.");
      return;
    }
    if (!hasProfileConsent) {
      setError(
        "Consent is required before INConnect can store your profile information and headline results.",
      );
      return;
    }

    setError("");
    setHasStarted(true);
  }

  function addCustomSelection() {
    const value = activeStep.customValue.trim();
    if (!value) return;

    activeStep.setSelected((current) => {
      const existing = uniqueItems(current);
      if (existing.includes(value)) return existing;
      if (existing.length >= activeStep.maxSelections) return existing;
      return [...existing, value];
    });
    activeStep.setCustomValue("");
  }

  async function generateHeadlines() {
    if (!canGenerate || isGenerating) return;

    setIsGenerating(true);
    setError("");
    setCopiedIndex(null);
    setProfileDebug(null);

    try {
      const response = await fetch("/api/generate-headlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: effectiveName.trim(),
          email: effectiveEmail.trim(),
          roles: inputs.roles,
          industries: inputs.industries,
          expertise: inputs.expertise,
          values: inputs.values,
          perceptions: inputs.perceptions,
          profileConsent: hasProfileConsent,
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      const errorMessage =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "";

      if (!response.ok || !isHeadlineGeneratorResponse(payload)) {
        throw new Error(errorMessage || "Headline generation failed.");
      }

      setResults(payload);
      setProfileDebug(
        payload.profileDebug && isUserProfileDebug(payload.profileDebug)
          ? payload.profileDebug
          : null,
      );
      if (payload.userKey) {
        storeReturningIdentity({
          userKey: payload.userKey,
          name: effectiveName.trim(),
          email: effectiveEmail.trim(),
          linkedinUrl: identity?.linkedinUrl ?? "",
          latestAssessmentId: identity?.latestAssessmentId,
        });
      }
      storeHeadlineGeneration({
        name: effectiveName.trim(),
        email: effectiveEmail.trim(),
        inputs,
        outputs: payload,
        createdAt: new Date().toISOString(),
        futureSupabaseTable: "headline_generations",
      });
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Headline generation failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shouldShowWizard) {
      startGenerator();
      return;
    }
    if (isFinalStep) {
      await generateHeadlines();
    }
  }

  async function handleCopy(headline: string, index: number) {
    const copied = await copyTextToClipboard(headline);
    if (copied) {
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 2200);
    }
  }

  return (
    <section
      className="bg-white px-5 py-10 sm:px-8 lg:px-10"
      id="headline-generator"
    >
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <form
          className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7"
          onSubmit={handleSubmit}
        >
          <div className="border-b border-[#D9DDE3] pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
              LinkedIn Headline Generator
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-[#191919]">
              Create strategic LinkedIn headlines.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#666666]">
              Create strategic LinkedIn headlines based on your role, expertise,
              business value, and desired market perception.
            </p>
          </div>

          {isRecognizedUser && (
            <div className="mt-6 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-[#191919]">
                    Welcome back{recognizedFirstName ? `, ${recognizedFirstName}` : ""}.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#666666]">
                    Generating headlines for:
                  </p>
                  <p className="font-semibold text-[#191919]">{recognizedEmail}</p>
                </div>
                <button
                  className="w-fit text-sm font-semibold text-[#0A66C2] underline-offset-4 hover:underline"
                  onClick={onSwitchUser}
                  type="button"
                >
                  Not you?
                </button>
              </div>
            </div>
          )}

          {!shouldShowWizard ? (
            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-[#191919]">
                Name
                <input
                  className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  value={name}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[#191919]">
                Email
                <input
                  className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                />
              </label>
              <ProfileConsentCheckbox
                checked={hasProfileConsent}
                onChange={setHasProfileConsent}
              />
              <button
                className={classNames(
                  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-center",
                  PRIMARY_CTA_CLASS,
                  PRIMARY_CTA_SHADOW,
                )}
                disabled={!identityIsValid || !hasProfileConsent}
                type="submit"
              >
                <Sparkles className="h-5 w-5" />
                Start Headline Generator
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
                    Step {stepIndex + 1} of {steps.length}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#191919]">
                    {activeStep.selected.length} of {activeStep.maxSelections} selected
                  </p>
                </div>
                <p className="text-sm leading-6 text-[#666666]">
                  {activeStep.helper}
                </p>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E8F1FB]">
                <div
                  className="h-full rounded-full bg-[#0A66C2] transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <fieldset className="mt-6 grid gap-4">
                <legend className="text-xl font-semibold leading-8 text-[#191919]">
                  {activeStep.question}
                </legend>
                <ChipGroup
                  maxSelections={activeStep.maxSelections}
                  onToggle={(item) =>
                    activeStep.setSelected((current) =>
                      toggleSelection(item, current, activeStep.maxSelections),
                    )
                  }
                  options={activeStep.options}
                  selected={activeStep.selected}
                />
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="grid gap-2 text-sm font-medium text-[#191919]">
                    {activeStep.customLabel}
                    <input
                      className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                      onChange={(event) => activeStep.setCustomValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCustomSelection();
                        }
                      }}
                      placeholder={activeStep.customPlaceholder}
                      value={activeStep.customValue}
                    />
                  </label>
                  <button
                    className="inline-flex h-12 items-center justify-center rounded-lg border border-[#0A66C2] bg-white px-4 text-sm font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB] disabled:cursor-not-allowed disabled:border-[#D9DDE3] disabled:text-[#666666]"
                    disabled={
                      !activeStep.customValue.trim() ||
                      activeStep.selected.length >= activeStep.maxSelections
                    }
                    onClick={addCustomSelection}
                    type="button"
                  >
                    Add
                  </button>
                </div>
                <SelectedOrderList
                  draggedIndex={draggedIndex}
                  items={activeStep.selected}
                  onDragStart={setDraggedIndex}
                  onDrop={(fromIndex, toIndex) => {
                    activeStep.setSelected((current) =>
                      moveItem(current, fromIndex, toIndex),
                    );
                    setDraggedIndex(null);
                  }}
                  onMove={(fromIndex, toIndex) =>
                    activeStep.setSelected((current) =>
                      moveItem(current, fromIndex, toIndex),
                    )
                  }
                  onRemove={(item) =>
                    activeStep.setSelected((current) =>
                      current.filter((selectedItem) => selectedItem !== item),
                    )
                  }
                />
                {!currentStepIsComplete && (
                  <p className="text-sm leading-6 text-[#666666]">
                    Select at least {activeStep.minSelections} to continue.
                  </p>
                )}
              </fieldset>

              <div className="mt-6">
                <ProfileConsentCheckbox
                  checked={hasProfileConsent}
                  onChange={setHasProfileConsent}
                />
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#191919] transition hover:border-[#0A66C2] hover:text-[#0A66C2] disabled:cursor-not-allowed disabled:text-[#666666]"
                  disabled={stepIndex === 0 || isGenerating}
                  onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
                  type="button"
                >
                  Back
                </button>
                {isFinalStep ? (
                  <button
                    className={classNames(
                      "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg px-6 py-3 text-center",
                      PRIMARY_CTA_CLASS,
                      PRIMARY_CTA_SHADOW,
                    )}
                    disabled={!canGenerate || isGenerating}
                    type="submit"
                  >
                    {isGenerating ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : (
                      <Sparkles className="h-5 w-5" />
                    )}
                    {isGenerating ? "Generating Headlines..." : "Generate Headlines"}
                  </button>
                ) : (
                  <button
                    className={classNames(
                      "inline-flex h-12 items-center justify-center rounded-lg px-5 text-sm",
                      PRIMARY_CTA_CLASS,
                    )}
                    disabled={!currentStepIsComplete || isGenerating}
                    onClick={() =>
                      setStepIndex((current) =>
                        Math.min(current + 1, steps.length - 1),
                      )
                    }
                    type="button"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium leading-6 text-red-700">
              {error}
            </p>
          )}
          {process.env.NODE_ENV === "development" && profileDebug && (
            <section className="mt-5 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-xs leading-6 text-[#666666]">
              <h3 className="text-sm font-semibold text-[#191919]">
                User Profile Debug
              </h3>
              <div className="mt-2 grid gap-1 font-mono">
                <p>User Found: {String(profileDebug.userFound)}</p>
                <p>User Created: {String(profileDebug.userCreated)}</p>
                <p>User Key Updated: {String(profileDebug.userKeyUpdated)}</p>
                <p>Profile Found: {String(profileDebug.profileFound)}</p>
                <p>Profile Created: {String(profileDebug.profileCreated)}</p>
                <p>Profile Updated: {String(profileDebug.profileUpdated)}</p>
                <p>
                  Profile Merge Completed:{" "}
                  {String(profileDebug.profileMergeCompleted)}
                </p>
                <p>
                  Fields Updated: {profileDebug.fieldsUpdated.join(", ") || "None"}
                </p>
              </div>
            </section>
          )}
        </form>

        <section className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-7">
          <div className="flex flex-col gap-3 border-b border-[#D9DDE3] pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
                Headline Output
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[#191919]">
                Your LinkedIn Headline Options
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#666666]">
                Generated based on your role, expertise, target industries,
                business value, and desired perception.
              </p>
            </div>
            <button
              className={classNames(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm",
                PRIMARY_CTA_CLASS,
              )}
              disabled={!results || !canGenerate || isGenerating}
              onClick={generateHeadlines}
              type="button"
            >
              <RefreshCw className={classNames("h-4 w-4", isGenerating && "animate-spin")} />
              Regenerate
            </button>
          </div>

          {!shouldShowWizard ? (
            <div className="mt-5 rounded-lg border border-[#D9DDE3] bg-white p-5">
              <p className="font-semibold text-[#191919]">
                Add your name and email to begin.
              </p>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                Your generated inputs and headline outputs will be stored with
                your INConnect profile after generation.
              </p>
            </div>
          ) : !results ? (
            <div className="mt-5 rounded-lg border border-[#D9DDE3] bg-white p-5">
              <p className="font-semibold text-[#191919]">
                Your headline recommendations will appear here.
              </p>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                INConnect will generate 3-5 headline styles and mark the option
                most aligned with your positioning.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {results.headlines.map((option, index) => {
                const isRecommended = index === results.recommendedIndex;
                return (
                  <article
                    className={classNames(
                      "rounded-lg border bg-white p-4",
                      isRecommended ? "border-[#0A66C2]/45" : "border-[#D9DDE3]",
                    )}
                    key={`${option.style}-${option.headline}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
                            {option.style}
                          </p>
                          <span className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-2 py-1 text-xs font-semibold text-[#191919]">
                            {option.score.toFixed(1)}/10
                          </span>
                          {isRecommended && (
                            <span className="rounded-lg border border-[#057642]/20 bg-[#EEF7F2] px-2 py-1 text-xs font-semibold text-[#057642]">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-lg font-semibold leading-7 text-[#191919]">
                          {option.headline}
                        </p>
                      </div>
                      <button
                        className={classNames(
                          "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm",
                          PRIMARY_CTA_CLASS,
                        )}
                        onClick={() => handleCopy(option.headline, index)}
                        type="button"
                      >
                        {copiedIndex === index ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {copiedIndex === index ? "Copied" : "Copy Headline"}
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#666666]">
                      {option.reason}
                    </p>
                    <p className="mt-3 rounded-lg bg-[#F8F8F6] p-3 text-sm leading-6 text-[#191919]">
                      <span className="font-semibold">Best use case: </span>
                      {option.bestFor}
                    </p>
                  </article>
                );
              })}

              <a
                className={classNames(
                  "inline-flex min-h-12 items-center justify-center rounded-lg px-5 py-3 text-sm",
                  PRIMARY_CTA_CLASS,
                )}
                href="/assessment"
              >
                Start Profile Assessment
              </a>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function AboutGenerator({
  identity,
  onSwitchUser,
}: {
  identity: StoredReturningIdentity | null;
  onSwitchUser: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRole, setCustomRole] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [customIndustry, setCustomIndustry] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [customExpertise, setCustomExpertise] = useState("");
  const [selectedValue, setSelectedValue] = useState<string[]>([]);
  const [customValue, setCustomValue] = useState("");
  const [selectedIdentity, setSelectedIdentity] = useState<string[]>([]);
  const [customIdentity, setCustomIdentity] = useState("");
  const [selectedWritingStyles, setSelectedWritingStyles] = useState<string[]>([]);
  const [customWritingStyle, setCustomWritingStyle] = useState("");
  const [selectedCallsToAction, setSelectedCallsToAction] = useState<string[]>([]);
  const [customCallToAction, setCustomCallToAction] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<AboutGeneratorResponse | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [hasProfileConsent, setHasProfileConsent] = useState(false);
  const [profileDebug, setProfileDebug] = useState<UserProfileDebug | null>(null);
  const [aboutStorageDiagnostic, setAboutStorageDiagnostic] =
    useState<AboutStorageDiagnostic | null>(null);
  const recognizedName = getIdentityDisplayName(identity);
  const recognizedEmail = identity?.email.trim() ?? "";
  const isRecognizedUser = Boolean(
    identity?.userKey && recognizedName && isValidEmail(recognizedEmail),
  );
  const shouldShowWizard = hasStarted || isRecognizedUser;
  const effectiveName = isRecognizedUser ? recognizedName : name;
  const effectiveEmail = isRecognizedUser ? recognizedEmail : email;
  const recognizedFirstName = getFirstNameFromDisplayName(recognizedName);

  useEffect(() => {
    if (isRecognizedUser) {
      setName(recognizedName);
      setEmail(recognizedEmail);
      setHasStarted(true);
      setError("");
      return;
    }

    if (identity) {
      setName(identity.name ?? "");
      setEmail(identity.email ?? "");
      setHasStarted(false);
      setHasProfileConsent(false);
      return;
    }

    setName("");
    setEmail("");
    setHasStarted(false);
    setHasProfileConsent(false);
      setResults(null);
      setCopiedIndex(null);
      setProfileDebug(null);
      setAboutStorageDiagnostic(null);
      setError("");
  }, [identity, isRecognizedUser, recognizedEmail, recognizedName]);

  const inputs: AboutInputs = {
    roles: uniqueItems(selectedRoles),
    industries: uniqueItems(selectedIndustries),
    expertise: uniqueItems(selectedExpertise),
    values: uniqueItems(selectedValue),
    identities: uniqueItems(selectedIdentity),
    writingStyles: uniqueItems(selectedWritingStyles),
    callsToAction: uniqueItems(selectedCallsToAction),
  };
  const identityIsValid =
    effectiveName.trim().length > 1 && isValidEmail(effectiveEmail);
  const steps = [
    {
      question: "What best describes your professional role?",
      helper: "Select up to 10 roles.",
      options: aboutRoleOptions,
      selected: inputs.roles,
      setSelected: setSelectedRoles,
      customPlaceholder: "Example: Airport Automation Leader",
      customValue: customRole,
      setCustomValue: setCustomRole,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
    {
      question: "Which industries should your About section position you in?",
      helper: "Select up to 10 industries.",
      options: aboutIndustryOptions,
      selected: inputs.industries,
      setSelected: setSelectedIndustries,
      customPlaceholder: "Example: Smart Ports",
      customValue: customIndustry,
      setCustomValue: setCustomIndustry,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
    {
      question: "What expertise should be highlighted?",
      helper: "Select up to 10 expertise areas.",
      options: aboutExpertiseOptions,
      selected: inputs.expertise,
      setSelected: setSelectedExpertise,
      customPlaceholder: "Example: LiDAR",
      customValue: customExpertise,
      setCustomValue: setCustomExpertise,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
    {
      question: "What business outcomes do you help create?",
      helper: "Select up to 10 outcomes.",
      options: aboutBusinessValueOptions,
      selected: inputs.values,
      setSelected: setSelectedValue,
      customPlaceholder: "Example: Improve airport throughput",
      customValue: customValue,
      setCustomValue: setCustomValue,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
    {
      question: "How would you like to be perceived?",
      helper: "Select up to 10 professional identity signals.",
      options: aboutIdentityOptions,
      selected: inputs.identities,
      setSelected: setSelectedIdentity,
      customPlaceholder: "Example: Trusted international growth partner",
      customValue: customIdentity,
      setCustomValue: setCustomIdentity,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
    {
      question: "What tone should your About section have?",
      helper: "Select up to 10 writing style preferences.",
      options: aboutWritingStyleOptions,
      selected: inputs.writingStyles,
      setSelected: setSelectedWritingStyles,
      customPlaceholder: "Example: Strategic and practical",
      customValue: customWritingStyle,
      setCustomValue: setCustomWritingStyle,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
    {
      question: "What should readers do after reading your About section?",
      helper: "Select up to 10 calls to action.",
      options: aboutCallToActionOptions,
      selected: inputs.callsToAction,
      setSelected: setSelectedCallsToAction,
      customPlaceholder: "Example: Discuss airport automation opportunities",
      customValue: customCallToAction,
      setCustomValue: setCustomCallToAction,
      minSelections: 1,
      maxSelections: HEADLINE_SELECTION_LIMIT,
    },
  ];
  const activeStep = steps[stepIndex];
  const currentStepIsComplete =
    activeStep.selected.length >= activeStep.minSelections &&
    activeStep.selected.length <= activeStep.maxSelections;
  const canGenerate =
    identityIsValid &&
    hasProfileConsent &&
    steps.every((step) => step.selected.length >= step.minSelections) &&
    steps.every((step) => step.selected.length <= step.maxSelections);
  const progressPercent = ((stepIndex + 1) / steps.length) * 100;
  const isFinalStep = stepIndex === steps.length - 1;

  function startGenerator() {
    setAboutStorageDiagnostic(null);
    if (!identityIsValid) {
      setError("Add your name and a valid email address to continue.");
      return;
    }
    if (!hasProfileConsent) {
      setError(
        "Consent is required before INConnect can store your profile information and About section results.",
      );
      return;
    }

    setError("");
    setHasStarted(true);
  }

  function addCustomSelection() {
    const value = activeStep.customValue.trim();
    if (!value) return;

    activeStep.setSelected((current) => {
      const existing = uniqueItems(current);
      if (existing.includes(value)) return existing;
      if (existing.length >= activeStep.maxSelections) return existing;
      return [...existing, value];
    });
    activeStep.setCustomValue("");
  }

  async function generateAboutSection() {
    if (!canGenerate || isGenerating) return;

    setIsGenerating(true);
    setError("");
    setCopiedIndex(null);
    setProfileDebug(null);
    setAboutStorageDiagnostic(null);

    try {
      const response = await fetch("/api/generate-about", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: effectiveName.trim(),
          email: effectiveEmail.trim(),
          roles: inputs.roles,
          industries: inputs.industries,
          expertise: inputs.expertise,
          values: inputs.values,
          identities: inputs.identities,
          writingStyles: inputs.writingStyles,
          callsToAction: inputs.callsToAction,
          profileConsent: hasProfileConsent,
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      const errorMessage =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "";
      const storageDiagnostic = isAboutStorageDiagnostic(payload) ? payload : null;

      if (!response.ok || !isAboutGeneratorResponse(payload)) {
        setAboutStorageDiagnostic(storageDiagnostic);
        throw new Error(
          getAboutGeneratorErrorMessage(errorMessage, storageDiagnostic),
        );
      }

      setResults(payload);
      setAboutStorageDiagnostic(null);
      setProfileDebug(
        payload.profileDebug && isUserProfileDebug(payload.profileDebug)
          ? payload.profileDebug
          : null,
      );
      if (payload.userKey) {
        storeReturningIdentity({
          userKey: payload.userKey,
          name: effectiveName.trim(),
          email: effectiveEmail.trim(),
          linkedinUrl: identity?.linkedinUrl ?? "",
          latestAssessmentId: identity?.latestAssessmentId,
        });
      }
      storeAboutGeneration({
        name: effectiveName.trim(),
        email: effectiveEmail.trim(),
        inputs,
        outputs: payload,
        createdAt: new Date().toISOString(),
        supabaseTable: "about_generations",
      });
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "About section generation failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shouldShowWizard) {
      startGenerator();
      return;
    }
    if (isFinalStep) {
      await generateAboutSection();
    }
  }

  async function handleCopy(aboutSection: string, index: number) {
    const copied = await copyTextToClipboard(aboutSection);
    if (copied) {
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 2200);
    }
  }

  return (
    <section
      className="bg-white px-5 py-10 sm:px-8 lg:px-10"
      id="about-generator"
    >
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <form
          className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7"
          onSubmit={handleSubmit}
        >
          <div className="border-b border-[#D9DDE3] pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
              LinkedIn About Generator
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#191919] sm:text-5xl">
              Create a stronger LinkedIn About section.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666]">
              Turn your expertise, experience, and business value into a
              compelling professional story.
            </p>
          </div>

          {isRecognizedUser && (
            <div className="mt-6 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-[#191919]">
                    Welcome back{recognizedFirstName ? `, ${recognizedFirstName}` : ""}.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#666666]">
                    Generating About sections for:
                  </p>
                  <p className="font-semibold text-[#191919]">{recognizedEmail}</p>
                </div>
                <button
                  className="w-fit text-sm font-semibold text-[#0A66C2] underline-offset-4 hover:underline"
                  onClick={onSwitchUser}
                  type="button"
                >
                  Not you?
                </button>
              </div>
            </div>
          )}

          {!shouldShowWizard ? (
            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-[#191919]">
                Name
                <input
                  className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  value={name}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[#191919]">
                Email
                <input
                  className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                />
              </label>
              <ProfileConsentCheckbox
                checked={hasProfileConsent}
                onChange={setHasProfileConsent}
              />
              <button
                className={classNames(
                  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-center",
                  PRIMARY_CTA_CLASS,
                  PRIMARY_CTA_SHADOW,
                )}
                disabled={!identityIsValid || !hasProfileConsent}
                type="submit"
              >
                <Sparkles className="h-5 w-5" />
                Generate About Section
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
                    Step {stepIndex + 1} of {steps.length}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#191919]">
                    {activeStep.selected.length} of {activeStep.maxSelections} selected
                  </p>
                </div>
                <p className="text-sm leading-6 text-[#666666]">
                  {activeStep.helper}
                </p>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E8F1FB]">
                <div
                  className="h-full rounded-full bg-[#0A66C2] transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <fieldset className="mt-6 grid gap-4">
                <legend className="text-xl font-semibold leading-8 text-[#191919]">
                  {activeStep.question}
                </legend>
                <ChipGroup
                  maxSelections={activeStep.maxSelections}
                  onToggle={(item) =>
                    activeStep.setSelected((current) =>
                      toggleSelection(item, current, activeStep.maxSelections),
                    )
                  }
                  options={activeStep.options}
                  selected={activeStep.selected}
                />
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="grid gap-2 text-sm font-medium text-[#191919]">
                    Add Custom
                    <input
                      className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                      onChange={(event) => activeStep.setCustomValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCustomSelection();
                        }
                      }}
                      placeholder={activeStep.customPlaceholder}
                      value={activeStep.customValue}
                    />
                  </label>
                  <button
                    className="inline-flex h-12 items-center justify-center rounded-lg border border-[#0A66C2] bg-white px-4 text-sm font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB] disabled:cursor-not-allowed disabled:border-[#D9DDE3] disabled:text-[#666666]"
                    disabled={
                      !activeStep.customValue.trim() ||
                      activeStep.selected.length >= activeStep.maxSelections
                    }
                    onClick={addCustomSelection}
                    type="button"
                  >
                    Add Custom
                  </button>
                </div>
                <SelectedOrderList
                  draggedIndex={draggedIndex}
                  items={activeStep.selected}
                  onDragStart={setDraggedIndex}
                  onDrop={(fromIndex, toIndex) => {
                    activeStep.setSelected((current) =>
                      moveItem(current, fromIndex, toIndex),
                    );
                    setDraggedIndex(null);
                  }}
                  onMove={(fromIndex, toIndex) =>
                    activeStep.setSelected((current) =>
                      moveItem(current, fromIndex, toIndex),
                    )
                  }
                  onRemove={(item) =>
                    activeStep.setSelected((current) =>
                      current.filter((selectedItem) => selectedItem !== item),
                    )
                  }
                />
                {!currentStepIsComplete && (
                  <p className="text-sm leading-6 text-[#666666]">
                    Select at least {activeStep.minSelections} to continue.
                  </p>
                )}
              </fieldset>

              <div className="mt-6">
                <ProfileConsentCheckbox
                  checked={hasProfileConsent}
                  onChange={setHasProfileConsent}
                />
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#191919] transition hover:border-[#0A66C2] hover:text-[#0A66C2] disabled:cursor-not-allowed disabled:text-[#666666]"
                  disabled={stepIndex === 0 || isGenerating}
                  onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
                  type="button"
                >
                  Back
                </button>
                {isFinalStep ? (
                  <button
                    className={classNames(
                      "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg px-6 py-3 text-center",
                      PRIMARY_CTA_CLASS,
                      PRIMARY_CTA_SHADOW,
                    )}
                    disabled={!canGenerate || isGenerating}
                    type="submit"
                  >
                    {isGenerating ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : (
                      <Sparkles className="h-5 w-5" />
                    )}
                    {isGenerating ? "Generating About Section..." : "Generate About Section"}
                  </button>
                ) : (
                  <button
                    className={classNames(
                      "inline-flex h-12 items-center justify-center rounded-lg px-5 text-sm",
                      PRIMARY_CTA_CLASS,
                    )}
                    disabled={!currentStepIsComplete || isGenerating}
                    onClick={() =>
                      setStepIndex((current) =>
                        Math.min(current + 1, steps.length - 1),
                      )
                    }
                    type="button"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium leading-6 text-red-700">
              {error}
            </p>
          )}
          {process.env.NODE_ENV === "development" && aboutStorageDiagnostic && (
            <section className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-xs leading-6 text-red-800">
              <h3 className="text-sm font-semibold text-red-900">
                About Storage Diagnostic
              </h3>
              <div className="mt-2 grid gap-2 font-mono">
                <p>
                  <span className="font-semibold">Storage stage: </span>
                  {aboutStorageDiagnostic.stage}
                </p>
                <p>
                  <span className="font-semibold">Error: </span>
                  {aboutStorageDiagnostic.supabaseMessage ||
                    aboutStorageDiagnostic.error}
                </p>
                <p>
                  <span className="font-semibold">Details: </span>
                  {aboutStorageDiagnostic.supabaseDetails || "No details returned"}
                </p>
                <p>
                  <span className="font-semibold">Hint: </span>
                  {aboutStorageDiagnostic.supabaseHint || "No hint returned"}
                </p>
                <p>
                  <span className="font-semibold">Code: </span>
                  {aboutStorageDiagnostic.supabaseCode || "No code returned"}
                </p>
              </div>
            </section>
          )}
          {process.env.NODE_ENV === "development" && profileDebug && (
            <section className="mt-5 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-xs leading-6 text-[#666666]">
              <h3 className="text-sm font-semibold text-[#191919]">
                User Profile Debug
              </h3>
              <div className="mt-2 grid gap-1 font-mono">
                <p>User Found: {String(profileDebug.userFound)}</p>
                <p>User Created: {String(profileDebug.userCreated)}</p>
                <p>User Key Updated: {String(profileDebug.userKeyUpdated)}</p>
                <p>Profile Found: {String(profileDebug.profileFound)}</p>
                <p>Profile Created: {String(profileDebug.profileCreated)}</p>
                <p>Profile Updated: {String(profileDebug.profileUpdated)}</p>
                <p>
                  Profile Merge Completed:{" "}
                  {String(profileDebug.profileMergeCompleted)}
                </p>
                <p>
                  Fields Updated: {profileDebug.fieldsUpdated.join(", ") || "None"}
                </p>
              </div>
            </section>
          )}
        </form>

        <section className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-7">
          <div className="flex flex-col gap-3 border-b border-[#D9DDE3] pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
                About Output
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[#191919]">
                Your LinkedIn About Section Options
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#666666]">
                Generated from your role, industry, expertise, business value,
                professional identity, writing style, and call to action.
              </p>
            </div>
            <button
              className={classNames(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm",
                PRIMARY_CTA_CLASS,
              )}
              disabled={!results || !canGenerate || isGenerating}
              onClick={generateAboutSection}
              type="button"
            >
              <RefreshCw className={classNames("h-4 w-4", isGenerating && "animate-spin")} />
              Regenerate
            </button>
          </div>

          {!shouldShowWizard ? (
            <div className="mt-5 rounded-lg border border-[#D9DDE3] bg-white p-5">
              <p className="font-semibold text-[#191919]">
                Add your name and email to begin.
              </p>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                Your generated About section options will be stored with your
                INConnect profile after generation.
              </p>
            </div>
          ) : !results ? (
            <div className="mt-5 rounded-lg border border-[#D9DDE3] bg-white p-5">
              <p className="font-semibold text-[#191919]">
                Your About section options will appear here.
              </p>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                INConnect will generate 3-5 LinkedIn-ready About sections and
                mark the strongest option.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {results.versions.map((option, index) => {
                const isRecommended = index === results.recommendedIndex;
                return (
                  <article
                    className={classNames(
                      "rounded-lg border bg-white p-4",
                      isRecommended ? "border-[#0A66C2]/45" : "border-[#D9DDE3]",
                    )}
                    key={`${option.style}-${index}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
                            {option.style}
                          </p>
                          <span className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-2 py-1 text-xs font-semibold text-[#191919]">
                            {option.toneScore.toFixed(1)}/10
                          </span>
                          {isRecommended && (
                            <span className="rounded-lg border border-[#057642]/20 bg-[#EEF7F2] px-2 py-1 text-xs font-semibold text-[#057642]">
                              Recommended
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={classNames(
                            "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm",
                            PRIMARY_CTA_CLASS,
                          )}
                          onClick={() => handleCopy(option.aboutSection, index)}
                          type="button"
                        >
                          {copiedIndex === index ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          {copiedIndex === index ? "Copied" : "Copy"}
                        </button>
                        <button
                          className={classNames(
                            "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm",
                            PRIMARY_CTA_CLASS,
                          )}
                          disabled={!canGenerate || isGenerating}
                          onClick={generateAboutSection}
                          type="button"
                        >
                          <RefreshCw
                            className={classNames("h-4 w-4", isGenerating && "animate-spin")}
                          />
                          Regenerate
                        </button>
                      </div>
                    </div>
                    <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#191919]">
                      {option.aboutSection}
                    </p>
                    <p className="mt-3 rounded-lg bg-[#F8F8F6] p-3 text-sm leading-6 text-[#191919]">
                      <span className="font-semibold">Best use case: </span>
                      {option.bestUseCase}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[#666666]">
                      {option.whyThisWorks}
                    </p>
                  </article>
                );
              })}

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  className={classNames(
                    "inline-flex min-h-12 items-center justify-center rounded-lg px-5 py-3 text-sm",
                    PRIMARY_CTA_CLASS,
                  )}
                  disabled={!canGenerate || isGenerating}
                  onClick={generateAboutSection}
                  type="button"
                >
                  Generate Again
                </button>
                <a
                  className={classNames(
                    "inline-flex min-h-12 items-center justify-center rounded-lg px-5 py-3 text-center text-sm",
                    PRIMARY_CTA_CLASS,
                  )}
                  href="/headline-generator"
                >
                  Go to Headline Generator
                </a>
                <a
                  className={classNames(
                    "inline-flex min-h-12 items-center justify-center rounded-lg px-5 py-3 text-center text-sm",
                    PRIMARY_CTA_CLASS,
                  )}
                  href="/assessment"
                >
                  Run Profile Assessment
                </a>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function ArticleGenerator({
  identity,
  onSwitchUser,
}: {
  identity: StoredReturningIdentity | null;
  onSwitchUser: () => void;
}) {
  const [accessState, setAccessState] = useState<ArticleAccessState>(
    identity?.email ? "checking" : "locked",
  );
  const [accessEmail, setAccessEmail] = useState(identity?.email ?? "");
  const [accessError, setAccessError] = useState("");
  const [topic, setTopic] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [industry, setIndustry] = useState("");
  const [tone, setTone] = useState(ARTICLE_TONES[0]);
  const [keyPointsText, setKeyPointsText] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [cta, setCta] = useState("");
  const [addInconnectMention, setAddInconnectMention] = useState(true);
  const [results, setResults] = useState<ArticleGeneratorResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copiedTarget, setCopiedTarget] = useState<"article" | "post" | null>(null);
  const recognizedName = getIdentityDisplayName(identity);
  const recognizedFirstName = getFirstNameFromDisplayName(recognizedName);
  const keyPoints = parseKeyPoints(keyPointsText);
  const canGenerate =
    accessState === "admin" &&
    isValidEmail(accessEmail) &&
    topic.trim().length > 3 &&
    targetAudience.trim().length > 2 &&
    industry.trim().length > 1 &&
    keyPoints.length > 0 &&
    !isGenerating;

  useEffect(() => {
    const email = identity?.email ?? "";
    setAccessEmail(email);

    if (!email || !isValidEmail(email)) {
      setAccessState("locked");
      return;
    }

    let isActive = true;
    setAccessState("checking");
    setAccessError("");

    async function verifyStoredAdminEmail() {
      const isAdmin = await verifyArticleAdminAccess(email);
      if (!isActive) return;
      setAccessState(isAdmin ? "admin" : "locked");
      if (!isAdmin) {
        setAccessError("");
      }
    }

    void verifyStoredAdminEmail();
    return () => {
      isActive = false;
    };
  }, [identity?.email]);

  async function handleAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = accessEmail.trim();

    if (!isValidEmail(email)) {
      setAccessError("Enter a valid admin email address.");
      return;
    }

    setAccessState("checking");
    setAccessError("");
    const isAdmin = await verifyArticleAdminAccess(email);
    setAccessState(isAdmin ? "admin" : "locked");
    setAccessError(isAdmin ? "" : "This Pro prototype is locked for this account.");
  }

  async function generateArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitArticleGeneration();
  }

  async function submitArticleGeneration() {
    if (!canGenerate) return;

    setIsGenerating(true);
    setError("");
    setCopiedTarget(null);

    try {
      const response = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addInconnectMention,
          cta,
          email: accessEmail.trim(),
          industry,
          keyPoints,
          sourceNotes,
          targetAudience,
          tone,
          topic,
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      const errorMessage =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "";

      if (response.status === 403) {
        setAccessState("locked");
        throw new Error(errorMessage || "LinkedIn Article Generator is coming soon in Pro.");
      }

      if (!response.ok || !isArticleGeneratorResponse(payload)) {
        throw new Error(errorMessage || "Article generation failed.");
      }

      setResults(payload);
      if (payload.userKey) {
        storeReturningIdentity({
          userKey: payload.userKey,
          name: identity?.name ?? "",
          email: accessEmail.trim(),
          linkedinUrl: identity?.linkedinUrl ?? "",
          latestAssessmentId: identity?.latestAssessmentId,
        });
      }
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Article generation failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy(text: string, target: "article" | "post") {
    const copied = await copyTextToClipboard(text);
    if (copied) {
      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget(null), 2200);
    }
  }

  if (accessState !== "admin") {
    return (
      <section className="bg-[#F3F2EF] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_0.82fr]">
          <div className="relative overflow-hidden rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
            <div className="pointer-events-none select-none blur-[2px]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
                Pro prototype
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#191919] sm:text-5xl">
                LinkedIn Article Generator
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#666666]">
                Draft long-form LinkedIn articles, announcement posts, and
                hashtags from strategic positioning inputs.
              </p>
              <div className="mt-7 grid gap-3 md:grid-cols-3">
                {["Article headline", "Full LinkedIn article", "LinkedIn post announcement"].map((item) => (
                  <article className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4" key={item}>
                    <FileText className="h-5 w-5 text-[#0A66C2]" />
                    <h2 className="mt-4 font-semibold text-[#191919]">{item}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#666666]">
                      Coming soon in Pro.
                    </p>
                  </article>
                ))}
              </div>
            </div>
            <div className="absolute inset-0 grid place-items-center bg-white/65 p-5">
              <div className="max-w-md rounded-lg border border-[#0A66C2]/20 bg-white p-5 text-center shadow-[0_18px_48px_rgba(10,25,47,0.14)]">
                <LockKeyhole className="mx-auto h-7 w-7 text-[#0A66C2]" />
                <h2 className="mt-4 text-xl font-semibold text-[#191919]">
                  LinkedIn Article Generator is coming soon in Pro.
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#666666]">
                  This admin-only prototype is locked for normal users until the
                  public Pro release.
                </p>
                <a
                  className={classNames(
                    "mt-5 inline-flex h-12 items-center justify-center rounded-lg px-5",
                    PRIMARY_CTA_CLASS,
                    PRIMARY_CTA_SHADOW,
                  )}
                  href="/contact"
                >
                  Join Pro Waitlist
                </a>
              </div>
            </div>
          </div>

          <form
            className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-7"
            onSubmit={handleAccessSubmit}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
              Admin preview access
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[#191919]">
              Verify admin email
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#666666]">
              Admin users listed in `ADMIN_EMAILS` can access the prototype
              before the public Pro release.
            </p>
            {identity?.email && (
              <div className="mt-4 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4">
                <p className="font-semibold text-[#191919]">
                  Welcome back{recognizedFirstName ? `, ${recognizedFirstName}` : ""}.
                </p>
                <p className="mt-1 text-sm leading-6 text-[#666666]">{identity.email}</p>
                <button
                  className="mt-2 text-sm font-semibold text-[#0A66C2] underline-offset-4 hover:underline"
                  onClick={onSwitchUser}
                  type="button"
                >
                  Not you?
                </button>
              </div>
            )}
            <label className="mt-5 grid gap-2 text-sm font-medium text-[#191919]">
              Email
              <input
                className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                onChange={(event) => setAccessEmail(event.target.value)}
                placeholder="admin@example.com"
                type="email"
                value={accessEmail}
              />
            </label>
            {accessError && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium leading-6 text-red-700">
                {accessError}
              </p>
            )}
            <button
              className={classNames(
                "mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-5",
                PRIMARY_CTA_CLASS,
              )}
              disabled={accessState === "checking"}
              type="submit"
            >
              {accessState === "checking" && <LoaderCircle className="h-5 w-5 animate-spin" />}
              {accessState === "checking" ? "Checking Access..." : "Unlock Admin Preview"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#F3F2EF] px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <form
          className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7"
          onSubmit={generateArticle}
        >
          <div className="border-b border-[#D9DDE3] pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
              Admin Pro prototype
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#191919] sm:text-5xl">
              LinkedIn Article Generator
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#666666]">
              Generate long-form LinkedIn articles, announcement posts, and
              hashtags from strategic positioning inputs.
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-[#191919]">
                  Admin access verified
                </p>
                <p className="mt-1 text-sm leading-6 text-[#666666]">{accessEmail}</p>
              </div>
              <button
                className="w-fit text-sm font-semibold text-[#0A66C2] underline-offset-4 hover:underline"
                onClick={() => {
                  setAccessState("locked");
                  onSwitchUser();
                }}
                type="button"
              >
                Switch user
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-[#191919]">
              Article Topic
              <input
                className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Example: How AI is changing airport operations"
                value={topic}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#191919]">
              Audience
              <input
                className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                onChange={(event) => setTargetAudience(event.target.value)}
                placeholder="Example: Airport executives and innovation leaders"
                value={targetAudience}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-[#191919]">
                Industry
                <input
                  className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                  onChange={(event) => setIndustry(event.target.value)}
                  placeholder="Example: Aviation"
                  value={industry}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[#191919]">
                Tone
                <select
                  className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                  onChange={(event) => setTone(event.target.value)}
                  value={tone}
                >
                  {ARTICLE_TONES.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium text-[#191919]">
              Key Points
              <textarea
                className="min-h-32 rounded-lg border border-[#D9DDE3] bg-white px-3 py-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                onChange={(event) => setKeyPointsText(event.target.value)}
                placeholder={"One point per line\nOperational visibility\nPassenger flow\nDecision support"}
                value={keyPointsText}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#191919]">
              Optional Sources
              <textarea
                className="min-h-24 rounded-lg border border-[#D9DDE3] bg-white px-3 py-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                onChange={(event) => setSourceNotes(event.target.value)}
                placeholder="Paste rough notes, claims to avoid, or context you want reflected."
                value={sourceNotes}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#191919]">
              CTA
              <input
                className="h-12 rounded-lg border border-[#D9DDE3] bg-white px-3 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                onChange={(event) => setCta(event.target.value)}
                placeholder="Example: Connect to discuss practical AI adoption"
                value={cta}
              />
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-sm leading-6 text-[#666666]">
              <input
                checked={addInconnectMention}
                className="mt-1 h-4 w-4 rounded border-[#D9DDE3] text-[#0A66C2] focus:ring-[#0A66C2]"
                onChange={(event) => setAddInconnectMention(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="font-semibold text-[#191919]">
                  Add soft INConnect collaboration mention
                </span>
                <span className="mt-1 block">
                  Adds one subtle attribution line near the end of the article.
                </span>
              </span>
            </label>
          </div>

          {error && (
            <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium leading-6 text-red-700">
              {error}
            </p>
          )}

          <button
            className={classNames(
              "mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-center",
              PRIMARY_CTA_CLASS,
              PRIMARY_CTA_SHADOW,
            )}
            disabled={!canGenerate}
            type="submit"
          >
            {isGenerating ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
            {isGenerating ? "Generating..." : "Generate"}
          </button>
        </form>

        <section className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-7">
          <div className="flex flex-col gap-3 border-b border-[#D9DDE3] pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
                Generated output
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[#191919]">
                Article package
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#666666]">
                Review carefully before publishing. INConnect does not post to
                LinkedIn automatically.
              </p>
            </div>
            <button
              className={classNames(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm",
                PRIMARY_CTA_CLASS,
              )}
              disabled={!results || !canGenerate}
              onClick={submitArticleGeneration}
              type="button"
            >
              <RefreshCw className={classNames("h-4 w-4", isGenerating && "animate-spin")} />
              Regenerate
            </button>
          </div>

          {!results ? (
            <div className="mt-5 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-5">
              <p className="font-semibold text-[#191919]">
                Your article output will appear here.
              </p>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                The prototype creates a headline, subtitle, full article,
                announcement post, and suggested hashtags.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              <article className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
                  Article Headline
                </p>
                <h3 className="mt-3 text-2xl font-semibold leading-tight text-[#191919]">
                  {results.headline}
                </h3>
                <p className="mt-3 text-base leading-7 text-[#666666]">
                  {results.subtitle}
                </p>
              </article>
              <article className="rounded-lg border border-[#D9DDE3] bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
                    Full LinkedIn Article
                  </p>
                  <button
                    className={classNames(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm",
                      PRIMARY_CTA_CLASS,
                    )}
                    onClick={() => handleCopy(results.article, "article")}
                    type="button"
                  >
                    {copiedTarget === "article" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedTarget === "article" ? "Copied" : "Copy Article"}
                  </button>
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#191919]">
                  {results.article}
                </p>
              </article>
              <article className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
                    LinkedIn Post Announcement
                  </p>
                  <button
                    className={classNames(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm",
                      PRIMARY_CTA_CLASS,
                    )}
                    onClick={() => handleCopy(results.announcementPost, "post")}
                    type="button"
                  >
                    {copiedTarget === "post" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedTarget === "post" ? "Copied" : "Copy Announcement Post"}
                  </button>
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#191919]">
                  {results.announcementPost}
                </p>
              </article>
              <div className="flex flex-wrap gap-2">
                {results.hashtags.map((hashtag) => (
                  <span
                    className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] px-3 py-1 text-sm font-semibold text-[#0A66C2]"
                    key={hashtag}
                  >
                    {hashtag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

async function verifyArticleAdminAccess(email: string) {
  try {
    const response = await fetch("/api/article-generator-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    return (
      response.ok &&
      typeof payload === "object" &&
      payload !== null &&
      "isAdmin" in payload &&
      payload.isAdmin === true
    );
  } catch {
    return false;
  }
}

function useArticleGeneratorAccess() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const storedIdentity = readStoredReturningIdentity();
    const email = storedIdentity?.email ?? "";

    if (!email || !isValidEmail(email)) {
      setIsAdmin(false);
      setIsChecking(false);
      return;
    }

    let isActive = true;
    setIsChecking(true);

    async function verifyAccess() {
      const nextIsAdmin = await verifyArticleAdminAccess(email);
      if (!isActive) return;
      setIsAdmin(nextIsAdmin);
      setIsChecking(false);
    }

    void verifyAccess();
    return () => {
      isActive = false;
    };
  }, []);

  return { isAdmin, isChecking };
}

function parseKeyPoints(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\n|;/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

function SelectedOrderList({
  draggedIndex,
  items,
  onDragStart,
  onDrop,
  onMove,
  onRemove,
}: {
  draggedIndex: number | null;
  items: string[];
  onDragStart: (index: number | null) => void;
  onDrop: (fromIndex: number, toIndex: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (item: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="grid gap-2 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">
        Selected order
      </p>
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div
            className={classNames(
              "flex flex-col gap-2 rounded-lg border bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between",
              draggedIndex === index ? "border-[#0A66C2]" : "border-[#D9DDE3]",
            )}
            draggable
            key={item}
            onDragEnd={() => onDragStart(null)}
            onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
            onDragStart={() => onDragStart(index)}
            onDrop={() => draggedIndex !== null && onDrop(draggedIndex, index)}
          >
            <span className="font-semibold text-[#191919]">{item}</span>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-[#D9DDE3] px-2 py-1 text-xs font-semibold text-[#666666] transition hover:border-[#0A66C2] hover:text-[#0A66C2] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
                type="button"
              >
                Up
              </button>
              <button
                className="rounded-lg border border-[#D9DDE3] px-2 py-1 text-xs font-semibold text-[#666666] transition hover:border-[#0A66C2] hover:text-[#0A66C2] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={index === items.length - 1}
                onClick={() => onMove(index, index + 1)}
                type="button"
              >
                Down
              </button>
              <button
                className="rounded-lg border border-[#D9DDE3] px-2 py-1 text-xs font-semibold text-[#666666] transition hover:border-red-300 hover:text-red-700"
                onClick={() => onRemove(item)}
                type="button"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChipGroup({
  maxSelections,
  onToggle,
  options,
  selected,
}: {
  maxSelections: number;
  onToggle: (value: string) => void;
  options: string[];
  selected: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        const isDisabled = !isSelected && selected.length >= maxSelections;
        return (
          <button
            aria-pressed={isSelected}
            className={classNames(
              "rounded-lg border px-3 py-2 text-sm font-semibold transition",
              isSelected
                ? "border-[#0A66C2] bg-[#E8F1FB] text-[#0A66C2]"
                : "border-[#D9DDE3] bg-white text-[#666666] hover:border-[#0A66C2] hover:text-[#0A66C2]",
              isDisabled && "cursor-not-allowed opacity-45 hover:border-[#D9DDE3] hover:text-[#666666]",
            )}
            disabled={isDisabled}
            key={option}
            onClick={() => onToggle(option)}
            type="button"
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function PlanLimits() {
  const comparisonRows = [
    ["Profile Intelligence Assessment", "1 per week", "Unlimited"],
    ["LinkedIn Headline Generator", "Included", "Included"],
    ["LinkedIn About Generator", "Included", "Included"],
    ["Assessment History", "Latest profile history", "Expanded tracking"],
    ["Trend Radar", "Coming soon", "Included in future Pro"],
    ["Content Intelligence", "Coming soon", "Included in future Pro"],
    ["LinkedIn Article Generator", "Coming soon", "Coming soon in Pro"],
    ["Profile Optimization Suite", "Coming soon", "Included in future Pro"],
  ];

  return (
    <section className="mt-6" id="pricing">
      <p className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4 text-sm leading-6 text-[#191919]">
        Your free plan includes one comprehensive LinkedIn profile assessment
        per week plus access to the LinkedIn Headline Generator and About
        Generator. Future Pro tools expand trend, content, profile, and brand
        intelligence.
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
            "LinkedIn headline generator",
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
            "LinkedIn Article Generator",
            "Profile Optimization Suite",
            "Personal Brand Intelligence",
            "Authority growth tracking",
          ]}
        />
      </div>
      <div className="mt-5 overflow-hidden rounded-lg border border-[#D9DDE3] bg-white">
        <div className="border-b border-[#D9DDE3] bg-[#F8F8F6] p-4">
          <h2 className="font-semibold text-[#191919]">Feature comparison</h2>
        </div>
        <div className="grid text-sm">
          <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr] gap-3 border-b border-[#D9DDE3] bg-white px-4 py-3 font-semibold text-[#191919]">
            <span>Feature</span>
            <span>Free</span>
            <span>Pro</span>
          </div>
          {comparisonRows.map(([feature, free, pro]) => (
            <div
              className="grid grid-cols-[1.2fr_0.9fr_0.9fr] gap-3 border-b border-[#D9DDE3] px-4 py-3 text-[#666666] last:border-b-0"
              key={feature}
            >
              <span className="font-semibold text-[#191919]">{feature}</span>
              <span>{free}</span>
              <span>{pro}</span>
            </div>
          ))}
        </div>
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
  onSwitchUser,
  onUpgrade,
  onViewLatest,
  profile,
}: {
  activeAssessmentId?: string;
  isLoading: boolean;
  limitMessage: string;
  onOpenAssessment: (assessmentId: string) => void;
  onRunNew: () => void;
  onSwitchUser: () => void;
  onUpgrade: () => void;
  onViewLatest: () => void;
  profile: ReturningUserProfile;
}) {
  const latest = profile.latestAssessment;
  const displayName = profile.user.name || getAssessmentDisplayName(latest);
  const firstName = displayName ? getFirstNameFromDisplayName(displayName) : getFirstName(latest);
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
            <button
              className="mt-2 text-sm font-semibold text-[#0A66C2] underline-offset-4 hover:underline"
              onClick={onSwitchUser}
              type="button"
            >
              Not you?
            </button>
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
              className={classNames(
                "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm",
                PRIMARY_CTA_CLASS,
              )}
              disabled={isLoading}
              onClick={onViewLatest}
              type="button"
            >
              <ExternalLink className="h-4 w-4" />
              View Latest Assessment
            </button>
            <button
              className={classNames(
                "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm",
                PRIMARY_CTA_CLASS,
              )}
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
                className={classNames(
                  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4",
                  PRIMARY_CTA_CLASS,
                )}
                onClick={onViewLatest}
                type="button"
              >
                <ExternalLink className="h-4 w-4" />
                View Latest Assessment
              </button>
              <button
                className={classNames(
                  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4",
                  PRIMARY_CTA_CLASS,
                )}
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
  const cardRef = useRef<HTMLElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareMessage, setShareMessage] = useState("");
  const [forceExpandedExport, setForceExpandedExport] = useState(false);

  function showToast(status: Exclude<ShareStatus, "idle" | "saving" | "sharing">, message: string) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setShareStatus(status);
    setShareMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setShareStatus("idle");
      setShareMessage("");
    }, 4800);
  }

  async function handleSaveCard() {
    const card = cardRef.current;
    if (!card) {
      showToast("error", "Could not save assessment card. Please try again.");
      return;
    }

    setShareStatus("saving");
    setForceExpandedExport(true);
    await waitForRenderFrame();

    try {
      const { toPng } = await import("html-to-image");
      const imageUrl = await toPng(card, {
        backgroundColor: "#0A192F",
        cacheBust: true,
        height: card.scrollHeight,
        pixelRatio: 3,
        style: {
          margin: "0",
          maxHeight: "none",
          overflow: "visible",
        },
        width: card.scrollWidth,
      });
      downloadDataUrl(imageUrl, ASSESSMENT_IMAGE_FILENAME);
      showToast("success", "Assessment card saved.");
    } catch (error) {
      console.error(error);
      showToast("error", "Could not save assessment card. Please try again.");
    } finally {
      setForceExpandedExport(false);
    }
  }

  async function handleLinkedInShare() {
    setShareStatus("sharing");
    const copied = await copyTextToClipboard(assessment.shareText);
    if (!copied) {
      showToast("error", "Could not copy LinkedIn text automatically. Please copy it manually.");
      return;
    }

    const linkedInTab = window.open(LINKEDIN_FEED_URL, "_blank", "noopener,noreferrer");
    showToast(
      linkedInTab ? "success" : "error",
      linkedInTab
        ? "LinkedIn share text copied. Open LinkedIn and paste it into your post."
        : "Share text copied, but LinkedIn could not open automatically.",
    );
  }

  const isCardActionRunning = shareStatus === "saving" || shareStatus === "sharing";

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

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          className={classNames(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 disabled:opacity-70 sm:w-auto",
            PRIMARY_CTA_CLASS,
          )}
          disabled={isCardActionRunning}
          onClick={handleSaveCard}
          type="button"
        >
          {shareStatus === "saving" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Save Card
        </button>
        <button
          className={classNames(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 disabled:opacity-70 sm:w-auto",
            PRIMARY_CTA_CLASS,
          )}
          disabled={isCardActionRunning}
          onClick={handleLinkedInShare}
          type="button"
        >
          {shareStatus === "sharing" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          Share on LinkedIn
        </button>
      </div>

      <AssessmentSummaryCard
        assessment={assessment}
        cardRef={cardRef}
        forceExpanded={forceExpandedExport}
      />

      <ProfileSnapshotSection assessment={assessment} />

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <PositioningSnapshotSection assessment={assessment} />
        <InfoSection eyebrow="Differentiation" title="What Makes You Unique">
          <p className="text-base leading-7 text-[#666666]">
            {assessment.whatMakesYouUnique}
          </p>
        </InfoSection>
      </div>

      <AuthorityBreakdownSection assessment={assessment} />

      <PositioningGapSection assessment={assessment} />

      <InfoSection eyebrow="Competencies" title="Top Competencies">
        <TagGrid items={assessment.topCompetencies} />
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

      {shareStatus !== "idle" && shareStatus !== "saving" && shareStatus !== "sharing" && (
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
    </div>
  );
}

function AssessmentSummaryCard({
  assessment,
  cardRef,
  forceExpanded,
}: {
  assessment: ProfileIntelligenceAssessment;
  cardRef: RefObject<HTMLElement | null>;
  forceExpanded: boolean;
}) {
  return (
    <section
      className="overflow-hidden rounded-lg border border-[#0A66C2]/20 bg-[#0A192F] text-white shadow-[0_24px_70px_rgba(10,25,47,0.22)]"
      ref={cardRef}
    >
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <AssessmentCardLogo />
        <span className="inline-flex w-fit rounded-lg border border-[#78B7F4]/25 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-[#78B7F4]">
          in-connect.app
        </span>
      </div>
      <div className="grid gap-0 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <ScoreRing score={assessment.totalScore} />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#78B7F4]">
            Authority Score
          </p>
          <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">
            {assessment.totalScore} / 100
          </h2>
          <div className="mt-5 rounded-lg border border-white/12 bg-white/[0.07] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#78B7F4]">
              Assessment Confidence
            </p>
            <p className="mt-2 text-lg font-semibold">
              {assessment.assessmentConfidence} confidence
            </p>
            <p className="mt-2 text-sm leading-6 text-white/72">
              {assessment.confidenceReason}
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:p-7">
          <ProfessionalArchetypePanel assessment={assessment} />

          <SummaryTextBlock title="Market Position">
            <ExpandableText
              className="text-base font-semibold leading-7 text-white/88"
              forceExpanded={forceExpanded}
              text={assessment.marketPosition}
            />
          </SummaryTextBlock>

          <SummaryTextBlock title="Core Positioning">
            <ExpandableText
              className="text-base leading-7 text-white/78"
              forceExpanded={forceExpanded}
              text={assessment.corePositioning}
            />
          </SummaryTextBlock>

          <div className="grid gap-4 md:grid-cols-3">
            <SummaryList title="Key Expertise Areas" items={assessment.keyExpertiseDomains} />
            <SummaryList title="Top Authority Areas" items={assessment.authorityGrowthAreas} />
            <SummaryList title="Positive Highlights" items={assessment.positiveHighlights} />
          </div>
        </div>
      </div>
    </section>
  );
}

function AssessmentCardLogo() {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="flex min-h-12 items-center">
      {!logoFailed ? (
        <img
          alt="INConnect"
          className="h-11 w-auto object-contain"
          crossOrigin="anonymous"
          decoding="async"
          onError={() => setLogoFailed(true)}
          src="/logo-dark.svg"
        />
      ) : (
        <div className="leading-tight">
          <p className="text-xl font-semibold text-white">INConnect</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#78B7F4]">
            Profile Intelligence Platform
          </p>
        </div>
      )}
    </div>
  );
}

function ProfessionalArchetypePanel({
  assessment,
}: {
  assessment: ProfileIntelligenceAssessment;
}) {
  const archetype = assessment.professionalArchetype;

  return (
    <article className="rounded-lg border border-[#78B7F4]/25 bg-white/[0.08] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <ArchetypeIcon animal={archetype.animal} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#78B7F4]">
            Professional Archetype
          </p>
          <h3 className="mt-2 text-2xl font-semibold">{archetype.animal}</h3>
          <p className="mt-1 text-lg font-semibold text-white/88">
            {archetype.label}
          </p>
          <p className="mt-3 text-sm leading-6 text-white/72">
            {archetype.explanation}
          </p>
        </div>
      </div>
    </article>
  );
}

function SummaryTextBlock({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#78B7F4]">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function SummaryList({ items, title }: { items: string[]; title: string }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#78B7F4]">
        {title}
      </p>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-white/76">
        {items.slice(0, 4).map((item) => (
          <li className="flex gap-2" key={item}>
            <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-[#78B7F4]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ExpandableText({
  className,
  forceExpanded,
  text,
}: {
  className: string;
  forceExpanded: boolean;
  text: string;
}) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [canCollapse, setCanCollapse] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const isCollapsed = canCollapse && !expanded && !forceExpanded;

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const styles = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
    setCanCollapse(element.scrollHeight > lineHeight * 5 + 1);
    setExpanded(true);
  }, [text]);

  return (
    <>
      <p
        className={className}
        ref={textRef}
        style={{
          maxHeight: isCollapsed ? "8.75rem" : undefined,
          overflow: isCollapsed ? "hidden" : undefined,
        }}
      >
        {text}
      </p>
      {canCollapse && !forceExpanded && (
        <button
          className="mt-3 text-sm font-semibold text-[#78B7F4] hover:text-white"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </>
  );
}

function ArchetypeIcon({ animal }: { animal: string }) {
  const stroke = "#0A66C2";
  const accent = "#78B7F4";
  const shapes: Record<string, ReactNode> = {
    Falcon: <path d="M14 34 L32 16 L50 34 L36 31 L32 48 L28 31 Z" />,
    Bear: <path d="M18 28 Q18 18 32 18 Q46 18 46 28 L42 46 H22 Z M22 20 L16 14 M42 20 L48 14" />,
    Wolf: <path d="M14 42 L22 18 L32 30 L42 18 L50 42 L38 36 L32 48 L26 36 Z" />,
    Lion: <path d="M16 32 L24 16 H40 L48 32 L40 48 H24 Z M25 32 H39" />,
    Owl: <path d="M18 18 H46 L40 48 H24 Z M24 28 H30 M34 28 H40 M32 34 V44" />,
    Dolphin: <path d="M12 36 Q28 16 50 27 Q38 28 32 42 Q24 34 12 36 Z M42 28 L52 20" />,
    Bull: <path d="M16 20 Q20 32 32 32 Q44 32 48 20 M22 30 L22 46 H42 L42 30 M26 38 H38" />,
    Dragon: <path d="M14 42 L24 18 L32 30 L42 18 L50 42 L38 38 L32 50 L26 38 Z M24 18 L18 14 M42 18 L48 14" />,
  };

  return (
    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-[#78B7F4]/30 bg-white">
      <svg
        aria-hidden="true"
        className="h-11 w-11"
        fill="none"
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth="3"
        viewBox="0 0 64 64"
      >
        <circle cx="32" cy="32" fill="#E8F1FB" r="27" stroke={accent} strokeWidth="2" />
        {shapes[animal] ?? shapes.Falcon}
      </svg>
    </span>
  );
}

function ProfileSnapshotSection({
  assessment,
}: {
  assessment: ProfileIntelligenceAssessment;
}) {
  const [feedbackChoice, setFeedbackChoice] = useState<"positive" | "negative" | null>(
    null,
  );
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<
    "idle" | "submitting" | "submitted" | "error"
  >("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const snapshot = assessment.profileSnapshot;
  const details = [
    ["Name", snapshot.name],
    ["Current role", snapshot.currentRole],
    ["Current company", snapshot.currentCompany],
    ["Location", snapshot.location],
    ["Estimated experience", snapshot.estimatedYearsOfExperience],
  ];
  const hasSubmittedFeedback = feedbackStatus === "submitted";

  useEffect(() => {
    setFeedbackChoice(null);
    setFeedbackText("");

    if (!assessment.assessmentId) {
      setFeedbackStatus("idle");
      setFeedbackMessage("");
      return;
    }

    try {
      const storageKey = getAssessmentFeedbackStorageKey(assessment.assessmentId);
      if (window.localStorage.getItem(storageKey) === "submitted") {
        setFeedbackStatus("submitted");
        setFeedbackMessage("Thank you for your feedback.");
        return;
      }
    } catch {
      // Local duplicate guard is best-effort; Supabase remains the source of truth.
    }

    setFeedbackStatus("idle");
    setFeedbackMessage("");
  }, [assessment.assessmentId]);

  async function submitFeedback(feedbackType: "positive" | "negative") {
    if (feedbackStatus === "submitted" || feedbackStatus === "submitting") return;
    if (!assessment.assessmentId || !assessment.userKey) {
      setFeedbackStatus("error");
      setFeedbackMessage("Feedback can be submitted after this assessment is stored.");
      return;
    }
    if (feedbackType === "negative" && !feedbackText.trim()) {
      setFeedbackStatus("error");
      setFeedbackMessage("Tell us what was inaccurate or missing.");
      return;
    }

    setFeedbackChoice(feedbackType);
    setFeedbackStatus("submitting");
    setFeedbackMessage("");

    try {
      const response = await fetch("/api/assessment-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: assessment.assessmentId,
          userKey: assessment.userKey,
          feedbackType,
          feedbackText: feedbackType === "negative" ? feedbackText : "",
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      const message =
        payload &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof payload.message === "string"
          ? payload.message
          : "";
      const error =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "";

      if (!response.ok) {
        throw new Error(error || "Feedback could not be saved.");
      }

      try {
        window.localStorage.setItem(
          getAssessmentFeedbackStorageKey(assessment.assessmentId),
          "submitted",
        );
      } catch {
        // Feedback was saved server-side; local duplicate guard is best-effort.
      }

      setFeedbackStatus("submitted");
      setFeedbackMessage(message || "Thank you for your feedback.");
    } catch (feedbackError) {
      setFeedbackStatus("error");
      setFeedbackMessage(
        feedbackError instanceof Error
          ? feedbackError.message
          : "Feedback could not be saved.",
      );
    }
  }

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

      <div className="mt-5 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-[#191919]">
            Was this assessment accurate?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={classNames(
                "inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                feedbackChoice === "positive"
                  ? "border-[#057642] bg-[#EEF7F2] text-[#057642]"
                  : "border-[#D9DDE3] bg-white text-[#191919] hover:border-[#057642]",
              )}
              disabled={hasSubmittedFeedback || feedbackStatus === "submitting"}
              onClick={() => void submitFeedback("positive")}
              type="button"
            >
              Yes
            </button>
            <button
              className={classNames(
                "inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                feedbackChoice === "negative"
                  ? "border-[#0A66C2] bg-[#E8F1FB] text-[#0A66C2]"
                  : "border-[#D9DDE3] bg-white text-[#191919] hover:border-[#0A66C2]",
              )}
              disabled={hasSubmittedFeedback || feedbackStatus === "submitting"}
              onClick={() => {
                setFeedbackChoice("negative");
                setFeedbackStatus("idle");
                setFeedbackMessage("");
              }}
              type="button"
            >
              Needs Improvement
            </button>
          </div>
        </div>

        {feedbackChoice === "negative" && !hasSubmittedFeedback && (
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-semibold text-[#191919]">
              What should be improved?
              <textarea
                className="min-h-28 rounded-lg border border-[#D9DDE3] bg-white px-3 py-3 text-sm font-normal leading-6 outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
                onChange={(event) => setFeedbackText(event.target.value)}
                placeholder="Tell us what was inaccurate or missing."
                value={feedbackText}
              />
            </label>
            <button
              className={classNames(
                "inline-flex h-11 w-fit items-center justify-center rounded-lg px-4 text-sm",
                PRIMARY_CTA_CLASS,
              )}
              disabled={feedbackStatus === "submitting" || !feedbackText.trim()}
              onClick={() => void submitFeedback("negative")}
              type="button"
            >
              {feedbackStatus === "submitting" ? "Saving Feedback..." : "Submit Feedback"}
            </button>
          </div>
        )}

        {feedbackMessage && (
          <p
            className={classNames(
              "mt-4 rounded-lg border p-3 text-sm font-semibold",
              feedbackStatus === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[#057642]/20 bg-[#EEF7F2] text-[#057642]",
            )}
          >
            {feedbackStatus === "submitted"
              ? "Thank you for your feedback."
              : feedbackMessage}
          </p>
        )}
      </div>
    </section>
  );
}

function getAssessmentFeedbackStorageKey(assessmentId: string) {
  return `inconnect:assessment-feedback:${assessmentId}`;
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
            <LockKeyhole className="mx-auto h-6 w-6 text-[#0A66C2]" />
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

function FuturePlatformModules() {
  const futureModules = [
    {
      id: "profile-optimization-suite",
      title: "Profile Optimization Suite",
      status: "Coming Soon",
      tools: [
        "Experience Rewriter",
        "Skills Optimizer",
        "LinkedIn Profile Strength Check",
        "Positioning Analyzer",
        "Keyword Optimizer",
      ],
    },
    {
      id: "personal-brand-intelligence",
      title: "Personal Brand Intelligence",
      status: "Future",
      tools: [
        "Professional Archetype Assessment",
        "Leadership Style Assessment",
        "Communication Style Assessment",
        "Personal Brand Positioning Analysis",
      ],
    },
  ];

  return (
    <section className="bg-[#F3F2EF] px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Platform Roadmap
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-[#191919]">
          Future LinkedIn intelligence modules.
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {futureModules.map((module) => (
            <article
              className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-7"
              id={module.id}
              key={module.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h3 className="text-xl font-semibold text-[#191919]">{module.title}</h3>
                <span className="w-fit rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-3 py-1 text-xs font-semibold text-[#666666]">
                  {module.status}
                </span>
              </div>
              <ul className="mt-5 grid gap-2 text-sm leading-6 text-[#666666] sm:grid-cols-2">
                {module.tools.map((tool) => (
                  <li className="flex gap-2" key={tool}>
                    <LockKeyhole className="mt-1 h-4 w-4 shrink-0 text-[#0A66C2]" />
                    {tool}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SponsoredContent() {
  const [isHidden, setIsHidden] = useState(false);
  const handleEmpty = useCallback(() => setIsHidden(true), []);

  if (!ADS_ENABLED || isHidden) return null;

  return (
    <section className="bg-[#F3F2EF] px-5 py-8 sm:px-8 lg:px-10" aria-label="Sponsored Content">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Sponsored Content
        </p>
        <AdSenseSlot onEmpty={handleEmpty} />
      </div>
    </section>
  );
}

function AdSenseSlot({ onEmpty }: { onEmpty: () => void }) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    const adElement = adRef.current;
    if (!adElement || adElement.dataset.adRequested === "true") return;

    let emptyCheckTimer: number | undefined;

    try {
      const adsWindow = window as Window & {
        adsbygoogle?: Array<Record<string, unknown>>;
      };
      adsWindow.adsbygoogle = adsWindow.adsbygoogle || [];
      adElement.dataset.adRequested = "true";
      adsWindow.adsbygoogle.push({});

      emptyCheckTimer = window.setTimeout(() => {
        const status = adElement.getAttribute("data-ad-status");
        const hasRenderedAd = Boolean(adElement.querySelector("iframe"));
        if (status === "unfilled" || (!hasRenderedAd && adElement.children.length === 0)) {
          onEmpty();
        }
      }, 5000);
    } catch {
      onEmpty();
    }

    return () => {
      if (emptyCheckTimer) window.clearTimeout(emptyCheckTimer);
    };
  }, [onEmpty]);

  return (
    <div className="mt-4 min-h-[112px] overflow-hidden rounded-lg border border-[#D9DDE3] bg-white p-3 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:min-h-[132px]">
      <ins
        className="adsbygoogle block min-h-[88px] w-full overflow-hidden sm:min-h-[108px]"
        data-ad-client={ADSENSE_PUBLISHER_ID}
        data-ad-format="auto"
        data-full-width-responsive="true"
        ref={adRef}
        style={{ display: "block" }}
      />
    </div>
  );
}

export function Footer() {
  const footerLinks = [
    { label: "About", href: "/about" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Contact", href: "/contact" },
    { label: "Vision", href: "/vision" },
    { label: "B2B Sales & LinkedIn Daily", href: "/intelligence/b2b-sales" },
  ];

  return (
    <footer
      className="border-t border-[#D9DDE3] bg-white px-5 py-8 text-[#666666] sm:px-8 lg:px-10"
      id="contact"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <Logo markSize={38} />
        <div className="flex flex-col gap-3 sm:items-end">
          <div>
            <p className="font-semibold text-[#191919]">&copy; INConnect</p>
            <p className="mt-1 text-sm">Profile Intelligence Platform</p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm font-semibold">
            {footerLinks.map((link) => (
              <a className="hover:text-[#0A66C2]" href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

function useHeadlineGeneratorIdentity() {
  const [returningIdentity, setReturningIdentity] =
    useState<StoredReturningIdentity | null>(null);

  useEffect(() => {
    const storedIdentity = readStoredReturningIdentity();
    if (!storedIdentity?.userKey) return;

    setReturningIdentity(storedIdentity);

    async function hydrateIdentity(identity: StoredReturningIdentity) {
      try {
        const params = new URLSearchParams({ userKey: identity.userKey });
        if (identity.email) params.set("email", identity.email);
        const response = await fetch(`/api/returning-user?${params.toString()}`);
        const payload = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) return;

        const nextIdentity = isReturningUserProfile(payload)
          ? {
              userKey: payload.user.userKey,
              name:
                payload.user.name ||
                getAssessmentDisplayName(payload.latestAssessment) ||
                identity.name ||
                "",
              email: payload.user.email || identity.email,
              linkedinUrl: payload.user.linkedinUrl || identity.linkedinUrl,
              latestAssessmentId: payload.latestAssessmentId,
            }
          : readReturningUserIdentityPayload(payload, identity);

        if (!nextIdentity) return;
        setReturningIdentity(nextIdentity);
        storeReturningIdentity(nextIdentity);
      } catch (error) {
        console.error("Headline generator identity lookup failed", error);
      }
    }

    void hydrateIdentity(storedIdentity);
  }, []);

  function handleSwitchUser() {
    clearReturningIdentity();
    setReturningIdentity(null);
  }

  return { returningIdentity, handleSwitchUser };
}

export function INConnectHomePage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <HeroSection />
      <ModuleGrid />
      <SponsoredContent />
      <Footer />
    </main>
  );
}

export function INConnectAssessmentPage() {
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
      if (identity.email) params.set("email", identity.email);
      if (options?.assessmentId) params.set("assessmentId", options.assessmentId);
      const response = await fetch(`/api/returning-user?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok || !isReturningUserProfile(payload)) {
        setReturningUser(null);
        return null;
      }

      setReturningUser(payload);
      const displayName =
        payload.user.name ||
        getAssessmentDisplayName(payload.latestAssessment) ||
        identity.name ||
        "";
      const nextIdentity = {
        userKey: payload.user.userKey,
        name: displayName,
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
    window.location.href = "/pricing";
  }

  function handleSwitchUser() {
    clearReturningIdentity();
    setReturningIdentity(null);
    setReturningUser(null);
    setReturningUserLimitMessage("");
    setAssessment(null);
    setAssessmentDebug(null);
    setError("");
    setLimitState(null);
  }

  async function handleAssessmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const linkedinUrl = String(formData.get("linkedinUrl") ?? "");
    const email = String(formData.get("email") ?? "");
    const hasProfileConsent = formData.get("profileConsent") === "true";
    const profilePdf = formData.get("profilePdf");
    const validationError = getAssessmentError({
      email,
      hasProfileConsent,
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
          name: getAssessmentDisplayName(nextAssessment),
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
      <Header showSocialProof />
      <section className="px-5 py-8 sm:px-8 lg:px-10" id="assessment">
        <div className="mx-auto grid max-w-7xl gap-6">
          {returningUser && (
            <WelcomeBackSection
              activeAssessmentId={assessment?.assessmentId}
              isLoading={isLoadingReturningUser}
              limitMessage={returningUserLimitMessage}
              onOpenAssessment={handleOpenAssessment}
              onRunNew={handleRunNewAssessment}
              onSwitchUser={handleSwitchUser}
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
      <SponsoredContent />
      <Footer />
    </main>
  );
}

export function INConnectHeadlineGeneratorPage() {
  const { returningIdentity, handleSwitchUser } = useHeadlineGeneratorIdentity();

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <HeadlineGenerator identity={returningIdentity} onSwitchUser={handleSwitchUser} />
      <SponsoredContent />
      <Footer />
    </main>
  );
}

export function INConnectAboutGeneratorPage() {
  const { returningIdentity, handleSwitchUser } = useHeadlineGeneratorIdentity();

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <AboutGenerator identity={returningIdentity} onSwitchUser={handleSwitchUser} />
      <SponsoredContent />
      <Footer />
    </main>
  );
}

export function INConnectArticleGeneratorPage() {
  const { returningIdentity, handleSwitchUser } = useHeadlineGeneratorIdentity();

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <ArticleGenerator identity={returningIdentity} onSwitchUser={handleSwitchUser} />
      <SponsoredContent />
      <Footer />
    </main>
  );
}

export function INConnectIntelligencePage({
  latestAirportBriefing,
  latestInsightPosts,
}: {
  latestAirportBriefing?: {
    excerpt: string;
    generatedAt: string;
    slug: string;
    title: string;
  } | null;
  latestInsightPosts: BlogPost[];
}) {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            INConnect Intelligence
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            Daily intelligence for professionals who want to stay ahead.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
            AI-curated industry briefings, market developments, technology
            trends, and business opportunities.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
          <article className="flex min-h-full flex-col rounded-lg border border-[#0A66C2]/25 bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A66C2]">
                  Active Preview
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#191919]">
                  Airport Automation Daily
                </h2>
              </div>
              <Radar className="h-8 w-8 text-[#0A66C2]" />
            </div>
            <p className="mt-4 text-sm leading-6 text-[#666666]">
              Daily developments in airport automation, baggage handling,
              passenger processing, RFID, AI, sensors, robotics, and smart
              airport infrastructure.
            </p>
            <ul className="mt-5 grid gap-2 text-sm leading-6 text-[#444444]">
              {[
                "Top airport automation stories",
                "Key companies and projects",
                "Technology trends",
                "Business opportunities",
                "Suggested LinkedIn post idea",
              ].map((item) => (
                <li className="flex gap-2" key={item}>
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[#057642]" />
                  {item}
                </li>
              ))}
            </ul>
            {latestAirportBriefing && (
              <a
                className="mt-5 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 transition hover:border-[#0A66C2]/40 hover:bg-white"
                href={`/intelligence/airport-automation/${latestAirportBriefing.slug}`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
                  Latest briefing
                </p>
                <h3 className="mt-2 text-base font-semibold leading-snug text-[#191919]">
                  {latestAirportBriefing.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#666666]">
                  {latestAirportBriefing.excerpt}
                </p>
              </a>
            )}
            <a
              className={classNames(
                "mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm",
                PRIMARY_CTA_CLASS,
              )}
              href="/intelligence/airport-automation"
            >
              Unlock Briefing
            </a>
          </article>

          <article className="flex min-h-full flex-col rounded-lg border border-[#0A66C2]/25 bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#057642]">
                  Active
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#191919]">
                  B2B Sales & LinkedIn Daily
                </h2>
              </div>
              <FileText className="h-8 w-8 text-[#0A66C2]" />
            </div>
            <p className="mt-4 text-sm leading-6 text-[#666666]">
              Daily insights from INConnect's B2B Sales & LinkedIn Daily stream
              covering LinkedIn growth, profile optimization, B2B visibility,
              personal branding, AI tools, and professional authority.
            </p>
            <div className="mt-5 grid gap-3">
              {latestInsightPosts.length > 0 ? (
                latestInsightPosts.map((post) => (
                  <a
                    className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 transition hover:border-[#0A66C2]/40 hover:bg-white"
                    href={`/blog/${post.slug}`}
                    key={post.slug}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
                      {post.category}
                    </p>
                    <h3 className="mt-2 text-base font-semibold leading-snug text-[#191919]">
                      {post.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#666666]">
                      {post.excerpt}
                    </p>
                  </a>
                ))
              ) : (
                <p className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4 text-sm leading-6 text-[#666666]">
                  INConnect intelligence insights will appear here as soon as
                  published briefings are available.
                </p>
              )}
            </div>
            <a
              className={classNames(
                "mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm",
                PRIMARY_CTA_CLASS,
              )}
              href="/intelligence/b2b-sales"
            >
              Read Latest Insights
            </a>
          </article>

          {[
            {
              description:
                "Daily signals across connected transport, urban mobility, fleets, logistics, and autonomous systems.",
              href: "/intelligence/smart-mobility",
              title: "Smart Mobility Daily",
            },
            {
              description:
                "Daily developments in factory automation, robotics, industrial AI, sensors, controls, and smart infrastructure.",
              href: "/intelligence/industrial-automation",
              title: "Industrial Automation Daily",
            },
          ].map((stream) => (
            <article
              className="flex min-h-full flex-col rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-5 shadow-[0_8px_24px_rgba(10,25,47,0.04)] sm:p-6"
              key={stream.title}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#666666]">
                    Coming Soon
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#191919]">
                    {stream.title}
                  </h2>
                </div>
                <LockKeyhole className="h-8 w-8 text-[#0A66C2]" />
              </div>
              <p className="mt-4 text-sm leading-6 text-[#666666]">
                {stream.description}
              </p>
              <a
                className="mt-5 rounded-lg border border-[#D9DDE3] bg-white px-4 py-3 text-center text-sm font-semibold text-[#666666] transition hover:border-[#0A66C2]/40 hover:text-[#0A66C2]"
                href={stream.href}
              >
                Coming Soon
              </a>
            </article>
          ))}
        </div>
      </section>
      <SponsoredContent />
      <Footer />
    </main>
  );
}

export function INConnectPricingPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-[#F3F2EF] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Pricing
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-[#191919]">
            Choose the right INConnect plan.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#666666]">
            Start with free profile intelligence, headline generation, and About
            section generation. Pro expands into trend, content, profile, and
            personal brand tools.
          </p>
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
      <SponsoredContent />
      <Footer />
    </main>
  );
}

export function INConnectPlatform() {
  return <INConnectHomePage />;
}
