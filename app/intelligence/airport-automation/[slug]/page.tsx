import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DigestSubscriptionCard } from "@/components/digest-subscription-card";
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

  const canonicalUrl = `${SITE_URL}/intelligence/airport-automation/${briefing.slug}`;
  const title = briefing.seoTitle || `${briefing.title} | Airport Automation Daily`;

  return {
    title,
    description: briefing.seoDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
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
      authors: ["INConnect Market Intelligence"],
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      description: briefing.seoDescription,
      images: [briefing.heroImageUrl],
      title,
    },
  };
}

export default async function AirportBriefingPage({
  params,
}: AirportBriefingPageProps) {
  const { slug } = await params;
  const briefing = await getPublishedAirportBriefingBySlug(slug);

  if (!briefing) notFound();

  const displayContent = briefing.isSourceBased
    ? createSourceBasedDisplayContent(briefing)
    : formatAirportPostForDisplay(briefing.content);
  const relatedBriefings = selectRelatedBriefings(
    briefing,
    await getPublishedAirportBriefings(),
  );
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    author: {
      "@type": "Organization",
      name: "INConnect Market Intelligence",
    },
    dateModified: briefing.generatedAt,
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
          <div className="flex flex-wrap gap-4">
            <Link
              className="text-sm font-semibold text-[#0A66C2] transition hover:text-[#004182]"
              href="/intelligence"
            >
              Back to Market Intelligence
            </Link>
            <Link
              className="text-sm font-semibold text-[#0A66C2] transition hover:text-[#004182]"
              href="/intelligence/airport-automation"
            >
              Airport Automation Archive
            </Link>
          </div>
          <h1 className="mt-8 text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            {briefing.title}
          </h1>
          <div className="mt-5 flex flex-wrap gap-x-3 gap-y-2 text-sm font-semibold text-[#057642]">
            <span>{formatAirportBriefingDate(briefing.generatedAt)}</span>
            <span>&middot;</span>
            <span>1 Minute Read</span>
            {briefing.sourceName && (
              <>
                <span>&middot;</span>
                <span>{briefing.sourceName}</span>
              </>
            )}
          </div>
          <div className="mt-8 aspect-video overflow-hidden rounded-lg border border-[#D9DDE3] bg-[#E8F1FB] shadow-[0_12px_30px_rgba(10,25,47,0.08)]">
            <img
              alt=""
              className="h-full w-full object-cover"
              src={briefing.heroImageUrl}
            />
          </div>
          {!briefing.isSourceBased && (
            <p className="mt-8 text-lg leading-8 text-[#444444]">
              {briefing.excerpt}
            </p>
          )}
          {briefing.isSourceBased && briefing.sourceName && (
            <p className="mt-8 text-sm font-semibold text-[#666666]">
              Source-based INConnect digest from {briefing.sourceName}
            </p>
          )}
          {briefing.imageAttribution && (
            <p className="mt-3 text-xs leading-5 text-[#666666]">
              {briefing.imageAttribution}
            </p>
          )}
        </div>
      </article>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_12px_30px_rgba(10,25,47,0.06)] sm:p-8">
            <AirportBriefingBody content={displayContent} />
            {briefing.sourceUrl && (
              <div className="mt-8 flex flex-col gap-3 border-t border-[#D9DDE3] pt-6 sm:flex-row">
                <a
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
                  href={briefing.sourceUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Read Full Story
                </a>
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#191919] transition hover:border-[#0A66C2] hover:text-[#0A66C2]"
                  href={`/intelligence/airport-automation/${briefing.slug}`}
                >
                  Read on INConnect
                </Link>
              </div>
            )}
          </div>
          <DigestSubscriptionCard
            description="Get each new Airport Automation Daily briefing in your inbox."
            digestTitle="Airport Automation Daily"
            digestType="airport_automation_daily"
          />
        </div>
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

function formatAirportPostForDisplay(content: string) {
  return content
    .replace(/^##\s+Post\s*/i, "")
    .replace(/^Airport Automation Daily\s*\|[^\n]+\n*/i, "")
    .replace(/\n*Read original story:[\s\S]*$/i, "")
    .replace(/^##\s+(?:Source|Discussion Question|Why It Matters|INConnect View|INConnect Brief)\s*$/gim, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createSourceBasedDisplayContent(briefing: AirportBriefing) {
  return [
    "## Summary",
    "",
    briefing.summary || briefing.excerpt,
    "",
    "## INConnect View",
    "",
    briefing.inconnectView || "",
  ].join("\n").trim();
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
          Recent Intelligence Posts
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
                <p className="text-xs font-semibold text-[#057642]">
                  {formatAirportBriefingDate(briefing.generatedAt)} &middot; 1 Minute Read
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

function AirportBriefingBody({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return (
    <div className="space-y-7">
      {blocks.map((block, index) => (
        block.startsWith("## ") ? (
          <h2 className="text-xl font-semibold text-[#191919]" key={block}>
            {block.replace(/^##\s+/, "")}
          </h2>
        ) : (
          <p
            className={classNames(
              "text-[1.03rem] leading-8 text-[#3F3F3F]",
              index === 0 && "text-lg leading-8 text-[#2B2B2B]",
            )}
            key={block}
          >
            <FormattedAirportText text={block} />
          </p>
        )
      ))}
    </div>
  );
}

function FormattedAirportText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    if (match.index === undefined) continue;
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a
          className="font-semibold text-[#0A66C2] underline decoration-[#0A66C2]/25 underline-offset-4 transition hover:text-[#004182] hover:decoration-[#004182]"
          href={match[3]}
          key={`${match.index}-${match[3]}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          <FormattedAirportText text={match[2]} />
        </a>,
      );
    } else if (match[4]) {
      nodes.push(
        <strong className="font-semibold text-[#191919]" key={`${match.index}-${match[4]}`}>
          {match[4]}
        </strong>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <>{nodes}</>;
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}


