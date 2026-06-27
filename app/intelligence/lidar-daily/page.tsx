import type { Metadata } from "next";
import Link from "next/link";
import { DigestSubscriptionCard } from "@/components/digest-subscription-card";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  formatMarketArticleDate,
  getPublishedMarketArticles,
  type MarketArticle,
} from "@/lib/market-articles";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "LiDAR Daily | INConnect Market Intelligence",
  description:
    "Daily original INConnect articles covering LiDAR product launches, deployments, partnerships, funding, technology updates, and real-world applications.",
  path: "/intelligence/lidar-daily",
});

export const dynamic = "force-dynamic";

export default async function LidarDailyPage() {
  const articles = await getPublishedMarketArticles("lidar_daily");
  const latestArticle = articles[0];
  const previousArticles = articles.slice(1);

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link className="text-sm font-semibold text-[#0A66C2] hover:text-[#004182]" href="/intelligence">
            Back to Market Intelligence
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#057642]">
            Daily Articles
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            LiDAR Daily
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
            One daily original INConnect article covering LiDAR industry launches, deployments,
            partnerships, funding, market moves, and real-world applications.
          </p>
          <DigestSubscriptionCard
            description="Receive each new LiDAR Daily article by email with a short intro and link to the full INConnect article."
            digestTitle="LiDAR Daily"
            digestType="lidar_daily"
          />
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Latest article
          </p>
          {!latestArticle ? (
            <div className="mt-6 rounded-lg border border-[#D9DDE3] bg-white p-6 text-sm leading-6 text-[#666666]">
              LiDAR Daily articles will appear here after the first article is published.
            </div>
          ) : (
            <LidarArticleCard article={latestArticle} featured />
          )}
          {previousArticles.length > 0 && (
            <>
              <p className="mt-10 text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
                Previous articles
              </p>
              <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {previousArticles.map((article) => (
                  <LidarArticleCard article={article} key={article.slug} />
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

function LidarArticleCard({ article, featured = false }: { article: MarketArticle; featured?: boolean }) {
  return (
    <article className={`mt-6 flex h-full flex-col rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] ${featured ? "lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-6" : ""}`}>
      <div className="aspect-[16/9] overflow-hidden rounded-lg bg-[#E8F1FB]">
        <img alt="" className="h-full w-full object-cover" src={article.sourceImageUrl} />
      </div>
      <div className={featured ? "mt-5 lg:mt-0" : "mt-5"}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#057642]">
          <span>{article.category || "LiDAR"}</span>
          <span>&middot;</span>
          <span>{formatMarketArticleDate(article.publishedAt)}</span>
          {article.sourceName && (
            <>
              <span>&middot;</span>
              <span>{article.sourceName}</span>
            </>
          )}
        </div>
        <h2 className="mt-4 text-xl font-semibold leading-snug text-[#191919]">
          <Link className="transition hover:text-[#0A66C2]" href={`/intelligence/lidar-daily/${article.slug}`}>
            {article.title}
          </Link>
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#666666]">{article.excerpt}</p>
        <div className="mt-5 border-t border-[#D9DDE3] pt-4 text-sm">
          <Link className="font-semibold text-[#0A66C2] hover:text-[#004182]" href={`/intelligence/lidar-daily/${article.slug}`}>
            Read Article &rarr;
          </Link>
        </div>
      </div>
    </article>
  );
}
