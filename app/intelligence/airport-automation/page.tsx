import type { Metadata } from "next";
import Link from "next/link";
import { IntelligenceBriefingAccess } from "@/components/intelligence-briefing-access";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  type AirportBriefing,
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
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          {latestBriefing ? (
            <LatestAirportBriefingPreview briefing={latestBriefing} />
          ) : (
            <div className="rounded-lg border border-[#D9DDE3] bg-white p-6 text-sm leading-6 text-[#666666]">
              Airport Automation Daily briefings will appear here after the
              first scheduled generation run.
            </div>
          )}
        </div>
      </section>
      <RecentAirportBriefings briefings={briefings.slice(1, 4)} />
      <Footer />
    </main>
  );
}

function LatestAirportBriefingPreview({ briefing }: { briefing: AirportBriefing }) {
  return (
    <article className="overflow-hidden rounded-lg border border-[#D9DDE3] bg-white shadow-[0_12px_30px_rgba(10,25,47,0.08)]">
      <div className="aspect-[16/9] bg-[#E8F1FB]">
        <img
          alt=""
          className="h-full w-full object-cover"
          src={briefing.heroImageUrl}
        />
      </div>
      <div className="p-5 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
          {formatAirportBriefingDate(briefing.generatedAt)}
        </p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#191919]">
          {briefing.title}
        </h2>
        <p className="mt-4 text-base leading-7 text-[#666666]">{briefing.excerpt}</p>
      </div>
      <div className="border-t border-[#D9DDE3] px-5 py-8 sm:px-8">
        <IntelligenceBriefingAccess
          fullContent={briefing.content}
          intelligenceType="airport_automation"
          previewContent={createBriefingPreview(briefing.content)}
          streamTitle="Airport Automation Daily"
          unlockTitle="Unlock Full Briefing"
        />
      </div>
    </article>
  );
}

function RecentAirportBriefings({ briefings }: { briefings: AirportBriefing[] }) {
  if (briefings.length === 0) return null;

  return (
    <section className="px-5 pb-12 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Previous Airport Briefings
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {briefings.map((briefing) => (
            <Link
              className="group overflow-hidden rounded-lg border border-[#D9DDE3] bg-white shadow-[0_8px_24px_rgba(10,25,47,0.05)] transition hover:-translate-y-0.5 hover:border-[#0A66C2]/40 hover:shadow-[0_14px_32px_rgba(10,25,47,0.09)]"
              href={`/intelligence/airport-automation/${briefing.slug}`}
              key={briefing.slug}
            >
              <div className="aspect-video bg-[#E8F1FB]">
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  src={briefing.heroImageUrl}
                />
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
                  {formatAirportBriefingDate(briefing.generatedAt)}
                </p>
                <h3 className="mt-2 text-base font-semibold leading-snug text-[#191919] group-hover:text-[#0A66C2]">
                  {briefing.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#666666]">
                  {briefing.excerpt}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function createBriefingPreview(content: string) {
  return truncateMarkdownByWordShare(content.trim(), 0.3);
}

function truncateMarkdownByWordShare(content: string, share: number) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const totalWords = countWords(content);
  const targetWords = Math.max(1, Math.ceil(totalWords * share));
  const previewLines: string[] = [];
  let visibleWords = 0;

  for (const line of lines) {
    const lineWords = countWords(line);

    if (line.trim() && visibleWords + lineWords > targetWords) {
      const remainingWords = Math.max(1, targetWords - visibleWords);
      previewLines.push(truncateLineByWords(line, remainingWords));
      break;
    }

    previewLines.push(line);
    visibleWords += lineWords;

    if (visibleWords >= targetWords) break;
  }

  return previewLines.join("\n").trim();
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function truncateLineByWords(line: string, wordLimit: number) {
  if (!line.trim()) return line;
  const leadingMarker = line.match(/^(\s*(?:[-*]|\d+\.)\s+)(.*)$/);
  const prefix = leadingMarker?.[1] ?? "";
  const text = leadingMarker?.[2] ?? line.trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) return line;
  return `${prefix}${words.slice(0, wordLimit).join(" ")}...`;
}
