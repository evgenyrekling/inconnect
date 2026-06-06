import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components/inconnect-platform";
import { blogPosts, getBlogPostBySlug } from "@/lib/blog-posts";

type BlogArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Article Not Found | INConnect Blog",
    };
  }

  return {
    title: `${post.title} | INConnect Blog`,
    description: post.excerpt,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) notFound();

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <article className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <Link
            className="text-sm font-semibold text-[#0A66C2] transition hover:text-[#004182]"
            href="/blog"
          >
            Back to INConnect Blog
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            {post.category}
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            {post.title}
          </h1>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#666666]">
            <span>{post.date}</span>
            <span>{post.author}</span>
          </div>
        </div>
      </article>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-8">
          {post.content.map((section) => (
            <section className="border-b border-[#D9DDE3] py-7 last:border-0 last:pb-0 first:pt-0" key={section.heading}>
              <h2 className="text-2xl font-semibold text-[#191919]">
                {section.heading}
              </h2>
              <div className="mt-4 grid gap-4 text-base leading-7 text-[#444444]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
