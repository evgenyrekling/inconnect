"use client";

import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Copy,
  Database,
  ExternalLink,
  Factory,
  Globe2,
  GripVertical,
  Layers3,
  LineChart,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Plus,
  Radar,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
  WalletCards,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createShareText,
  type DetectedArea,
  getMockProfileName,
  inferProfile,
  type MockUserRecord,
  professionalAreas,
  profileForPrimaryArea,
  type AreaProfile,
} from "@/lib/mock-intelligence";

type Stage = "idle" | "scanning" | "areas" | "results";

const scanningSteps = [
  "Analyzing LinkedIn profile",
  "Detecting professional expertise",
  "Identifying relevant industries",
  "Checking company positioning",
  "Scanning relevant trends",
  "Preparing visibility assessment",
];

const navItems = [
  { label: "Features", href: "#features" },
  { label: "Assessment", href: "#assessment" },
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
    icon: BrainCircuit,
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

function normalizeCompanyInput(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return "No company context supplied";
  }

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.hostname.includes(".")) {
      return url.hostname.replace(/^www\./, "");
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function createAreaId(name: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
}

function getPrimaryArea(areas: DetectedArea[]) {
  return areas[0]?.name ?? "Technology";
}

function saveMockUser(record: MockUserRecord) {
  window.localStorage.setItem("inconnect.mockUser", JSON.stringify(record));
}

function ScoreRing({ score }: { score: number }) {
  const degrees = Math.round((score / 100) * 360);

  return (
    <div
      aria-label={`LinkedIn Authority Score ${score} out of 100`}
      className="grid h-40 w-40 place-items-center rounded-full p-2 shadow-[0_0_80px_rgba(56,189,248,0.18)]"
      style={{
        background: `conic-gradient(#58d6ff 0deg ${degrees}deg, rgba(255,255,255,0.12) ${degrees}deg 360deg)`,
      }}
    >
      <div className="grid h-full w-full place-items-center rounded-full border border-white/10 bg-[#081015] text-center">
        <div>
          <span className="block text-5xl font-semibold tracking-normal text-white">
            {score}
          </span>
          <span className="text-xs font-semibold uppercase text-cyan-200/80">
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
    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
      <Icon className="h-4 w-4" />
      {children}
    </p>
  );
}

function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#05080d] text-white">
      <div className="absolute inset-0 tech-grid opacity-70" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(9,14,22,0.96),rgba(9,17,28,0.82)_48%,rgba(19,38,49,0.72))]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a className="flex items-center gap-3" href="#" aria-label="INConnect home">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
            <Link2 className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-lg font-semibold">INConnect</span>
            <span className="block text-xs text-slate-400">
              Visibility intelligence
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 text-sm text-slate-300 lg:flex">
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
          className="hidden h-10 items-center justify-center rounded-lg border border-white/12 bg-white/10 px-4 text-sm font-semibold text-white transition hover:border-cyan-300/45 hover:bg-cyan-300/10 md:inline-flex"
          href="#assessment"
        >
          Start free
        </a>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-80px)] max-w-7xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:px-10">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-50 shadow-[0_0_40px_rgba(56,189,248,0.12)]">
            <Sparkles className="h-4 w-4 text-cyan-200" />
            AI-Powered LinkedIn Assistant for Professionals
          </div>

          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] text-white sm:text-6xl lg:text-7xl">
            Turn Professional Expertise Into LinkedIn Authority.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            AI-powered LinkedIn profile analysis, professional area detection,
            trend discovery, and personalized content ideas for professionals
            across industries.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-200 px-5 font-semibold text-[#051017] shadow-[0_20px_60px_rgba(103,232,249,0.22)] transition hover:bg-white"
              href="#assessment"
            >
              Analyze My LinkedIn Profile
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              className="inline-flex h-12 items-center justify-center rounded-lg border border-white/12 bg-white/10 px-5 font-semibold text-white transition hover:border-white/25 hover:bg-white/15"
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
                className="rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm"
                key={label}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {label}
                </p>
                <p className="mt-2 font-semibold text-slate-100">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[520px]">
          <div className="absolute inset-x-4 top-4 h-72 overflow-hidden rounded-lg border border-white/10 opacity-60">
            <Image
              alt="Professional signal layer for INConnect visibility intelligence."
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 90vw"
              src="/industrial-hero.png"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,13,0.15),rgba(5,8,13,0.9))]" />
          </div>

          <div className="relative ml-auto mt-16 max-w-xl rounded-lg border border-cyan-300/20 bg-[#071017]/90 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.42)] backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">
                  Live intelligence preview
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  LinkedIn authority dashboard
                </h2>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-cyan-300/10 text-cyan-100">
                <LineChart className="h-5 w-5" />
              </span>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Authority signal</span>
                  <span className="font-semibold text-cyan-100">74 / 100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[74%] rounded-full bg-cyan-200" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {["Expertise", "Trends", "Topics"].map((item, index) => (
                  <div
                    className="rounded-lg border border-white/10 bg-white/[0.04] p-4"
                    key={item}
                  >
                    <p className="text-xs text-slate-500">Layer 0{index + 1}</p>
                    <p className="mt-2 text-sm font-semibold">{item}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
                <p className="text-sm leading-6 text-cyan-50">
                  Positioned at the intersection of professional expertise,
                  market timing, and LinkedIn authority potential.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="bg-[#070b12] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10" id="features">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 border-b border-white/10 pb-8 lg:grid-cols-[0.75fr_1fr] lg:items-end">
          <div>
            <SectionEyebrow icon={Target}>Features</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
              Built as professional visibility intelligence.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-slate-400">
            INConnect is structured around positioning, area detection, trend
            relevance, and shareable authority signals. It is not a generic AI
            writing surface.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((feature) => (
            <article
              className="group rounded-lg border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-300/[0.07]"
              key={feature.title}
            >
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 transition group-hover:bg-cyan-300/20">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {feature.copy}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileInput({
  companyInput,
  isScanning,
  linkedInUrl,
  onCompanyInput,
  onLinkedInUrl,
  onSubmit,
}: {
  companyInput: string;
  isScanning: boolean;
  linkedInUrl: string;
  onCompanyInput: (value: string) => void;
  onLinkedInUrl: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.22)] backdrop-blur"
      onSubmit={onSubmit}
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h3 className="text-xl font-semibold text-white">Analyze profile</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Start with public positioning signals. No scraping, API calls, or
            database writes in this prototype.
          </p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-100">
          <ScanLine className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          LinkedIn profile URL
          <input
            className="h-12 w-full rounded-lg border border-white/12 bg-[#081018] px-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/15"
            onChange={(event) => onLinkedInUrl(event.target.value)}
            placeholder="https://www.linkedin.com/in/alex-morgan"
            required
            type="url"
            value={linkedInUrl}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Company website or company name
          <input
            className="h-12 w-full rounded-lg border border-white/12 bg-[#081018] px-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/15"
            onChange={(event) => onCompanyInput(event.target.value)}
            placeholder="https://www.sick.com, sick.com, Siemens, Marriott"
            type="text"
            value={companyInput}
          />
          <span className="text-xs font-normal text-slate-500">
            Optional: company website, domain, or company name
          </span>
        </label>
      </div>

      <button
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-cyan-200 px-4 font-semibold text-[#051017] transition hover:bg-white disabled:cursor-wait disabled:bg-slate-500 disabled:text-slate-100"
        disabled={isScanning}
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
    <section className="rounded-lg border border-white/10 bg-[#071017] p-5 text-white">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
            AI scanning flow
          </p>
          <h3 className="mt-2 text-2xl font-semibold">
            Professional visibility scan
          </h3>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-lg bg-cyan-300/10 text-cyan-100">
          <BrainCircuit className="h-6 w-6" />
        </span>
      </div>

      <div className="mt-5">
        <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
          <span>Analysis progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#67e8f9,#a78bfa,#f8c471)] transition-all duration-500"
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
                complete && "border-cyan-300/20 bg-cyan-300/10 text-cyan-50",
                current &&
                  "scanner-active border-cyan-300/45 bg-cyan-300/15 text-white",
                !complete &&
                  !current &&
                  "border-white/10 bg-white/[0.03] text-slate-500",
              )}
              key={step}
            >
              {complete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-200" />
              ) : current ? (
                <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-cyan-200" />
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
    <section className="rounded-lg border border-white/10 bg-white/[0.045] p-5 text-white">
      <div className="grid gap-4 border-b border-white/10 pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
            Professional area detection
          </p>
          <h3 className="mt-2 text-2xl font-semibold">
            Confirm your authority lane
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            INConnect uses mock detection for now. Edit the professional areas,
            choose your primary area, then reveal the free assessment.
          </p>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-200 px-4 font-semibold text-[#051017] transition hover:bg-white"
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
                  ? "border-cyan-300/40 bg-cyan-300/10"
                  : "border-white/10 bg-[#081018]",
              )}
              key={area.id}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-1 text-slate-500">
                  <GripVertical className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-white">{area.name}</h4>
                    {isPrimary && (
                      <span className="rounded-lg bg-cyan-200 px-2 py-1 text-xs font-semibold text-[#051017]">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 w-36 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-200"
                        style={{ width: `${area.confidence}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-300">
                      {area.confidence}% confidence
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <button
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => onMoveArea(index, -1)}
                  type="button"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={index === areas.length - 1}
                  onClick={() => onMoveArea(index, 1)}
                  type="button"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-200 transition hover:bg-white/10"
                  onClick={() => onPrimaryArea(area.name)}
                  type="button"
                >
                  <Star className="h-4 w-4" />
                  Set primary
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/8 px-3 text-sm text-rose-100 transition hover:bg-rose-300/12 disabled:cursor-not-allowed disabled:opacity-40"
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

      <div className="mt-5 grid gap-3 rounded-lg border border-white/10 bg-[#071017] p-4 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Manually add area
          <select
            className="h-11 w-full rounded-lg border border-white/12 bg-[#081018] px-3 text-white outline-none transition focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/15"
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
          className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 font-semibold text-cyan-50 transition hover:bg-cyan-300/20"
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

function EmailCaptureModal({
  email,
  name,
  onClose,
  onEmail,
  onName,
  onReveal,
}: {
  email: string;
  name: string;
  onClose: () => void;
  onEmail: (value: string) => void;
  onName: (value: string) => void;
  onReveal: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#030507]/80 px-5 py-8 backdrop-blur-md">
      <form
        className="w-full max-w-xl rounded-lg border border-cyan-300/20 bg-[#071017] p-5 text-white shadow-[0_40px_140px_rgba(0,0,0,0.55)] sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          onReveal();
        }}
      >
        <div className="flex items-start justify-between gap-5 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Assessment ready
            </p>
            <h3 className="mt-3 text-3xl font-semibold leading-tight">
              Your LinkedIn Authority Assessment Is Ready
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Receive your personalized visibility insights, trend radar, and
              AI-powered LinkedIn opportunities.
            </p>
          </div>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-100">
            <Mail className="h-6 w-6" />
          </span>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-200">
            Name
            <input
              className="h-12 w-full rounded-lg border border-white/12 bg-[#081018] px-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/15"
              onChange={(event) => onName(event.target.value)}
              required
              type="text"
              value={name}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-200">
            Email address
            <input
              className="h-12 w-full rounded-lg border border-white/12 bg-[#081018] px-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-300/15"
              autoComplete="email"
              inputMode="email"
              onChange={(event) => onEmail(event.target.value)}
              placeholder="name@company.com"
              required
              type="text"
              value={email}
            />
          </label>
        </div>

        <p className="mt-5 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
          We respect your privacy and never post to LinkedIn automatically.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            className="inline-flex h-12 items-center justify-center rounded-lg border border-white/12 bg-white/5 font-semibold text-white transition hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            Review areas
          </button>
          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-200 font-semibold text-[#051017] transition hover:bg-white"
            type="submit"
          >
            Reveal My Results
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
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
    <section className="rounded-lg border border-cyan-300/20 bg-[#071017] p-5 text-white shadow-[0_30px_120px_rgba(0,0,0,0.28)] sm:p-7">
      <div className="grid gap-7 lg:grid-cols-[auto_1fr] lg:items-center">
        <ScoreRing score={profile.score} />

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
            LinkedIn Authority Score
          </p>
          <h3 className="mt-3 text-3xl font-semibold sm:text-5xl">
            {profile.score} / 100
          </h3>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
            You are positioned at the intersection of:
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {areas.slice(0, 3).map((area) => (
              <li
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold"
                key={area.id}
              >
                <Check className="h-4 w-4 text-cyan-200" />
                {area.name}
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
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
  const shareHref = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(
    shareText,
  )}`;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.045] p-5 text-white sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
            Shareable score card
          </p>
          <h3 className="mt-3 text-3xl font-semibold">
            Share Your LinkedIn Authority Score
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            See how your professional authority compares across industries.
            Share your score on LinkedIn.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-200 px-4 font-semibold text-[#051017] transition hover:bg-white"
              onClick={onCopy}
              type="button"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied" : "Copy LinkedIn Post"}
            </button>
            <a
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/5 px-4 font-semibold text-white transition hover:bg-white/10"
              href={shareHref}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="h-4 w-4" />
              Share on LinkedIn
            </a>
          </div>
        </div>

        <div className="share-card rounded-lg border border-cyan-300/25 bg-[#050b12] p-5 shadow-[0_25px_90px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-300/10 text-cyan-100">
                <Link2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">INConnect</p>
                <p className="text-xs text-slate-500">
                  Turn Professional Expertise Into LinkedIn Authority.
                </p>
              </div>
            </div>
            <span className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              Free assessment
            </span>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
            <ScoreRing score={profile.score} />
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                LinkedIn Authority Score
              </p>
              <p className="mt-3 text-4xl font-semibold">{profile.score} / 100</p>
              <p className="mt-3 text-sm text-slate-400">
                Primary Professional Area
              </p>
              <p className="mt-1 text-lg font-semibold text-cyan-100">{primary}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Strong Authority Potential In:
              </p>
              <ul className="mt-3 grid gap-2 text-sm text-slate-300">
                {profile.strongAuthorityPotential.map((item) => (
                  <li className="flex items-center gap-2" key={item}>
                    <BadgeCheck className="h-4 w-4 text-cyan-200" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Top Expertise Areas
              </p>
              <ul className="mt-3 grid gap-2 text-sm text-slate-300">
                {areas.slice(0, 3).map((area) => (
                  <li className="flex items-center gap-2" key={area.id}>
                    <BadgeCheck className="h-4 w-4 text-cyan-200" />
                    {area.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Results({
  areas,
  companyInput,
  linkedInUrl,
  profile,
}: {
  areas: DetectedArea[];
  companyInput: string;
  linkedInUrl: string;
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
            className="rounded-lg border border-white/10 bg-white/[0.045] p-5 text-white"
            key={strength}
          >
            <BadgeCheck className="h-5 w-5 text-cyan-200" />
            <h3 className="mt-4 text-lg font-semibold">{strength}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              A strong signal for professional visibility and credible
              LinkedIn authority.
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-white/10 bg-[#071017] p-5 text-white sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
          Visibility potential
        </p>
        <h3 className="mt-3 text-2xl font-semibold">
          Your strongest visibility potential is in:
        </h3>
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {profile.authorityPotential.map((item) => (
            <li
              className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm font-semibold text-cyan-50"
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.045] p-5 text-white sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
          Visibility Opportunities
        </p>
        <div className="mt-5 grid gap-3">
          {profile.opportunities.map((opportunity) => (
            <article
              className="flex gap-3 rounded-lg border border-white/10 bg-[#081018] p-4"
              key={opportunity}
            >
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
              <p className="text-sm leading-6 text-slate-300">{opportunity}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="rounded-lg border border-white/10 bg-[#071017] p-5 text-white sm:p-7"
        id="trend-radar"
      >
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Trend Radar
            </p>
            <h3 className="mt-3 text-2xl font-semibold">
              Trends matched to your professional area
            </h3>
          </div>
          <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300">
            3 visible on Free
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {profile.trends.slice(0, 3).map((trend) => (
            <article
              className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4"
              key={trend.title}
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold">{trend.title}</h4>
                <span className="rounded-lg bg-white/10 px-2 py-1 text-xs text-cyan-100">
                  {trend.momentum}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {trend.summary}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {profile.trends.slice(3).map((trend) => (
            <article
              className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] p-4"
              key={trend.title}
            >
              <div className="blur-[3px]">
                <h4 className="font-semibold">{trend.title}</h4>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {trend.summary}
                </p>
              </div>
              <div className="absolute inset-0 grid place-items-center bg-[#071017]/62">
                <span className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-[#071017] px-3 py-2 text-sm font-semibold text-cyan-50">
                  <LockKeyhole className="h-4 w-4" />
                  Unlock full Trend Radar in Pro.
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.045] p-5 text-white sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[0.82fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Personalized Topic Idea
            </p>
            <h3 className="mt-3 text-2xl font-semibold">
              {profile.topic.title}
            </h3>
            <p className="mt-4 text-lg leading-8 text-white">
              {profile.topic.hook}
            </p>
          </div>

          <div className="grid gap-4">
            <article className="rounded-lg border border-white/10 bg-[#081018] p-4">
              <p className="text-sm font-semibold text-cyan-100">
                Why this matters now
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {profile.topic.whyNow}
              </p>
            </article>
            <article className="rounded-lg border border-white/10 bg-[#081018] p-4">
              <p className="text-sm font-semibold text-cyan-100">CTA</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {profile.topic.cta}
              </p>
            </article>
            <div className="flex flex-wrap gap-2">
              {profile.topic.hashtags.map((hashtag) => (
                <span
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300"
                  key={hashtag}
                >
                  {hashtag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
          Unlock unlimited personalized post ideas tailored to your expertise,
          industry, and trends with Pro.
        </div>
      </section>

      <section className="rounded-lg border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(103,232,249,0.14),rgba(167,139,250,0.1),rgba(5,8,13,0.9))] p-5 text-white sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Pro Upgrade CTA
            </p>
            <h3 className="mt-3 text-3xl font-semibold">
              Unlock unlimited personalized post ideas tailored to your
              expertise, industry, and trends with Pro.
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Future Stripe checkout will connect here. Current prototype uses a
              placeholder action only.
            </p>
          </div>
          <a
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-200 px-5 font-semibold text-[#051017] transition hover:bg-white"
            href="#pricing"
          >
            Upgrade to Pro
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <p className="text-xs text-slate-600">
        Mock context: {linkedInUrl} | {normalizeCompanyInput(companyInput)}
      </p>
    </div>
  );
}

function AssessmentSection() {
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [activeStep, setActiveStep] = useState(0);
  const [profile, setProfile] = useState<AreaProfile | null>(null);
  const [areas, setAreas] = useState<DetectedArea[]>([]);
  const [primaryArea, setPrimaryArea] = useState("");
  const [selectedAddArea, setSelectedAddArea] = useState<string>(
    professionalAreas[0],
  );
  const [emailOpen, setEmailOpen] = useState(false);
  const [capturedName, setCapturedName] = useState("");
  const [capturedEmail, setCapturedEmail] = useState("");

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
    const nextProfile = inferProfile(linkedInUrl, companyInput);
    setProfile(nextProfile);
    setAreas(nextProfile.detectedAreas);
    setPrimaryArea(nextProfile.detectedAreas[0]?.name ?? nextProfile.primaryArea);
    setCapturedName(getMockProfileName(linkedInUrl));
    setCapturedEmail("");
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

  function handleReveal() {
    const primary = primaryArea || getPrimaryArea(areas);
    const record: MockUserRecord = {
      name: capturedName,
      email: capturedEmail,
      linkedInUrl,
      companyInput,
      primaryProfessionalArea: primary,
      secondaryProfessionalAreas: areas
        .map((area) => area.name)
        .filter((area) => area !== primary),
      timestamp: new Date().toISOString(),
      planType: "free",
    };

    saveMockUser(record);
    setEmailOpen(false);
    setStage("results");
  }

  return (
    <section
      className="bg-[#05080d] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10"
      id="assessment"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 border-b border-white/10 pb-8 lg:grid-cols-[0.82fr_1fr] lg:items-end">
          <div>
            <SectionEyebrow icon={BarChart3}>Assessment</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
              Analyze positioning before creating content.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-slate-400">
            Free assessments are unlimited. The prototype limits result depth,
            not the number of analyses, so professionals can test positioning
            across different companies and authority lanes.
          </p>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <ProfileInput
            companyInput={companyInput}
            isScanning={stage === "scanning"}
            linkedInUrl={linkedInUrl}
            onCompanyInput={setCompanyInput}
            onLinkedInUrl={setLinkedInUrl}
            onSubmit={handleAnalyze}
          />

          <div className="min-w-0">
            {stage === "idle" && (
              <section className="grid min-h-full content-between gap-8 rounded-lg border border-white/10 bg-[#071017] p-5 text-white sm:p-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                    Result preview
                  </p>
                  <h3 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                    Professional visibility intelligence, not generic content
                    generation.
                  </h3>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
                    Run a mock profile scan to detect professional areas,
                    confirm your authority lane, capture email, and reveal a
                    limited-depth free assessment.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {["Area detection", "Score card", "Trend Radar"].map((item) => (
                    <div
                      className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold"
                      key={item}
                    >
                      <ArrowRight className="mb-5 h-4 w-4 text-cyan-200" />
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
                onConfirm={() => setEmailOpen(true)}
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
                companyInput={companyInput}
                linkedInUrl={linkedInUrl}
                profile={displayProfile}
              />
            )}
          </div>
        </div>
      </div>

      {emailOpen && (
        <EmailCaptureModal
          email={capturedEmail}
          name={capturedName}
          onClose={() => setEmailOpen(false)}
          onEmail={setCapturedEmail}
          onName={setCapturedName}
          onReveal={handleReveal}
        />
      )}
    </section>
  );
}

function PricingSection() {
  return (
    <section className="bg-[#070b12] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10" id="pricing">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 border-b border-white/10 pb-8 lg:grid-cols-[0.85fr_1fr] lg:items-end">
          <div>
            <SectionEyebrow icon={WalletCards}>Pricing</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
              Freemium by depth, not by scarcity.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-slate-400">
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
                  ? "border-cyan-300/40 bg-cyan-300/10 shadow-[0_30px_120px_rgba(56,189,248,0.12)]"
                  : "border-white/10 bg-white/[0.045]",
              )}
              key={tier.name}
            >
              <div className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold">{tier.name}</h3>
                  <p className="mt-2 text-sm text-slate-400">{tier.cadence}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-5xl font-semibold">
                    €{tier.price}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {tier.featured ? "per month" : "forever"}
                  </p>
                </div>
              </div>

              <ul className="mt-6 grid gap-3 text-sm text-slate-300">
                {tier.features.map((feature) => (
                  <li className="flex items-start gap-3" key={feature}>
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                className={classNames(
                  "mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 font-semibold transition",
                  tier.featured
                    ? "bg-cyan-200 text-[#051017] hover:bg-white"
                    : "border border-white/12 bg-white/5 text-white hover:bg-white/10",
                )}
                href="#assessment"
              >
                {tier.featured ? "Upgrade to Pro" : "Start free"}
                <ArrowRight className="h-4 w-4" />
              </a>
            </article>
          ))}
        </div>

        <p className="mt-6 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
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
    <section className="bg-[#05080d] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 border-b border-white/10 pb-8 lg:grid-cols-[0.85fr_1fr] lg:items-end">
          <div>
            <SectionEyebrow icon={Globe2}>Built for</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
              Professional areas with serious authority potential.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-slate-400">
            The system is designed for experts whose credibility comes from
            domain knowledge, executive judgment, and useful market perspective.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {builtForAreas.map(([title, subtitle], index) => (
            <article
              className="area-card group relative min-h-48 overflow-hidden rounded-lg border border-white/10 bg-[#071017] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/35"
              key={title}
              style={{ "--area-index": index } as React.CSSProperties}
            >
              <div className="area-visual absolute inset-0 opacity-80 transition duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,13,0.05),rgba(5,8,13,0.88))]" />
              <div className="relative flex h-full flex-col justify-end">
                <p className="text-lg font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{subtitle}</p>
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
    <section className="bg-[#070b12] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-lg border border-white/10 bg-white/[0.045] p-5 sm:p-7">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <SectionEyebrow icon={Database}>Prepared architecture</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-semibold leading-tight">
                Mock-only now, ready for production services later.
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-400">
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
                  className="rounded-lg border border-white/10 bg-[#081018] p-4"
                  key={title}
                >
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
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
    <footer className="bg-[#05080d] px-5 py-10 text-white sm:px-8 lg:px-10" id="contact">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-semibold">INConnect</p>
          <p className="mt-2 text-sm text-slate-500">
            Professional visibility intelligence platform.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cyan-200" />
            Freemium SaaS prototype
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-200" />
            Never posts automatically
          </span>
        </div>
      </div>
    </footer>
  );
}

export function INConnectPlatform() {
  return (
    <main className="overflow-x-hidden bg-[#05080d]">
      <LandingHero />
      <FeaturesSection />
      <AssessmentSection />
      <PricingSection />
      <BuiltForSection />
      <ArchitectureSection />
      <ContactFooter />
    </main>
  );
}
