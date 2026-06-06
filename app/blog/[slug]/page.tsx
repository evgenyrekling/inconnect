import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  demoBlogPosts,
  formatBlogDate,
  getPublishedBlogPostBySlug,
} from "@/lib/blog-posts";

type BlogArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const revalidate = 300;
export const dynamicParams = true;

export function generateStaticParams() {
  return demoBlogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Article Not Found | INConnect Blog",
    };
  }

  return {
    title: post.seoTitle,
    description: post.seoDescription,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.seoTitle,
      description: post.seoDescription,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.authorName],
      url: `/blog/${post.slug}`,
    },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);

  if (!post) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    author: {
      "@type": "Organization",
      name: post.authorName,
    },
    datePublished: post.publishedAt,
    description: post.seoDescription,
    headline: post.title,
    mainEntityOfPage: `https://inconnect.app/blog/${post.slug}`,
    publisher: {
      "@type": "Organization",
      name: "INConnect",
      url: "https://inconnect.app",
    },
  };

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
            <span>{formatBlogDate(post.publishedAt)}</span>
            <span>{post.authorName}</span>
          </div>
        </div>
      </article>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-8">
          <MarkdownContent content={post.content} />
        </div>
      </section>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        type="application/ld+json"
      />
      <Footer />
    </main>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return (
    <div className="grid gap-5 text-base leading-7 text-[#444444]">
      {blocks.map((block, index) => renderMarkdownBlock(block, index))}
    </div>
  );
}

function renderMarkdownBlock(block: string, index: number) {
  if (block.startsWith("### ")) {
    return (
      <h3 className="mt-4 text-xl font-semibold text-[#191919]" key={index}>
        {renderInlineMarkdown(block.replace(/^###\s+/, ""))}
      </h3>
    );
  }

  if (block.startsWith("## ")) {
    return (
      <h2 className="mt-6 text-2xl font-semibold text-[#191919] first:mt-0" key={index}>
        {renderInlineMarkdown(block.replace(/^##\s+/, ""))}
      </h2>
    );
  }

  if (block.startsWith("- ")) {
    return (
      <ul className="grid gap-2 pl-5" key={index}>
        {block.split("\n").map((line) => (
          <li className="list-disc" key={line}>
            {renderInlineMarkdown(line.replace(/^-\s+/, ""))}
          </li>
        ))}
      </ul>
    );
  }

  return <p key={index}>{renderInlineMarkdown(block.replace(/\n/g, " "))}</p>;
}

function renderInlineMarkdown(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(value)) !== null) {
    if (match.index > lastIndex) nodes.push(value.slice(lastIndex, match.index));
    nodes.push(
      <Link
        className="font-semibold text-[#0A66C2] transition hover:text-[#004182]"
        href={match[2]}
        key={`${match[1]}-${match.index}`}
      >
        {match[1]}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) nodes.push(value.slice(lastIndex));
  return nodes;
}
