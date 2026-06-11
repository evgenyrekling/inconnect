import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IntelligenceBriefingAccess } from "@/components/intelligence-briefing-access";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  type AirportBriefing,
  demoAirportBriefings,
  formatAirportBriefingDate,
  getPublishedAirportBriefingBySlug,
  getPublishedAirportBriefings,
} from "@/lib/airport-briefings";
import { SITE_URL } from "@/lib/seo";

type AirportBriefingPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const revalidate = 300;
export const dynamicParams = true;

export function generateStaticParams() {
  return demoAirportBriefings.map((briefing) => ({ slug: briefing.slug }));
}

export async function generateMetadata({
  params,
}: AirportBriefingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const briefing = await getPublishedAirportBriefingBySlug(slug);

  if (!briefing) {
    return {
      title: "Airport Briefing Not Found | INConnect",
    };
  }

  return {
    title: briefing.seoTitle,
    description: briefing.seoDescription,
    alternates: {
      canonical: `/intelligence/airport-automation/${briefing.slug}`,
    },
    openGraph: {
      title: briefing.seoTitle,
      description: briefing.seoDescription,
      images: [
        {
          alt: briefing.title,
          height: 864,
          url: briefing.heroImageUrl,
          width: 1536,
        },
      ],
      type: "article",
      publishedTime: briefing.generatedAt,
      authors: ["INConnect Intelligence"],
      url: `/intelligence/airport-automation/${briefing.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      description: briefing.seoDescription,
      images: [briefing.heroImageUrl],
      title: briefing.seoTitle,
    },
  };
}

export default async function AirportBriefingPage({
  params,
}: AirportBriefingPageProps) {
  const { slug } = await params;
  const briefing = await getPublishedAirportBriefingBySlug(slug);

  if (!briefing) notFound();

  const previewContent = createBriefingPreview(briefing.content);
  const relatedBriefings = selectRelatedBriefings(
    briefing,
    await getPublishedAirportBriefings(),
  );
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    author: {
      "@type": "Organization",
      name: "INConnect Intelligence",
    },
    datePublished: briefing.generatedAt,
    description: briefing.seoDescription,
    headline: briefing.title,
    image: briefing.heroImageUrl,
    mainEntityOfPage: `${SITE_URL}/intelligence/airport-automation/${briefing.slug}`,
    publisher: {
      "@type": "Organization",
      name: "INConnect",
      url: SITE_URL,
    },
  };

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <article className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <Link
            className="text-sm font-semibold text-[#0A66C2] transition hover:text-[#004182]"
            href="/intelligence/airport-automation"
          >
            Back to Airport Automation Daily
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Airport Automation Daily
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            {briefing.title}
          </h1>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#666666]">
            <span>{formatAirportBriefingDate(briefing.generatedAt)}</span>
            <span>INConnect Intelligence</span>
            <span className="font-semibold text-[#057642]">1 minute read</span>
          </div>
          <div className="mt-8 aspect-video overflow-hidden rounded-lg border border-[#D9DDE3] bg-[#E8F1FB] shadow-[0_12px_30px_rgba(10,25,47,0.08)]">
            <img
              alt=""
              className="h-full w-full object-cover"
              src={briefing.heroImageUrl}
            />
          </div>
        </div>
      </article>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <IntelligenceBriefingAccess
          fullContent={briefing.content}
          intelligenceType="airport_automation"
          previewContent={previewContent}
          streamTitle="Airport Automation Daily"
          unlockTitle="Unlock Full Digest"
        />
      </section>
      <RelatedAirportBriefings briefings={relatedBriefings} />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        type="application/ld+json"
      />
      <Footer />
    </main>
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

function selectRelatedBriefings(currentBriefing: AirportBriefing, briefings: AirportBriefing[]) {
  return briefings
    .filter((briefing) => briefing.slug !== currentBriefing.slug)
    .slice(0, 3);
}

function RelatedAirportBriefings({
  briefings,
}: {
  briefings: AirportBriefing[];
}) {
  if (briefings.length === 0) return null;

  return (
    <section className="px-5 pb-12 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Recent Daily Digests
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {briefings.map((briefing) => (
            <Link
              className="group overflow-hidden rounded-lg border border-[#D9DDE3] bg-white shadow-[0_8px_24px_rgba(10,25,47,0.05)] transition hover:-translate-y-0.5 hover:border-[#0A66C2]/40 hover:shadow-[0_14px_32px_rgba(10,25,47,0.09)]"
              href={`/intelligence/airport-automation/${briefing.slug}`}
              key={briefing.slug}
            >
              <div className="aspect-[16/9] bg-[#E8F1FB]">
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  src={briefing.heroImageUrl}
                />
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
                  {formatAirportBriefingDate(briefing.generatedAt)}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#057642]">
                  1 minute read
                </p>
                <h2 className="mt-2 text-base font-semibold leading-snug text-[#191919] group-hover:text-[#0A66C2]">
                  {briefing.title}
                </h2>
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
