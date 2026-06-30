import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DigestSubscriptionCard } from "@/components/digest-subscription-card";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  formatMarketArticleDate,
  getPublishedMarketArticleBySlug,
  getPublishedMarketArticles,
  type MarketArticle,
} from "@/lib/market-articles";
import { SITE_URL } from "@/lib/seo";

type LidarArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 300;
export const dynamicParams = true;

export async function generateMetadata({ params }: LidarArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedMarketArticleBySlug("lidar_daily", slug);
  if (!article) return { title: "LiDAR Daily Article Not Found | INConnect" };

  const canonicalUrl = `${SITE_URL}/intelligence/lidar-daily/${article.slug}`;
  const title = `${article.title} | LiDAR Daily`;
  const description = article.excerpt || article.inconnectPerspective;
  const images = article.sourceImageUrl
    ? [{ alt: article.title, height: 864, url: article.sourceImageUrl, width: 1536 }]
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      authors: ["INConnect Market Intelligence"],
      description,
      images,
      publishedTime: article.publishedAt,
      title,
      type: "article",
      url: canonicalUrl,
    },
    twitter: {
      card: article.sourceImageUrl ? "summary_large_image" : "summary",
      description,
      images: article.sourceImageUrl ? [article.sourceImageUrl] : undefined,
      title,
    },
  };
}

export default async function LidarArticlePage({ params }: LidarArticlePageProps) {
  const { slug } = await params;
  const article = await getPublishedMarketArticleBySlug("lidar_daily", slug);
  if (!article) notFound();

  const related = (await getPublishedMarketArticles("lidar_daily", 4))
    .filter((item) => item.slug !== article.slug)
    .slice(0, 3);
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    author: { "@type": "Organization", name: "INConnect Market Intelligence" },
    dateModified: article.updatedAt,
    datePublished: article.publishedAt,
    description: article.excerpt,
    headline: article.title,
    mainEntityOfPage: `${SITE_URL}/intelligence/lidar-daily/${article.slug}`,
    publisher: { "@type": "Organization", name: "INConnect", url: SITE_URL },
    ...(article.sourceImageUrl ? { image: article.sourceImageUrl } : {}),
  };

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <article className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap gap-4">
            <Link className="text-sm font-semibold text-[#0A66C2] hover:text-[#004182]" href="/intelligence">
              Back to Market Intelligence
            </Link>
            <Link className="text-sm font-semibold text-[#0A66C2] hover:text-[#004182]" href="/intelligence/lidar-daily">
              LiDAR Daily Archive
            </Link>
          </div>
          <h1 className="mt-8 text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            {article.title}
          </h1>
          <div className="mt-5 flex flex-wrap gap-x-3 gap-y-2 text-sm font-semibold text-[#057642]">
            <span>{formatMarketArticleDate(article.publishedAt)}</span>
            {article.category && <><span>&middot;</span><span>{article.category}</span></>}
            {article.sourceName && <><span>&middot;</span><span>{article.sourceName}</span></>}
          </div>
          {article.sourceImageUrl && (
            <>
              <div className="mt-8 aspect-video overflow-hidden rounded-lg border border-[#D9DDE3] bg-[#E8F1FB] shadow-[0_12px_30px_rgba(10,25,47,0.08)]">
                <img alt="" className="h-full w-full object-cover" src={article.sourceImageUrl} />
              </div>
              {article.imageAttribution && <p className="mt-3 text-xs text-[#666666]">{article.imageAttribution}</p>}
            </>
          )}
        </div>
      </article>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_12px_30px_rgba(10,25,47,0.06)] sm:p-8">
            <ArticleBody content={article.body} />
            {article.inconnectPerspective && (
              <div className="mt-8 rounded-lg border border-[#0A66C2]/20 bg-[#F3F7FD] p-5">
                <h2 className="text-lg font-semibold text-[#191919]">INConnect Perspective</h2>
                <p className="mt-3 text-base leading-7 text-[#444444]">{article.inconnectPerspective}</p>
              </div>
            )}
            {article.sourceUrl && (
              <div className="mt-8 border-t border-[#D9DDE3] pt-6">
                <p className="text-sm leading-6 text-[#666666]">
                  Original source attribution: {article.sourceName || article.sourceDomain}
                </p>
                <a className="mt-3 inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white hover:bg-[#3859B8]" href={article.sourceUrl} rel="noopener noreferrer" target="_blank">
                  Read Original Source
                </a>
              </div>
            )}
          </div>
          <DigestSubscriptionCard description="Get each new LiDAR Daily article in your inbox." digestTitle="LiDAR Daily" digestType="lidar_daily" />
        </div>
      </section>
      <RelatedArticles articles={related} />
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} type="application/ld+json" />
      <Footer />
    </main>
  );
}

function ArticleBody({ content }: { content: string }) {
  const paragraphs = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="space-y-6">
      {paragraphs.map((paragraph) => (
        <p className="text-[1.03rem] leading-8 text-[#3F3F3F]" key={paragraph}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function RelatedArticles({ articles }: { articles: MarketArticle[] }) {
  if (articles.length === 0) return null;
  return (
    <section className="px-5 pb-12 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">More LiDAR Daily</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {articles.map((article) => (
            <Link className="rounded-lg border border-[#D9DDE3] bg-white p-4 shadow-[0_8px_24px_rgba(10,25,47,0.05)] transition hover:border-[#0A66C2]/40" href={`/intelligence/lidar-daily/${article.slug}`} key={article.slug}>
              <p className="text-xs font-semibold text-[#057642]">{formatMarketArticleDate(article.publishedAt)}</p>
              <h2 className="mt-2 text-base font-semibold leading-snug text-[#191919]">{article.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#666666]">{article.excerpt}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
