import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Factory,
  HardHat,
  Radar,
  Sparkles,
} from "lucide-react";
import { AnalyzerWorkbench } from "@/components/analyzer-workbench";

const pricingTiers = [
  {
    name: "Free",
    price: "€0",
    cadence: "for the first pass",
    note: "Test your authority angle before building a full content rhythm.",
    features: [
      "Mock LinkedIn profile assessment",
      "Industrial trend pulse",
      "10 tailored post ideas",
    ],
  },
  {
    name: "Pro",
    price: "€5",
    cadence: "per month",
    note: "For professionals turning field knowledge into a steady signal.",
    features: [
      "Deeper profile positioning prompts",
      "Repeatable idea refreshes",
      "Goal-led content planning",
    ],
    highlighted: true,
  },
];

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      <section className="relative isolate min-h-[82svh] overflow-hidden bg-[#111717] text-white">
        <Image
          alt="Industrial professional reviewing technical notes in a modern factory."
          className="object-cover object-[58%_center]"
          fill
          priority
          sizes="100vw"
          src="/industrial-hero.png"
        />
        <div className="hero-overlay absolute inset-0" />

        <div className="relative mx-auto flex min-h-[82svh] w-full max-w-7xl flex-col px-5 pb-14 pt-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-5 border-b border-white/15 pb-5">
            <a className="flex items-center gap-3" href="#" aria-label="INConnect home">
              <span className="grid size-10 place-items-center rounded-lg border border-[#f0a21a]/60 bg-[#f0a21a]/15 text-[#ffd06b]">
                <Factory className="size-5" />
              </span>
              <span>
                <span className="block text-lg font-semibold">INConnect</span>
                <span className="block text-xs text-white/68">
                  Industrial LinkedIn assistant
                </span>
              </span>
            </a>

            <nav className="hidden items-center gap-2 text-sm text-white/82 sm:flex">
              <a className="rounded-lg px-3 py-2 hover:bg-white/10" href="#analyzer">
                Analyzer
              </a>
              <a className="rounded-lg px-3 py-2 hover:bg-white/10" href="#pricing">
                Pricing
              </a>
            </nav>
          </header>

          <div className="flex flex-1 items-center py-14 sm:py-18">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white/88 backdrop-blur-sm">
                <Sparkles className="size-4 text-[#ffd06b]" />
                AI-Powered LinkedIn Assistant for Industrial Professionals
              </div>

              <h1 className="text-5xl font-semibold leading-none sm:text-6xl lg:text-7xl">
                INConnect
              </h1>
              <p className="mt-5 max-w-2xl text-3xl font-medium leading-tight text-white sm:text-5xl">
                Turn Industrial Expertise Into LinkedIn Authority.
              </p>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/78 sm:text-lg">
                Start with your profile and company signals, then shape practical
                industrial knowledge into content people in your market can trust.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#f0a21a] px-5 font-semibold text-[#1c160b] transition hover:bg-[#ffba3c]"
                  href="#analyzer"
                >
                  Analyze my profile
                  <ArrowRight className="size-4" />
                </a>
                <a
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-5 font-semibold text-white transition hover:bg-white/18"
                  href="#pricing"
                >
                  View pricing
                </a>
              </div>

              <dl className="mt-10 grid max-w-2xl grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="border-l border-[#ffd06b]/65 pl-3">
                  <dt className="text-white/58">Profile</dt>
                  <dd className="mt-1 font-medium">Authority gaps</dd>
                </div>
                <div className="border-l border-[#ffd06b]/65 pl-3">
                  <dt className="text-white/58">Market</dt>
                  <dd className="mt-1 font-medium">Industrial trends</dd>
                </div>
                <div className="border-l border-[#ffd06b]/65 pl-3">
                  <dt className="text-white/58">Output</dt>
                  <dd className="mt-1 font-medium">Post ideas</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <AnalyzerWorkbench />

      <section className="bg-[#171b1b] px-5 py-18 text-white sm:px-8 lg:px-10" id="pricing">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 border-b border-white/12 pb-8 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-[#ffd06b]">
                <Radar className="size-4" />
                Pricing
              </p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-5xl">
                Keep the first content system lean.
              </h2>
            </div>
            <p className="max-w-md text-base leading-7 text-white/68">
              INConnect starts with a free profile readout. Pro stays accessible for
              industrial professionals who want a repeatable LinkedIn habit.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {pricingTiers.map((tier) => (
              <article
                className={`rounded-lg border p-6 sm:p-8 ${
                  tier.highlighted
                    ? "border-[#f0a21a] bg-[#f0a21a]/12"
                    : "border-white/14 bg-white/[0.06]"
                }`}
                key={tier.name}
              >
                <div className="flex flex-col gap-4 border-b border-white/12 pb-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold">{tier.name}</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-white/68">
                      {tier.note}
                    </p>
                  </div>
                  <p className="text-left sm:text-right">
                    <span className="block text-4xl font-semibold">{tier.price}</span>
                    <span className="text-sm text-white/62">{tier.cadence}</span>
                  </p>
                </div>

                <ul className="mt-6 grid gap-3 text-sm text-white/84">
                  {tier.features.map((feature) => (
                    <li className="flex items-start gap-3" key={feature}>
                      <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[#ffd06b]" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <a
                  className={`mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold transition ${
                    tier.highlighted
                      ? "bg-[#f0a21a] text-[#1c160b] hover:bg-[#ffba3c]"
                      : "border border-white/22 bg-white/10 text-white hover:bg-white/18"
                  }`}
                  href="#analyzer"
                >
                  {tier.highlighted ? "Choose Pro" : "Start free"}
                  <ArrowRight className="size-4" />
                </a>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-white/12 pt-6 text-sm text-white/62 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-2">
              <HardHat className="size-4 text-[#ffd06b]" />
              Built for industrial voices with real field proof.
            </p>
            <p>Ready for Vercel deployment as a Next.js app.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

