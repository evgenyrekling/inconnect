import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  formatAirportBriefingDate,
  getPublishedAirportBriefings,
} from "@/lib/airport-briefings";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Airport Automation Daily | INConnect Intelligence",
  description:
    "Daily airport automation intelligence covering airports, airlines, BHS, RFID, passenger processing, biometrics, security, AI, LiDAR, robotics, and smart airport projects.",
  path: "/intelligence/airport-automation",
});

export const dynamic = "force-dynamic";

export default async function AirportAutomationIntelligencePage() {
  const briefings = await getPublishedAirportBriefings();
  const latestBriefing = briefings[0];

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
            Active
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            Airport Automation Daily
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
            Daily developments in airport automation, baggage handling,
            passenger processing, RFID, biometrics, security, AI, LiDAR,
            robotics, digital airports, and smart airport infrastructure.
          </p>
          {latestBriefing && (
            <Link
              className="mt-7 inline-flex h-12 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
              href={`/intelligence/airport-automation/${latestBriefing.slug}`}
            >
              Unlock Full Briefing
            </Link>
          )}
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Latest Airport Briefings
          </p>
          {briefings.length === 0 ? (
            <div className="mt-6 rounded-lg border border-[#D9DDE3] bg-white p-6 text-sm leading-6 text-[#666666]">
              Airport Automation Daily briefings will appear here after the
              first scheduled generation run.
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {briefings.map((briefing) => (
                <article
                  className="flex h-full flex-col rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]"
                  key={briefing.slug}
                >
                  <div className="aspect-video overflow-hidden rounded-lg bg-[#E8F1FB]">
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      src={briefing.heroImageUrl}
                    />
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
                    {formatAirportBriefingDate(briefing.generatedAt)}
                  </p>
                  <h2 className="mt-3 text-xl font-semibold leading-snug text-[#191919]">
                    <Link
                      className="transition hover:text-[#0A66C2]"
                      href={`/intelligence/airport-automation/${briefing.slug}`}
                    >
                      {briefing.title}
                    </Link>
                  </h2>
                  <p className="mt-3 flex-1 text-sm leading-6 text-[#666666]">
                    {briefing.excerpt}
                  </p>
                  <Link
                    className="mt-5 border-t border-[#D9DDE3] pt-4 text-sm font-semibold text-[#0A66C2] transition hover:text-[#004182]"
                    href={`/intelligence/airport-automation/${briefing.slug}`}
                  >
                    Unlock briefing
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
