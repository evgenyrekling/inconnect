import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { getPublishedBlogPosts } from "@/lib/blog-posts";
import { createSeoMetadata } from "@/lib/seo";
import { BlogArticlesList } from "./blog-articles-list";

export const metadata: Metadata = createSeoMetadata({
  title: "B2B Sales & LinkedIn Daily | INConnect",
  description:
    "Daily INConnect briefings on LinkedIn growth, profile optimization, B2B visibility, personal branding, AI tools, and professional authority.",
  path: "/blog",
});

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const latestPosts = await getPublishedBlogPosts();

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Intelligence Stream
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            B2B Sales & LinkedIn Daily
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
            Daily insights from INConnect covering LinkedIn growth, profile
            optimization, B2B visibility, personal branding, AI tools, and
            professional authority.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Latest Briefings
          </p>
          <BlogArticlesList posts={latestPosts} />
        </div>
      </section>
      <Footer />
    </main>
  );
}
