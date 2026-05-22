"use client";

import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  CircleDashed,
  Factory,
  Goal,
  LoaderCircle,
  Search,
  Sparkles,
  TrendingUp,
  WandSparkles,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type IndustryId =
  | "automation"
  | "manufacturing"
  | "energy"
  | "logistics"
  | "engineering";

type GoalId =
  | "authority"
  | "leads"
  | "hiring"
  | "partnerships"
  | "education";

const industries: Array<{ id: IndustryId; label: string }> = [
  { id: "automation", label: "Industrial automation" },
  { id: "manufacturing", label: "Advanced manufacturing" },
  { id: "energy", label: "Energy and utilities" },
  { id: "logistics", label: "Supply chain and logistics" },
  { id: "engineering", label: "Engineering services" },
];

const goals: Array<{ id: GoalId; label: string; phrase: string }> = [
  {
    id: "authority",
    label: "Build authority",
    phrase: "build authority",
  },
  {
    id: "leads",
    label: "Generate qualified leads",
    phrase: "start qualified conversations",
  },
  {
    id: "hiring",
    label: "Attract talent",
    phrase: "attract technical talent",
  },
  {
    id: "partnerships",
    label: "Open partnerships",
    phrase: "open partner discussions",
  },
  {
    id: "education",
    label: "Educate the market",
    phrase: "educate the market",
  },
];

const loadingSteps = [
  "Reading profile proof points",
  "Mapping company credibility signals",
  "Scanning industrial conversation angles",
  "Drafting authority-led post ideas",
];

const profileSignals = [
  {
    label: "Technical credibility",
    score: "Strong",
    note: "Your operating context is a differentiator. Put more field evidence in the opening lines.",
  },
  {
    label: "Market clarity",
    score: "Tighten",
    note: "Translate engineering language into the buyer or peer problem it solves.",
  },
  {
    label: "Content rhythm",
    score: "Opportunity",
    note: "Recurring lessons, diagrams, and postmortems can turn expertise into a visible habit.",
  },
];

const trendCards: Record<
  IndustryId,
  Array<{ title: string; signal: string; angle: string }>
> = {
  automation: [
    {
      title: "Brownfield automation",
      signal: "High",
      angle: "Show where legacy equipment still wins after smarter instrumentation.",
    },
    {
      title: "OT data trust",
      signal: "Rising",
      angle: "Explain what engineers need before AI insights become plant decisions.",
    },
    {
      title: "Skills transfer",
      signal: "Active",
      angle: "Turn tribal troubleshooting knowledge into repeatable operator stories.",
    },
  ],
  manufacturing: [
    {
      title: "Scrap reduction",
      signal: "High",
      angle: "Break down one root-cause path that improved yield or stability.",
    },
    {
      title: "Resilient quality",
      signal: "Rising",
      angle: "Contrast inspection metrics with the process signal behind them.",
    },
    {
      title: "Capex discipline",
      signal: "Active",
      angle: "Share the tradeoffs behind a practical line improvement.",
    },
  ],
  energy: [
    {
      title: "Grid readiness",
      signal: "High",
      angle: "Translate reliability work into risk avoided for operations teams.",
    },
    {
      title: "Asset visibility",
      signal: "Rising",
      angle: "Show which instrumentation decisions make maintenance smarter.",
    },
    {
      title: "Efficiency proof",
      signal: "Active",
      angle: "Pair sustainability claims with field measurements and constraints.",
    },
  ],
  logistics: [
    {
      title: "Warehouse flow",
      signal: "High",
      angle: "Explain the small bottleneck that reshaped throughput.",
    },
    {
      title: "Supplier signal",
      signal: "Rising",
      angle: "Share what visibility matters before an exception becomes urgent.",
    },
    {
      title: "Automation ROI",
      signal: "Active",
      angle: "Compare a clever automation idea with the operating math behind it.",
    },
  ],
  engineering: [
    {
      title: "Design for uptime",
      signal: "High",
      angle: "Connect one early design choice to years of easier maintenance.",
    },
    {
      title: "Commissioning lessons",
      signal: "Rising",
      angle: "Post the checklist item that keeps field teams from rework.",
    },
    {
      title: "Client education",
      signal: "Active",
      angle: "Explain the constraint clients underestimate before delivery.",
    },
  ],
};

function getCompanyName(value: string) {
  if (!value.trim()) {
    return "your company";
  }

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "your company";
  }
}

function createPostIdeas(
  industry: string,
  goal: string,
  company: string,
) {
  return [
    `A field lesson from ${industry}: the signal teams miss before a small issue becomes a costly delay.`,
    `The ${company} credibility post: one industrial problem you solve, one constraint you respect, one result that matters.`,
    `A "what changed my mind" post about ${industry} after seeing the same failure pattern more than once.`,
    `A short teardown of a process metric that looks healthy on a dashboard but still blocks ${goal}.`,
    `Three questions a technical buyer should ask before approving a ${industry} improvement project.`,
    `A before-and-after story showing how engineering discipline creates trust, not just throughput.`,
    `A myth-versus-reality post that makes a complex ${industry} topic useful to operators and executives.`,
    `A commissioning, maintenance, or handover checklist that helps peers ${goal} with less rework.`,
    `A trend reaction post: what current industrial conversation gets right, and what field experience adds.`,
    `A people post about the expert habit you want ${company} to be known for on LinkedIn.`,
  ];
}

