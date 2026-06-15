import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  type AirportBriefing,
  formatAirportBriefingDate,
  getPublishedAirportBriefings,
} from "@/lib/airport-briefings";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Airport Automation Daily | INConnect 1-Minute Briefing",
  description:
    "The one airport automation development worth knowing today from INConnect Intelligence.",
  path: "/intelligence/airport-automation",
});

export const dynamic = "force-dynamic";

export default async function AirportAutomationIntelligencePage() {
  const briefings = await getPublishedAirportBriefings();
  const latestBriefing = briefings[0];
  const previousBriefings = briefings.slice(1);

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link
            className="text-sm font-semibold text-[#0A66C2] transition hover:text-[#004182]"
            href="/intelligence"
          >
            Back to Intelligence
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#057642]">
            Active Intelligence Stream
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            ✈️ Airport Automation Daily
          </h1>
          <p className="mt-3 text-xl font-semibold text-[#0A66C2]">
            INConnect 1-Minute Briefing
          </p>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
            The one airport automation development worth knowing today. One
            topic, one insight, one minute.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Latest briefing
          </p>
          {!latestBriefing ? (
            <div className="rounded-lg border border-[#D9DDE3] bg-white p-6 text-sm leading-6 text-[#666666]">
              Airport Automation Daily briefings will appear here after the
              first scheduled generation run.
            </div>
          ) : (
            <AirportBriefingCard briefing={latestBriefing} featured />
          )}
          {previousBriefings.length > 0 && (
            <>
              <p className="mt-10 text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
                Previous posts
              </p>
              <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {previousBriefings.map((briefing) => (
                  <AirportBriefingCard briefing={briefing} key={briefing.slug} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}

function AirportBriefingCard({
  briefing,
  featured = false,
}: {
  briefing: AirportBriefing;
  featured?: boolean;
}) {
  return (
    <article
      className={classNames(
        "mt-6 flex h-full flex-col rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]",
        featured && "lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-6",
      )}
    >
      <div className="aspect-[16/9] bg-[#E8F1FB]">
        <img
          alt=""
          className="h-full w-full object-cover"
          src={briefing.heroImageUrl}
        />
      </div>
      <div className={classNames(featured ? "mt-5 lg:mt-0" : "mt-5")}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
          <span>{formatAirportCategory(briefing.category)}</span>
          <span>{formatAirportBriefingDate(briefing.generatedAt)}</span>
          <span className="text-[#057642]">1 Minute Read</span>
        </div>
        <h2 className="mt-4 text-xl font-semibold leading-snug text-[#191919]">
          <Link
            className="transition hover:text-[#0A66C2]"
            href={`/intelligence/airport-automation/${briefing.slug}`}
          >
            {briefing.title}
          </Link>
        </h2>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#D9DDE3] pt-4 text-sm">
          <span className="text-[#666666]">INConnect Briefing</span>
          <Link
            className="font-semibold text-[#0A66C2] transition hover:text-[#004182]"
            href={`/intelligence/airport-automation/${briefing.slug}`}
          >
            Read Briefing →
          </Link>
        </div>
      </div>
    </article>
  );
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatAirportCategory(category?: string) {
  const labels: Record<string, string> = {
    "Airside Operations": "🛫 Airside Operations",
    "Airport Infrastructure": "🏗 Airport Infrastructure",
    "Baggage Handling": "🛄 Baggage Handling",
    Cargo: "📦 Cargo",
    "Digital Airports": "📡 Digital Airports",
    "Ground Support Equipment": "🚜 Ground Support Equipment",
    "Passenger Processing": "👤 Passenger Processing",
    Robotics: "🤖 Robotics",
    Security: "🔒 Security",
    "Vision & AI": "📷 Vision & AI",
  };
  return labels[category ?? ""] ?? "✈️ Airport Automation";
}
