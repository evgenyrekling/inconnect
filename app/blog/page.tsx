import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { getPublishedBlogPosts } from "@/lib/blog-posts";
import { createSeoMetadata } from "@/lib/seo";
import { BlogArticlesList } from "./blog-articles-list";

export const metadata: Metadata = createSeoMetadata({
  title: "LinkedIn Daily | INConnect",
  description:
    "Daily insights covering LinkedIn visibility, personal branding, networking, content strategy, AI tools, thought leadership, and professional growth.",
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
            Market Intelligence Stream
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            LinkedIn Daily
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
            Daily insights covering LinkedIn visibility, personal branding,
            networking, content strategy, AI tools, thought leadership, and
            professional growth.
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