export function AnalyzerWorkbench() {
  const [profileUrl, setProfileUrl] = useState("");
  const [companySite, setCompanySite] = useState("");
  const [industryId, setIndustryId] = useState<IndustryId>("automation");
  const [goalId, setGoalId] = useState<GoalId>("authority");
  const [activeStep, setActiveStep] = useState(-1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasResults, setHasResults] = useState(false);

  const selectedIndustry =
    industries.find((industry) => industry.id === industryId) ?? industries[0];
  const selectedGoal = goals.find((goal) => goal.id === goalId) ?? goals[0];
  const companyName = getCompanyName(companySite);
  const ideas = useMemo(
    () =>
      createPostIdeas(
        selectedIndustry.label.toLowerCase(),
        selectedGoal.phrase,
        companyName,
      ),
    [companyName, selectedGoal.phrase, selectedIndustry.label],
  );

  useEffect(() => {
    if (!isAnalyzing) {
      return;
    }

    if (activeStep >= loadingSteps.length - 1) {
      const finishTimer = window.setTimeout(() => {
        setIsAnalyzing(false);
        setHasResults(true);
      }, 720);

      return () => window.clearTimeout(finishTimer);
    }

    const stepTimer = window.setTimeout(() => {
      setActiveStep((currentStep) => currentStep + 1);
    }, 620);

    return () => window.clearTimeout(stepTimer);
  }, [activeStep, isAnalyzing]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasResults(false);
    setActiveStep(0);
    setIsAnalyzing(true);
  }

  return (
    <section
      className="scroll-mt-8 bg-[#f5f2eb] px-5 py-16 sm:px-8 sm:py-20 lg:px-10"
      id="analyzer"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-7 border-b border-[#d8d0c0] pb-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-[#0d6d62]">
              <WandSparkles className="size-4" />
              First MVP analyzer
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#101415] sm:text-5xl">
              Profile in. Industrial authority out.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#4d554f]">
            This first pass simulates the INConnect workflow: profile context,
            company context, industrial trend signals, and a publishable idea bank
            built around your LinkedIn goal.
          </p>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <form
            className="h-fit rounded-lg border border-[#d8d0c0] bg-white p-5 shadow-[0_18px_60px_rgba(16,20,21,0.08)] sm:p-6"
            onSubmit={handleSubmit}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#e6dece] pb-5">
              <div>
                <h3 className="text-xl font-semibold text-[#101415]">
                  Analyze profile
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#56605a]">
                  Enter the signals INConnect would use to shape the mock output.
                </p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#102f2d] text-[#d6f2ea]">
                <Search className="size-5" />
              </span>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-[#202826]">
                LinkedIn profile URL
                <input
                  className="h-12 w-full rounded-lg border border-[#cfc4af] bg-[#fbf8f1] px-3 text-[#101415] outline-none transition placeholder:text-[#7d7d72] focus:border-[#0d6d62] focus:ring-2 focus:ring-[#0d6d62]/18"
                  onChange={(event) => setProfileUrl(event.target.value)}
                  placeholder="https://www.linkedin.com/in/industrial-expert"
                  required
                  type="url"
                  value={profileUrl}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#202826]">
                Company website
                <input
                  className="h-12 w-full rounded-lg border border-[#cfc4af] bg-[#fbf8f1] px-3 text-[#101415] outline-none transition placeholder:text-[#7d7d72] focus:border-[#0d6d62] focus:ring-2 focus:ring-[#0d6d62]/18"
                  onChange={(event) => setCompanySite(event.target.value)}
                  placeholder="https://your-company.com"
                  required
                  type="url"
                  value={companySite}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-[#202826]">
                  Industry
                  <select
                    className="h-12 w-full rounded-lg border border-[#cfc4af] bg-[#fbf8f1] px-3 text-[#101415] outline-none transition focus:border-[#0d6d62] focus:ring-2 focus:ring-[#0d6d62]/18"
                    onChange={(event) =>
                      setIndustryId(event.target.value as IndustryId)
                    }
                    value={industryId}
                  >
                    {industries.map((industry) => (
                      <option key={industry.id} value={industry.id}>
                        {industry.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-[#202826]">
                  Goal
                  <select
                    className="h-12 w-full rounded-lg border border-[#cfc4af] bg-[#fbf8f1] px-3 text-[#101415] outline-none transition focus:border-[#0d6d62] focus:ring-2 focus:ring-[#0d6d62]/18"
                    onChange={(event) => setGoalId(event.target.value as GoalId)}
                    value={goalId}
                  >
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <button
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0d6d62] px-4 font-semibold text-white transition hover:bg-[#09584f] disabled:cursor-wait disabled:bg-[#477b73]"
              disabled={isAnalyzing}
              type="submit"
            >
              {isAnalyzing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {isAnalyzing ? "Analyzing signals" : "Analyze profile"}
            </button>

            <div aria-live="polite" className="mt-5 border-t border-[#e6dece] pt-5">
              <p className="text-sm font-semibold text-[#202826]">
                Mock loading steps
              </p>
              <ol className="mt-3 grid gap-2">
                {loadingSteps.map((step, index) => {
                  const isComplete =
                    hasResults || (isAnalyzing && index < activeStep);
                  const isCurrent = isAnalyzing && index === activeStep;

                  return (
                    <li
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                        isCurrent
                          ? "step-glow border-[#0d6d62]/30 bg-[#e9f4f0] text-[#123934]"
                          : "border-[#ebe4d5] bg-[#fbf8f1] text-[#5b645e]"
                      }`}
                      key={step}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0d6d62]" />
                      ) : isCurrent ? (
                        <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-[#0d6d62]" />
                      ) : (
                        <CircleDashed className="mt-0.5 size-4 shrink-0 text-[#9c9788]" />
                      )}
                      {step}
                    </li>
                  );
                })}
              </ol>
            </div>
          </form>

          <div className="min-w-0">
            {hasResults ? (
              <div className="grid gap-6">
                <section className="rounded-lg border border-[#d8d0c0] bg-white p-5 sm:p-6">
                  <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
                    <div
                      aria-label="Authority score 78 out of 100"
                      className="score-ring grid size-34 place-items-center rounded-full"
                    >
                      <div className="text-center">
                        <span className="block text-4xl font-semibold text-[#101415]">
                          78
                        </span>
                        <span className="text-xs font-semibold uppercase text-[#56605a]">
                          authority
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-[#0d6d62]">
                        <BadgeCheck className="size-4" />
                        Mock profile assessment
                      </p>
                      <h3 className="mt-3 text-2xl font-semibold text-[#101415]">
                        Strong expert signal. Sharpen the LinkedIn narrative.
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-[#56605a] sm:text-base">
                        The mock readout sees a credible {selectedIndustry.label.toLowerCase()}{" "}
                        voice ready to {selectedGoal.phrase}. Lead with problems
                        solved, field proof, and repeatable lessons from {companyName}.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {profileSignals.map((signal) => (
                      <article
                        className="rounded-lg border border-[#e5dccb] bg-[#fbf8f1] p-4"
                        key={signal.label}
                      >
                        <p className="text-sm font-semibold text-[#101415]">
                          {signal.label}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase text-[#0d6d62]">
                          {signal.score}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-[#56605a]">
                          {signal.note}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-[#0d6d62]">
                        <TrendingUp className="size-4" />
                        Mock trend cards
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-[#101415]">
                        Current angles for {selectedIndustry.label}
                      </h3>
                    </div>
                    <p className="text-sm text-[#5b645e]">
                      Sized for practical LinkedIn discussion.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {trendCards[industryId].map((trend) => (
                      <article
                        className="rounded-lg border border-[#d8d0c0] bg-[#18201f] p-4 text-white"
                        key={trend.title}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{trend.title}</p>
                          <span className="rounded-lg bg-[#f0a21a]/18 px-2 py-1 text-xs font-semibold text-[#ffd06b]">
                            {trend.signal}
                          </span>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-white/72">
                          {trend.angle}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-[#d8d0c0] bg-white p-5 sm:p-6">
                  <div className="flex flex-col gap-3 border-b border-[#e6dece] pb-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-[#0d6d62]">
                        <BarChart3 className="size-4" />
                        Personalized idea bank
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-[#101415]">
                        10 personalized LinkedIn post ideas
                      </h3>
                    </div>
                    <p className="text-sm leading-6 text-[#56605a]">
                      Goal: {selectedGoal.label}
                    </p>
                  </div>

                  <ol className="mt-5 grid gap-3 lg:grid-cols-2">
                    {ideas.map((idea, index) => (
                      <li
                        className="flex min-w-0 gap-3 rounded-lg border border-[#e5dccb] bg-[#fbf8f1] p-4 text-sm leading-6 text-[#27302d]"
                        key={idea}
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#102f2d] text-xs font-semibold text-[#d6f2ea]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>{idea}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            ) : (
              <section className="grid min-h-full content-between gap-8 rounded-lg border border-[#d8d0c0] bg-[#18201f] p-5 text-white sm:p-7">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-[#ffd06b]">
                    <Factory className="size-4" />
                    Mock output preview
                  </p>
                  <h3 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
                    INConnect turns technical proof into post angles built for
                    industrial trust.
                  </h3>
                  <p className="mt-4 max-w-xl text-base leading-7 text-white/70">
                    Run the analyzer to reveal a profile assessment, market trend
                    cards, and ten post ideas based on your selected industry and
                    LinkedIn goal.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    "Profile signal readout",
                    "Trend card prompts",
                    "10 post ideas",
                  ].map((preview) => (
                    <div
                      className="rounded-lg border border-white/14 bg-white/[0.08] p-4 text-sm font-medium"
                      key={preview}
                    >
                      <ArrowRight className="mb-5 size-4 text-[#ffd06b]" />
                      {preview}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

