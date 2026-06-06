import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  getFeaturedBlogPosts,
  getLatestBlogPosts,
  type BlogPost,
} from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "INConnect Blog | LinkedIn Growth and Professional Positioning",
  description:
    "LinkedIn growth, personal branding, AI, leadership, and professional positioning insights from INConnect.",
};

export default function BlogPage() {
  const featuredPosts = getFeaturedBlogPosts();
  const latestPosts = getLatestBlogPosts();

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Insights
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            INConnect Blog
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
            LinkedIn growth, personal branding, AI, leadership, and professional
            positioning insights.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
                Featured Articles
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#191919]">
                Start with profile visibility and positioning.
              </h2>
            </div>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {featuredPosts.map((post) => (
              <BlogPostCard isFeatured key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Latest Articles
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {latestPosts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function BlogPostCard({
  isFeatured = false,
  post,
}: {
  isFeatured?: boolean;
  post: BlogPost;
}) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
        <span>{post.category}</span>
        {isFeatured && <span className="text-[#666666]">Featured</span>}
      </div>
      <h3 className="mt-4 text-xl font-semibold leading-snug text-[#191919]">
        <Link className="transition hover:text-[#0A66C2]" href={`/blog/${post.slug}`}>
          {post.title}
        </Link>
      </h3>
      <p className="mt-3 flex-1 text-sm leading-6 text-[#666666]">{post.excerpt}</p>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#D9DDE3] pt-4 text-sm">
        <span className="text-[#666666]">{post.date}</span>
        <Link
          className="font-semibold text-[#0A66C2] transition hover:text-[#004182]"
          href={`/blog/${post.slug}`}
        >
          Read article
        </Link>
      </div>
    </article>
  );
}
