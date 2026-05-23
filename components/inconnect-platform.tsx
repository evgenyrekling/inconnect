"use client";

import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Copy,
  Database,
  ExternalLink,
  Globe2,
  GripVertical,
  Layers3,
  LineChart,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Radar,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserRound,
  WalletCards,
  Zap,
} from "lucide-react";
import { toPng } from "html-to-image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createShareText,
  type DetectedArea,
  inferProfile,
  type MockUserRecord,
  professionalAreas,
  profileForPrimaryArea,
  type AreaProfile,
} from "@/lib/mock-intelligence";
import { Logo } from "@/components/Logo";

type Stage = "idle" | "scanning" | "areas" | "results";
type ShareStatus = "idle" | "sharing" | "success" | "error";

const LINKEDIN_FEED_URL = "https://www.linkedin.com/feed/";
const SCORE_IMAGE_FILENAME = "inconnect-authority-score.png";

const scanningSteps = [
  "Analyzing LinkedIn profile",
  "Detecting professional expertise",
  "Identifying relevant industries",
  "Checking company positioning",
  "Scanning relevant trends",
  "Preparing LinkedIn growth assessment",
];

const navItems = [
  { label: "Assessment", href: "#assessment" },
  { label: "Features", href: "#features" },
  { label: "Trend Radar", href: "#trend-radar" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

const featureCards = [
  {
    title: "Profile Positioning",
    copy: "Turns LinkedIn signals into executive-level positioning insights.",
    icon: UserRound,
  },
  {
    title: "Professional Area Detection",
    copy: "Finds the expertise clusters that shape your authority lane.",
    icon: Layers3,
  },
  {
    title: "Trend Radar",
    copy: "Connects your expertise with timely conversations in your market.",
    icon: Radar,
  },
  {
    title: "Content Opportunity Engine",
    copy: "Creates premium topic angles without feeling like a generic writing tool.",
    icon: LineChart,
  },
];

const trendRadarCards = [
  {
    title: "AI leadership signals",
    momentum: "High signal",
    summary:
      "Track where AI is reshaping professional positioning and executive-level conversations.",
  },
  {
    title: "Professional growth themes",
    momentum: "Rising",
    summary:
      "Spot content angles that connect expertise, credibility, and career authority.",
  },
  {
    title: "Market timing opportunities",
    momentum: "Now",
    summary:
      "Identify timely LinkedIn topics before they become saturated category noise.",
  },
];

const builtForAreas = [
  ["Industrial Automation", "Technical authority and smart infrastructure"],
  ["Hospitality & Hotels", "Guest experience and operations leadership"],
  ["Logistics & Supply Chain", "Flow, resilience, and automation signals"],
  ["Robotics & AI", "Human-machine systems and intelligent automation"],
  ["Smart Mobility", "Connected infrastructure and movement systems"],
  ["Healthcare", "Care systems, operations, and patient experience"],
  ["Finance", "Trust, transformation, and market education"],
  ["Consulting", "Executive insight and transformation leadership"],
  ["Real Estate", "Market positioning and asset strategy"],
  ["Manufacturing Technology", "Operational excellence and product systems"],
  ["Marketing & Sales", "Revenue insight and category authority"],
  ["Education", "Learning systems and professional knowledge transfer"],
];

const pricing = [
  {
    name: "FREE",
    price: "0",
    cadence: "unlimited assessments",
    features: [
      "Unlimited LinkedIn profile assessments",
      "Limited result depth",
      "1 personalized topic idea per assessment",
      "3 trend insights per assessment",
      "Shareable authority score",
    ],
  },
  {
    name: "PRO",
    price: "5",
    cadence: "per month",
    featured: true,
    features: [
      "Unlimited assessments",
      "Unlimited personalized post ideas",
      "Full Trend Radar",
      "Deeper profile analysis",
      "Company positioning analysis",
      "Weekly content roadmap",
      "Saved idea history",
      "Advanced industry-specific hooks",
    ],
  },
];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function createAreaId(name: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getPrimaryArea(areas: DetectedArea[]) {
  return areas[0]?.name ?? "Technology";
}

function saveMockUser(record: MockUserRecord) {
  window.localStorage.setItem("inconnect.mockUser", JSON.stringify(record));
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
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

function ScoreRing({ score }: { score: number }) {
  const degrees = Math.round((score / 100) * 360);

  return (
    <div
      aria-label={`LinkedIn Authority Score ${score} out of 100`}
      className="grid h-40 w-40 place-items-center rounded-full p-2 shadow-[0_16px_34px_rgba(10,25,47,0.16)]"
      style={{
        background: `conic-gradient(#0A66C2 0deg ${degrees}deg, #DADCE0 ${degrees}deg 360deg)`,
      }}
    >
      <div className="grid h-full w-full place-items-center rounded-full border border-[#DADCE0] bg-white text-center">
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

function SectionEyebrow({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: typeof Sparkles;
}) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
      <Icon className="h-4 w-4" />
      {children}
    </p>
  );
}

function HeroKeyVisual() {
  const authoritySignals = [
    ["Profile clarity", "92%"],
    ["Authority fit", "84%"],
    ["Trend match", "78%"],
  ];
  const trendSignals = ["AI leadership", "Professional growth", "Market timing"];

  return (
    <div
      aria-label="AI-powered professional growth and LinkedIn authority platform preview."
      className="relative mx-auto min-h-[520px] w-full max-w-xl sm:min-h-[560px] lg:ml-auto lg:min-h-[590px]"
      role="img"
    >
      <div className="hero-visual-grid absolute inset-0 rounded-[28px] border border-white/12 bg-white/[0.04]" />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 560 590"
      >
        <defs>
          <linearGradient id="heroSignalGradient" x1="74" x2="484" y1="92" y2="446">
            <stop stopColor="#78B7F4" stopOpacity="0.18" />
            <stop offset="0.52" stopColor="#0A66C2" stopOpacity="0.55" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.16" />
          </linearGradient>
        </defs>
        <path
          className="hero-signal-path"
          d="M72 160 C162 102 246 125 316 208 C384 286 430 290 500 248"
          fill="none"
          stroke="url(#heroSignalGradient)"
          strokeWidth="2"
        />
        <path
          className="hero-signal-path hero-signal-path-delayed"
          d="M94 420 C178 342 250 368 318 300 C386 232 452 208 520 142"
          fill="none"
          stroke="url(#heroSignalGradient)"
          strokeWidth="2"
        />
        {[
          [72, 160],
          [214, 128],
          [316, 208],
          [500, 248],
          [94, 420],
          [318, 300],
          [520, 142],
        ].map(([cx, cy]) => (
          <circle
            className="hero-node-pulse"
            cx={cx}
            cy={cy}
            fill="#FFFFFF"
            key={`${cx}-${cy}`}
            r="4"
            stroke="#0A66C2"
            strokeWidth="2"
          />
        ))}
      </svg>

      <div className="hero-float-card relative ml-auto mt-10 w-full rounded-lg border border-[#DADCE0] bg-white p-4 text-[#191919] shadow-[0_26px_70px_rgba(0,0,0,0.26)] sm:w-[94%] sm:p-5">
        <div className="flex items-center justify-between border-b border-[#DADCE0] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#0A66C2]">
              INConnect growth intelligence
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              LinkedIn authority dashboard
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] px-3 py-2 text-xs font-semibold text-[#0A66C2]">
            <span className="h-2 w-2 rounded-full bg-[#057642]" />
            Live preview
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.78fr_1fr]">
          <div className="rounded-lg border border-[#DADCE0] bg-[#F8F8F6] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#666666]">
              Authority score
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div
                className="grid h-24 w-24 shrink-0 place-items-center rounded-full p-1.5"
                style={{
                  background:
                    "conic-gradient(#0A66C2 0deg 266deg, #DADCE0 266deg 360deg)",
                }}
              >
                <div className="grid h-full w-full place-items-center rounded-full bg-white">
                  <div className="text-center">
                    <p className="text-3xl font-semibold">74</p>
                    <p className="text-[10px] font-semibold uppercase text-[#0A66C2]">
                      / 100
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Strong authority potential</p>
                <p className="mt-2 text-xs leading-5 text-[#666666]">
                  Your expertise is forming a clear LinkedIn positioning lane.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#DADCE0] bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Profile analytics</p>
              <LineChart className="h-4 w-4 text-[#0A66C2]" />
            </div>
            <div className="mt-4 grid gap-3">
              {authoritySignals.map(([label, value]) => (
                <div className="grid gap-2" key={label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#666666]">{label}</span>
                    <span className="font-semibold text-[#191919]">{value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#DADCE0]">
                    <div
                      className="h-full rounded-full bg-[#0A66C2]"
                      style={{ width: value }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.82fr]">
          <div className="rounded-lg border border-[#DADCE0] bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Trend radar</p>
              <Radar className="h-4 w-4 text-[#0A66C2]" />
            </div>
            <div className="mt-4 grid gap-2">
              {trendSignals.map((signal, index) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-[#DADCE0] bg-[#F8F8F6] px-3 py-2 text-xs"
                  key={signal}
                >
                  <span className="font-medium">{signal}</span>
                  <span className="text-[#0A66C2]">
                    {index === 0 ? "High" : index === 1 ? "Rising" : "Now"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden rounded-lg border border-[#DADCE0] bg-[#0A192F] p-4 text-white md:block">
            <p className="text-xs uppercase tracking-[0.18em] text-white/55">
              Network signals
            </p>
            <div className="mt-4 flex items-end gap-2">
              {[46, 68, 54, 82, 76, 94, 88].map((height, index) => (
                <div
                  className="flex-1 rounded-t-sm bg-[#78B7F4]"
                  key={height}
                  style={{
                    height: `${height}px`,
                    opacity: 0.34 + index * 0.08,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hero-float-card hero-float-card-delayed absolute bottom-4 left-0 hidden w-72 rounded-lg border border-[#DADCE0] bg-white p-4 text-[#191919] shadow-[0_18px_48px_rgba(0,0,0,0.22)] lg:block">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#E8F1FB] text-[#0A66C2]">
            <UserRound className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Professional positioning</p>
            <p className="mt-1 text-xs text-[#666666]">
              Expertise, trends, and audience fit aligned.
            </p>
          </div>
        </div>
      </div>

      <div className="hero-float-card absolute right-2 top-0 hidden rounded-lg border border-white/15 bg-[#0A192F] px-4 py-3 text-white shadow-[0_18px_44px_rgba(0,0,0,0.24)] sm:block">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BadgeCheck className="h-4 w-4 text-[#78B7F4]" />
          Authority path detected
        </div>
      </div>
    </div>
  );
}

function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#0A192F] text-white">
      <div className="absolute inset-0 tech-grid opacity-65" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(10,25,47,0.98),rgba(10,25,47,0.94)_58%,rgba(10,102,194,0.22))]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a className="flex items-center gap-3" href="#" aria-label="INConnect home">
          <Logo tone="dark" />
        </a>

        <nav className="hidden items-center gap-1 text-sm text-white/75 lg:flex">
          {navItems.map((item) => (
            <a
              className="rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <a
          className="hidden h-10 items-center justify-center rounded-lg border border-white/15 bg-white/[0.08] px-4 text-sm font-semibold text-white transition hover:border-[#0A66C2]/60 hover:bg-[#0A66C2]/15 md:inline-flex"
          href="#assessment"
        >
          Start free
        </a>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-80px)] max-w-7xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:px-10">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.08] px-3 py-2 text-sm text-white/90">
            <Sparkles className="h-4 w-4 text-[#78B7F4]" />
            AI-Powered LinkedIn Assistant for Professionals
          </div>

          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] text-white sm:text-6xl lg:text-7xl">
            Turn Professional Expertise Into LinkedIn Authority.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
            AI-powered LinkedIn profile analysis, professional area detection,
            trend discovery, and personalized content ideas for professionals
            across industries.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-5 font-semibold text-white shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition hover:bg-[#004182]"
              href="#assessment"
            >
              Analyze My LinkedIn Profile
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              className="inline-flex h-12 items-center justify-center rounded-lg border border-white/15 bg-white/[0.08] px-5 font-semibold text-white transition hover:border-white/30 hover:bg-white/15"
              href="#features"
            >
              Explore platform
            </a>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Positioning", "Authority score"],
              ["Detection", "Expertise areas"],
              ["Radar", "Trend insights"],
            ].map(([label, value]) => (
              <div
                className="rounded-lg border border-white/12 bg-white/[0.06] p-4"
                key={label}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                  {label}
                </p>
                <p className="mt-2 font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <HeroKeyVisual />
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="bg-[#F3F2EF] px-5 py-16 text-[#191919] sm:px-8 sm:py-20 lg:px-10" id="features">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 border-b border-[#DADCE0] pb-8 lg:grid-cols-[0.75fr_1fr] lg:items-end">
          <div>
            <SectionEyebrow icon={Target}>Features</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
              Built for LinkedIn growth with professional context.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#666666]">
            INConnect is structured around positioning, area detection, trend
            relevance, and shareable authority signals. It is not a generic AI
            writing surface.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((feature) => (
            <article
              className="group rounded-lg border border-[#DADCE0] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#0A66C2]/35 hover:shadow-[0_14px_34px_rgba(10,25,47,0.1)]"
              key={feature.title}
            >
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-[#DADCE0] bg-[#E8F1FB] text-[#0A66C2] transition group-hover:border-[#0A66C2]/35">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#666666]">
                {feature.copy}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrendRadarSection() {
  return (
    <section
      className="bg-[#F3F2EF] px-5 py-16 text-[#191919] sm:px-8 sm:py-20 lg:px-10"
      id="trend-radar"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 border-b border-[#DADCE0] pb-8 lg:grid-cols-[0.78fr_1fr] lg:items-end">
          <div>
            <SectionEyebrow icon={Radar}>Trend Radar</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
              See which LinkedIn conversations match your authority lane.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#666666]">
            INConnect connects your detected expertise with professional trends,
            market timing, and content angles that can strengthen LinkedIn
            authority.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {trendRadarCards.map((trend) => (
            <article
              className="rounded-lg border border-[#DADCE0] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]"
              key={trend.title}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#DADCE0] bg-[#E8F1FB] text-[#0A66C2]">
                  <Radar className="h-5 w-5" />
                </span>
                <span className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] px-2 py-1 text-xs font-semibold text-[#0A66C2]">
                  {trend.momentum}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{trend.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#666666]">
                {trend.summary}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileInput({
  email,
  isScanning,
  linkedInUrl,
  onEmail,
  onLinkedInUrl,
  onSubmit,
}: {
  email: string;
  isScanning: boolean;
  linkedInUrl: string;
  onEmail: (value: string) => void;
  onLinkedInUrl: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const canSubmit =
    linkedInUrl.trim().length > 0 && email.trim().length > 0 && isValidEmail(email);

  return (
    <form
      className="rounded-lg border border-[#DADCE0] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)]"
      onSubmit={onSubmit}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#DADCE0] pb-5">
        <div>
          <h3 className="text-xl font-semibold text-[#191919]">
            Analyze your LinkedIn profile
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#666666]">
            Enter your LinkedIn profile and email to receive your free LinkedIn
            Authority Assessment.
          </p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#E8F1FB] text-[#0A66C2]">
          <ScanLine className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-[#191919]">
          LinkedIn profile URL
          <input
            className="h-12 w-full rounded-lg border border-[#DADCE0] bg-white px-3 text-[#191919] outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
            onChange={(event) => onLinkedInUrl(event.target.value)}
            placeholder="https://www.linkedin.com/in/alex-morgan"
            required
            type="url"
            value={linkedInUrl}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-[#191919]">
          Email address
          <input
            className="h-12 w-full rounded-lg border border-[#DADCE0] bg-white px-3 text-[#191919] outline-none transition placeholder:text-[#666666] focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
            autoComplete="email"
            inputMode="email"
            onChange={(event) => onEmail(event.target.value)}
            placeholder="name@company.com"
            required
            type="email"
            value={email}
          />
        </label>
      </div>

      <p className="mt-5 flex items-start gap-2 rounded-lg border border-[#DADCE0] bg-[#F8F8F6] p-3 text-sm leading-6 text-[#666666]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#057642]" />
        We respect your privacy and never post to LinkedIn automatically.
      </p>

      <button
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 font-semibold text-white transition hover:bg-[#004182] disabled:cursor-not-allowed disabled:bg-[#DADCE0] disabled:text-[#666666]"
        disabled={isScanning || !canSubmit}
        type="submit"
      >
        {isScanning ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Analyze Profile
      </button>
    </form>
  );
}

function Scanner({
  activeStep,
  isScanning,
}: {
  activeStep: number;
  isScanning: boolean;
}) {
  const progress = isScanning
    ? Math.max(8, Math.round(((activeStep + 1) / scanningSteps.length) * 100))
    : 0;

  return (
    <section className="rounded-lg border border-[#DADCE0] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)]">
      <div className="flex items-center justify-between gap-4 border-b border-[#DADCE0] pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            AI scanning flow
          </p>
          <h3 className="mt-2 text-2xl font-semibold">
            LinkedIn growth scan
          </h3>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#E8F1FB] text-[#0A66C2]">
          <ScanLine className="h-6 w-6" />
        </span>
      </div>

      <div className="mt-5">
        <div className="mb-4 flex items-center justify-between text-sm text-[#666666]">
          <span>Analysis progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#DADCE0]">
          <div
            className="h-full rounded-full bg-[#0A66C2] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ol className="mt-6 grid gap-3">
        {scanningSteps.map((step, index) => {
          const complete = isScanning && index < activeStep;
          const current = isScanning && index === activeStep;

          return (
            <li
              className={classNames(
                "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition",
                complete && "border-[#057642]/25 bg-[#EEF7F2] text-[#191919]",
                current &&
                  "scanner-active border-[#0A66C2]/45 bg-[#E8F1FB] text-[#191919]",
                !complete &&
                  !current &&
                  "border-[#DADCE0] bg-[#F8F8F6] text-[#666666]",
              )}
              key={step}
            >
              {complete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#057642]" />
              ) : current ? (
                <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-[#0A66C2]" />
              ) : (
                <CircleDashed className="h-4 w-4 shrink-0" />
              )}
              {step}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function AreaDetection({
  areas,
  onAddArea,
  onConfirm,
  onMoveArea,
  onPrimaryArea,
  onRemoveArea,
  primaryArea,
  selectedAddArea,
  setSelectedAddArea,
}: {
  areas: DetectedArea[];
  onAddArea: () => void;
  onConfirm: () => void;
  onMoveArea: (index: number, direction: -1 | 1) => void;
  onPrimaryArea: (areaName: string) => void;
  onRemoveArea: (id: string) => void;
  primaryArea: string;
  selectedAddArea: string;
  setSelectedAddArea: (value: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#DADCE0] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)]">
      <div className="grid gap-4 border-b border-[#DADCE0] pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Professional area detection
          </p>
          <h3 className="mt-2 text-2xl font-semibold">
            Confirm your authority lane
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666666]">
            INConnect uses mock detection for now. Edit the professional areas,
            choose your primary area, then reveal the free assessment.
          </p>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 font-semibold text-white transition hover:bg-[#004182]"
          onClick={onConfirm}
          type="button"
        >
          Confirm areas
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        {areas.map((area, index) => {
          const isPrimary = area.name === primaryArea;

          return (
            <article
              className={classNames(
                "grid gap-4 rounded-lg border p-4 transition md:grid-cols-[1fr_auto]",
                isPrimary
                  ? "border-[#0A66C2]/45 bg-[#E8F1FB]"
                  : "border-[#DADCE0] bg-white",
              )}
              key={area.id}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-1 text-[#666666]">
                  <GripVertical className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-[#191919]">{area.name}</h4>
                    {isPrimary && (
                      <span className="rounded-lg bg-[#0A66C2] px-2 py-1 text-xs font-semibold text-white">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 w-36 overflow-hidden rounded-full bg-[#DADCE0]">
                      <div
                        className="h-full rounded-full bg-[#0A66C2]"
                        style={{ width: `${area.confidence}%` }}
                      />
                    </div>
                    <span className="text-sm text-[#666666]">
                      {area.confidence}% confidence
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <button
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[#DADCE0] bg-white px-3 text-sm text-[#666666] transition hover:border-[#0A66C2]/35 hover:text-[#0A66C2] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => onMoveArea(index, -1)}
                  type="button"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[#DADCE0] bg-white px-3 text-sm text-[#666666] transition hover:border-[#0A66C2]/35 hover:text-[#0A66C2] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={index === areas.length - 1}
                  onClick={() => onMoveArea(index, 1)}
                  type="button"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#DADCE0] bg-white px-3 text-sm text-[#191919] transition hover:border-[#0A66C2]/35 hover:text-[#0A66C2]"
                  onClick={() => onPrimaryArea(area.name)}
                  type="button"
                >
                  <Star className="h-4 w-4" />
                  Set primary
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#DADCE0] bg-white px-3 text-sm text-[#666666] transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={areas.length <= 1}
                  onClick={() => onRemoveArea(area.id)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 rounded-lg border border-[#DADCE0] bg-[#F8F8F6] p-4 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-2 text-sm font-medium text-[#191919]">
          Manually add area
          <select
            className="h-11 w-full rounded-lg border border-[#DADCE0] bg-white px-3 text-[#191919] outline-none transition focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/15"
            onChange={(event) => setSelectedAddArea(event.target.value)}
            value={selectedAddArea}
          >
            {professionalAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg border border-[#0A66C2]/25 bg-white px-4 font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB]"
          onClick={onAddArea}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Add area
        </button>
      </div>
    </section>
  );
}

function ScoreHero({
  areas,
  profile,
}: {
  areas: DetectedArea[];
  profile: AreaProfile;
}) {
  return (
    <section className="rounded-lg border border-[#0A66C2]/20 bg-[#0A192F] p-5 text-white shadow-[0_24px_70px_rgba(10,25,47,0.2)] sm:p-7">
      <div className="grid gap-7 lg:grid-cols-[auto_1fr] lg:items-center">
        <ScoreRing score={profile.score} />

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#78B7F4]">
            LinkedIn Authority Score
          </p>
          <h3 className="mt-3 text-3xl font-semibold sm:text-5xl">
            {profile.score} / 100
          </h3>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/75">
            You are positioned at the intersection of:
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {areas.slice(0, 3).map((area) => (
              <li
                className="flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.07] px-3 py-2 text-sm font-semibold"
                key={area.id}
              >
                <Check className="h-4 w-4 text-[#78B7F4]" />
                {area.name}
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/75">
            Your profile demonstrates strong professional expertise and clear
            positioning within your industry ecosystem.
          </p>
        </div>
      </div>
    </section>
  );
}

function ShareScoreCard({
  areas,
  copied,
  onCopy,
  profile,
  shareText,
}: {
  areas: DetectedArea[];
  copied: boolean;
  onCopy: () => void;
  profile: AreaProfile;
  shareText: string;
}) {
  const primary = getPrimaryArea(areas);
  const cardRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function showToast(status: Exclude<ShareStatus, "idle" | "sharing">, message: string) {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setShareStatus(status);
    setShareMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setShareStatus("idle");
      setShareMessage("");
    }, 4200);
  }

  async function handleLinkedInShare() {
    const card = cardRef.current;
    const linkedInTab = window.open("about:blank", "_blank");

    if (linkedInTab) {
      linkedInTab.opener = null;
    }

    try {
      if (!card) {
        throw new Error("Share card is not ready yet.");
      }

      setShareStatus("sharing");
      setShareMessage("");

      const imageUrl = await toPng(card, {
        backgroundColor: "#FFFFFF",
        cacheBust: true,
        pixelRatio: 2,
        style: {
          margin: "0",
        },
      });

      downloadDataUrl(imageUrl, SCORE_IMAGE_FILENAME);

      const copiedText = await copyTextToClipboard(shareText);
      if (!copiedText) {
        throw new Error("Could not copy the LinkedIn post text.");
      }

      if (linkedInTab) {
        linkedInTab.location.href = LINKEDIN_FEED_URL;
      } else {
        window.open(LINKEDIN_FEED_URL, "_blank", "noopener,noreferrer");
      }

      showToast(
        "success",
        "Score image downloaded and LinkedIn post copied.",
      );
    } catch (error) {
      linkedInTab?.close();
      console.error(error);
      showToast(
        "error",
        "Could not prepare the LinkedIn share. Please try again.",
      );
    }
  }

  return (
    <section className="rounded-lg border border-[#DADCE0] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Shareable score card
          </p>
          <h3 className="mt-3 text-3xl font-semibold">
            Share Your LinkedIn Authority Score
          </h3>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            See how your professional authority compares across industries.
            Share your score on LinkedIn.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 font-semibold text-white transition hover:bg-[#004182]"
              onClick={onCopy}
              type="button"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied" : "Copy LinkedIn Post"}
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#DADCE0] bg-white px-4 font-semibold text-[#191919] transition hover:border-[#0A66C2]/35 hover:text-[#0A66C2] disabled:cursor-wait disabled:opacity-70"
              disabled={shareStatus === "sharing"}
              onClick={handleLinkedInShare}
              type="button"
            >
              {shareStatus === "sharing" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {shareStatus === "sharing"
                ? "Preparing share..."
                : "Download & Share on LinkedIn"}
            </button>
          </div>
        </div>

        <div
          className="share-card rounded-lg border border-[#DADCE0] bg-white p-5 shadow-[0_12px_34px_rgba(10,25,47,0.1)]"
          ref={cardRef}
        >
          <div className="flex items-center justify-between border-b border-[#DADCE0] pb-4">
            <div className="flex items-center gap-3">
              <Logo markSize={40} showSubtitle={false} />
              <div>
                <p className="text-xs text-[#666666]">
                  Turn Professional Expertise Into LinkedIn Authority.
                </p>
              </div>
            </div>
            <span className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
              Free assessment
            </span>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
            <ScoreRing score={profile.score} />
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[#666666]">
                LinkedIn Authority Score
              </p>
              <p className="mt-3 text-4xl font-semibold">{profile.score} / 100</p>
              <p className="mt-3 text-sm text-[#666666]">
                Primary Professional Area
              </p>
              <p className="mt-1 text-lg font-semibold text-[#0A66C2]">{primary}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-[#191919]">
                Strong Authority Potential In:
              </p>
              <ul className="mt-3 grid gap-2 text-sm text-[#666666]">
                {profile.strongAuthorityPotential.map((item) => (
                  <li className="flex items-center gap-2" key={item}>
                    <BadgeCheck className="h-4 w-4 text-[#057642]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#191919]">
                Top Expertise Areas
              </p>
              <ul className="mt-3 grid gap-2 text-sm text-[#666666]">
                {areas.slice(0, 3).map((area) => (
                  <li className="flex items-center gap-2" key={area.id}>
                    <BadgeCheck className="h-4 w-4 text-[#057642]" />
                    {area.name}
                  </li>
                ))}
              </ul>
            </div>
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

function Results({
  areas,
  profile,
}: {
  areas: DetectedArea[];
  profile: AreaProfile;
}) {
  const [copied, setCopied] = useState(false);
  const shareText = useMemo(
    () => createShareText(profile.score, areas),
    [areas, profile.score],
  );

  async function handleCopy() {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="grid gap-6">
      <ScoreHero areas={areas} profile={profile} />
      <ShareScoreCard
        areas={areas}
        copied={copied}
        onCopy={handleCopy}
        profile={profile}
        shareText={shareText}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {profile.strengths.map((strength) => (
          <article
            className="rounded-lg border border-[#DADCE0] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.05)]"
            key={strength}
          >
            <BadgeCheck className="h-5 w-5 text-[#057642]" />
            <h3 className="mt-4 text-lg font-semibold">{strength}</h3>
            <p className="mt-3 text-sm leading-6 text-[#666666]">
              A strong signal for professional visibility and credible
              LinkedIn authority.
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-[#DADCE0] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Visibility potential
        </p>
        <h3 className="mt-3 text-2xl font-semibold">
          Your strongest visibility potential is in:
        </h3>
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {profile.authorityPotential.map((item) => (
            <li
              className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4 text-sm font-semibold text-[#191919]"
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-[#DADCE0] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Visibility Opportunities
        </p>
        <div className="mt-5 grid gap-3">
          {profile.opportunities.map((opportunity) => (
            <article
              className="flex gap-3 rounded-lg border border-[#DADCE0] bg-[#F8F8F6] p-4"
              key={opportunity}
            >
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#0A66C2]" />
              <p className="text-sm leading-6 text-[#666666]">{opportunity}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="rounded-lg border border-[#DADCE0] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7"
      >
        <div className="flex flex-col gap-4 border-b border-[#DADCE0] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
              Trend Radar
            </p>
            <h3 className="mt-3 text-2xl font-semibold">
              Trends matched to your professional area
            </h3>
          </div>
          <span className="rounded-lg border border-[#DADCE0] bg-[#F8F8F6] px-3 py-2 text-xs font-semibold text-[#666666]">
            3 visible on Free
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {profile.trends.slice(0, 3).map((trend) => (
            <article
              className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4"
              key={trend.title}
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold">{trend.title}</h4>
                <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#0A66C2]">
                  {trend.momentum}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#666666]">
                {trend.summary}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {profile.trends.slice(3).map((trend) => (
            <article
              className="relative overflow-hidden rounded-lg border border-[#DADCE0] bg-[#F8F8F6] p-4"
              key={trend.title}
            >
              <div className="opacity-35">
                <h4 className="font-semibold">{trend.title}</h4>
                <p className="mt-3 text-sm leading-6 text-[#666666]">
                  {trend.summary}
                </p>
              </div>
              <div className="absolute inset-0 grid place-items-center bg-white/72">
                <span className="inline-flex items-center gap-2 rounded-lg border border-[#0A66C2]/20 bg-white px-3 py-2 text-sm font-semibold text-[#0A66C2] shadow-[0_10px_22px_rgba(10,25,47,0.1)]">
                  <LockKeyhole className="h-4 w-4" />
                  Unlock full Trend Radar in Pro.
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#DADCE0] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[0.82fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
              Personalized Topic Idea
            </p>
            <h3 className="mt-3 text-2xl font-semibold">
              {profile.topic.title}
            </h3>
            <p className="mt-4 text-lg leading-8 text-[#191919]">
              {profile.topic.hook}
            </p>
          </div>

          <div className="grid gap-4">
            <article className="rounded-lg border border-[#DADCE0] bg-[#F8F8F6] p-4">
              <p className="text-sm font-semibold text-[#0A66C2]">
                Why this matters now
              </p>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                {profile.topic.whyNow}
              </p>
            </article>
            <article className="rounded-lg border border-[#DADCE0] bg-[#F8F8F6] p-4">
              <p className="text-sm font-semibold text-[#0A66C2]">CTA</p>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                {profile.topic.cta}
              </p>
            </article>
            <div className="flex flex-wrap gap-2">
              {profile.topic.hashtags.map((hashtag) => (
                <span
                  className="rounded-lg border border-[#DADCE0] bg-white px-3 py-2 text-xs font-semibold text-[#0A66C2]"
                  key={hashtag}
                >
                  {hashtag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4 text-sm leading-6 text-[#191919]">
          Unlock unlimited personalized post ideas tailored to your expertise,
          industry, and trends with Pro.
        </div>
      </section>

      <section className="rounded-lg border border-[#0A66C2]/25 bg-[#0A192F] p-5 text-white shadow-[0_18px_54px_rgba(10,25,47,0.18)] sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#78B7F4]">
              Pro Upgrade CTA
            </p>
            <h3 className="mt-3 text-3xl font-semibold">
              Unlock unlimited personalized post ideas tailored to your
              expertise, industry, and trends with Pro.
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/75">
              Future Stripe checkout will connect here. Current prototype uses a
              placeholder action only.
            </p>
          </div>
          <a
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-5 font-semibold text-white transition hover:bg-[#004182]"
            href="#pricing"
          >
            Upgrade to Pro
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <p className="text-xs text-[#666666]">
        Mock data only. No LinkedIn posting or profile scraping is active in this MVP.
      </p>
    </div>
  );
}

function AssessmentSection() {
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [activeStep, setActiveStep] = useState(0);
  const [profile, setProfile] = useState<AreaProfile | null>(null);
  const [areas, setAreas] = useState<DetectedArea[]>([]);
  const [primaryArea, setPrimaryArea] = useState("");
  const [selectedAddArea, setSelectedAddArea] = useState<string>(
    professionalAreas[0],
  );

  const displayProfile = useMemo(() => {
    if (!profile) {
      return null;
    }

    return profileForPrimaryArea(primaryArea || getPrimaryArea(areas), profile);
  }, [areas, primaryArea, profile]);

  useEffect(() => {
    if (stage !== "scanning") {
      return;
    }

    if (activeStep >= scanningSteps.length - 1) {
      const timer = window.setTimeout(() => setStage("areas"), 800);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setActiveStep((step) => step + 1);
    }, 620);

    return () => window.clearTimeout(timer);
  }, [activeStep, stage]);

  function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity() || !isValidEmail(email)) {
      return;
    }

    const record: MockUserRecord = {
      email: email.trim(),
      linkedInUrl: linkedInUrl.trim(),
      timestamp: new Date().toISOString(),
      planType: "free",
    };
    saveMockUser(record);

    const nextProfile = inferProfile(linkedInUrl);
    setProfile(nextProfile);
    setAreas(nextProfile.detectedAreas);
    setPrimaryArea(nextProfile.detectedAreas[0]?.name ?? nextProfile.primaryArea);
    setActiveStep(0);
    setStage("scanning");
  }

  function handleRemoveArea(id: string) {
    setAreas((current) => {
      const next = current.filter((area) => area.id !== id);
      if (!next.some((area) => area.name === primaryArea)) {
        setPrimaryArea(next[0]?.name ?? "");
      }
      return next;
    });
  }

  function handleMoveArea(index: number, direction: -1 | 1) {
    setAreas((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function handleAddArea() {
    setAreas((current) => {
      if (current.some((area) => area.name === selectedAddArea)) {
        return current;
      }

      return [
        ...current,
        {
          id: createAreaId(selectedAddArea),
          name: selectedAddArea,
          confidence: 74,
        },
      ];
    });
  }

  return (
    <section
      className="bg-[#F3F2EF] px-5 py-16 text-[#191919] sm:px-8 sm:py-20 lg:px-10"
      id="assessment"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 border-b border-[#DADCE0] pb-8 lg:grid-cols-[0.82fr_1fr] lg:items-end">
          <div>
            <SectionEyebrow icon={BarChart3}>Assessment</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
              Analyze positioning before creating content.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#666666]">
            Free assessments are unlimited. The prototype limits result depth,
            not the number of analyses, so professionals can test positioning
            across different LinkedIn positioning angles.
          </p>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <ProfileInput
            email={email}
            isScanning={stage === "scanning"}
            linkedInUrl={linkedInUrl}
            onEmail={setEmail}
            onLinkedInUrl={setLinkedInUrl}
            onSubmit={handleAnalyze}
          />

          <div className="min-w-0">
            {stage === "idle" && (
              <section className="grid min-h-full content-between gap-8 rounded-lg border border-[#DADCE0] bg-white p-5 text-[#191919] shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
                    Result preview
                  </p>
                  <h3 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                    LinkedIn growth guidance, not generic content
                    generation.
                  </h3>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-[#666666]">
                    Run a mock profile scan to detect professional areas,
                    confirm your authority lane, and reveal a limited-depth free
                    assessment.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {["Area detection", "Score card", "Trend Radar"].map((item) => (
                    <div
                      className="rounded-lg border border-[#DADCE0] bg-[#F8F8F6] p-4 text-sm font-semibold"
                      key={item}
                    >
                      <ArrowRight className="mb-5 h-4 w-4 text-[#0A66C2]" />
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {stage === "scanning" && (
              <Scanner activeStep={activeStep} isScanning={stage === "scanning"} />
            )}

            {stage === "areas" && (
              <AreaDetection
                areas={areas}
                onAddArea={handleAddArea}
                onConfirm={() => setStage("results")}
                onMoveArea={handleMoveArea}
                onPrimaryArea={setPrimaryArea}
                onRemoveArea={handleRemoveArea}
                primaryArea={primaryArea}
                selectedAddArea={selectedAddArea}
                setSelectedAddArea={setSelectedAddArea}
              />
            )}

            {stage === "results" && displayProfile && (
              <Results
                areas={areas}
                profile={displayProfile}
              />
            )}
          </div>
        </div>
      </div>

    </section>
  );
}

function PricingSection() {
  return (
    <section className="bg-[#F3F2EF] px-5 py-16 text-[#191919] sm:px-8 sm:py-20 lg:px-10" id="pricing">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 border-b border-[#DADCE0] pb-8 lg:grid-cols-[0.85fr_1fr] lg:items-end">
          <div>
            <SectionEyebrow icon={WalletCards}>Pricing</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
              Freemium by depth, not by scarcity.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#666666]">
            Free users can keep analyzing. Pro unlocks more insight depth,
            richer trend context, saved history, and unlimited personalized post
            ideas.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {pricing.map((tier) => (
            <article
              className={classNames(
                "rounded-lg border p-6 transition sm:p-8",
                tier.featured
                  ? "border-[#0A66C2]/35 bg-white shadow-[0_16px_36px_rgba(10,25,47,0.12)]"
                  : "border-[#DADCE0] bg-white shadow-[0_8px_24px_rgba(10,25,47,0.05)]",
              )}
              key={tier.name}
            >
              <div className="flex flex-col gap-5 border-b border-[#DADCE0] pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold">{tier.name}</h3>
                  <p className="mt-2 text-sm text-[#666666]">{tier.cadence}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-5xl font-semibold">
                    €{tier.price}
                  </p>
                  <p className="mt-1 text-sm text-[#666666]">
                    {tier.featured ? "per month" : "forever"}
                  </p>
                </div>
              </div>

              <ul className="mt-6 grid gap-3 text-sm text-[#666666]">
                {tier.features.map((feature) => (
                  <li className="flex items-start gap-3" key={feature}>
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#057642]" />
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                className={classNames(
                  "mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 font-semibold transition",
                  tier.featured
                    ? "bg-[#0A66C2] text-white hover:bg-[#004182]"
                    : "border border-[#DADCE0] bg-white text-[#191919] hover:border-[#0A66C2]/35 hover:text-[#0A66C2]",
                )}
                href="#assessment"
              >
                {tier.featured ? "Upgrade to Pro" : "Start free"}
                <ArrowRight className="h-4 w-4" />
              </a>
            </article>
          ))}
        </div>

        <p className="mt-6 rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] p-4 text-sm leading-6 text-[#191919]">
          Main Pro CTA: Unlock unlimited personalized post ideas tailored to your
          expertise, industry, and trends with Pro. Stripe checkout is prepared
          as a placeholder integration, not connected yet.
        </p>
      </div>
    </section>
  );
}

function BuiltForSection() {
  return (
    <section className="bg-[#F3F2EF] px-5 py-16 text-[#191919] sm:px-8 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 border-b border-[#DADCE0] pb-8 lg:grid-cols-[0.85fr_1fr] lg:items-end">
          <div>
            <SectionEyebrow icon={Globe2}>Built for</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
              Professional areas with serious authority potential.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#666666]">
            The system is designed for experts whose credibility comes from
            domain knowledge, executive judgment, and useful market perspective.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {builtForAreas.map(([title, subtitle], index) => (
            <article
              className="area-card group relative min-h-48 overflow-hidden rounded-lg border border-[#DADCE0] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#0A66C2]/35 hover:shadow-[0_14px_34px_rgba(10,25,47,0.1)]"
              key={title}
              style={{ "--area-index": index } as React.CSSProperties}
            >
              <div className="area-visual absolute inset-0 opacity-90 transition duration-300 group-hover:scale-[1.02]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.94))]" />
              <div className="relative flex h-full flex-col justify-end">
                <p className="text-lg font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-6 text-[#666666]">{subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section className="bg-[#F3F2EF] px-5 py-16 text-[#191919] sm:px-8 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-lg border border-[#DADCE0] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <SectionEyebrow icon={Database}>Prepared architecture</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-semibold leading-tight">
                Mock-only now, ready for production services later.
              </h2>
              <p className="mt-4 text-sm leading-6 text-[#666666]">
                The prototype keeps analysis data and future integrations
                separated so OpenAI, Supabase, Stripe, trend feeds, and user
                accounts can be wired without redesigning the product surface.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["OpenAI API", "Profile and topic intelligence"],
                ["Supabase", "Lead records and saved idea history"],
                ["Stripe", "Pro subscription checkout"],
                ["Trend feeds", "Market-specific radar hydration"],
                ["User accounts", "Saved assessments and roadmap"],
                ["No autoposting", "User remains in control"],
              ].map(([title, subtitle]) => (
                <div
                  className="rounded-lg border border-[#DADCE0] bg-[#F8F8F6] p-4"
                  key={title}
                >
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#666666]">
                    {subtitle}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactFooter() {
  return (
    <footer className="bg-[#F3F2EF] px-5 py-10 text-[#191919] sm:px-8 lg:px-10" id="contact">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 border-t border-[#DADCE0] pt-8 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo markSize={36} showSubtitle={false} />
          <p className="mt-2 text-sm text-[#666666]">
            Your AI LinkedIn growth assistant.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-[#666666]">
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#0A66C2]" />
            Freemium SaaS prototype
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#057642]" />
            Never posts automatically
          </span>
        </div>
      </div>
    </footer>
  );
}

export function INConnectPlatform() {
  return (
    <main className="overflow-x-hidden bg-[#F3F2EF]">
      <LandingHero />
      <AssessmentSection />
      <FeaturesSection />
      <TrendRadarSection />
      <PricingSection />
      <ContactFooter />
    </main>
  );
}
