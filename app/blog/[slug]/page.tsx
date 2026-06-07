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
      images: [
        {
          alt: post.title,
          height: 864,
          url: post.heroImageUrl,
          width: 1536,
        },
      ],
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.authorName],
      url: `/blog/${post.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      description: post.seoDescription,
      images: [post.heroImageUrl],
      title: post.seoTitle,
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
    image: post.heroImageUrl,
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
          <div className="mt-8 aspect-video overflow-hidden rounded-lg border border-[#D9DDE3] bg-[#E8F1FB] shadow-[0_12px_30px_rgba(10,25,47,0.08)]">
            <img
              alt=""
              className="h-full w-full object-cover"
              src={post.heroImageUrl}
            />
          </div>
        </div>
      </article>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[800px] rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-9">
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
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="grid gap-5 text-[17px] leading-[1.8] text-[#444444]">
      {blocks.map((block, index) => renderMarkdownBlock(block, index))}
    </div>
  );
}

type MarkdownBlock =
  | { content: string; type: "blockquote" | "h1" | "h2" | "h3" | "p" }
  | { items: string[]; type: "ol" | "ul" };

function renderMarkdownBlock(block: MarkdownBlock, index: number) {
  switch (block.type) {
    case "h1":
      return (
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-[#191919] sm:text-4xl" key={index}>
          {renderInlineMarkdown(block.content)}
        </h1>
      );
    case "h2":
      return (
        <h2 className="mt-10 text-2xl font-semibold leading-snug text-[#191919] first:mt-0 sm:text-3xl" key={index}>
          {renderInlineMarkdown(block.content)}
        </h2>
      );
    case "h3":
      return (
        <h3 className="mt-6 text-xl font-semibold leading-snug text-[#191919]" key={index}>
          {renderInlineMarkdown(block.content)}
        </h3>
      );
    case "ul":
      return (
        <ul className="grid gap-2 pl-6 marker:text-[#0A66C2]" key={index}>
          {block.items.map((item, itemIndex) => (
            <li className="list-disc pl-1" key={`${item}-${itemIndex}`}>
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="grid gap-2 pl-6 marker:font-semibold marker:text-[#0A66C2]" key={index}>
          {block.items.map((item, itemIndex) => (
            <li className="list-decimal pl-1" key={`${item}-${itemIndex}`}>
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
    case "blockquote":
      return (
        <blockquote
          className="rounded-r-lg border-l-4 border-[#0A66C2] bg-[#F3F7FD] px-5 py-4 text-[#2F3A4A]"
          key={index}
        >
          {renderInlineMarkdown(block.content)}
        </blockquote>
      );
    default:
      return <p key={index}>{renderInlineMarkdown(block.content)}</p>;
  }
}

function renderInlineMarkdown(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const inlinePattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(value)) !== null) {
    if (match.index > lastIndex) nodes.push(value.slice(lastIndex, match.index));

    const token = match[0];
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      nodes.push(
        <Link
          className="font-semibold text-[#0A66C2] underline-offset-4 transition hover:text-[#004182] hover:underline"
          href={linkMatch[2]}
          key={`${linkMatch[1]}-${match.index}`}
        >
          {linkMatch[1]}
        </Link>,
      );
    } else {
      nodes.push(
        <strong className="font-semibold text-[#191919]" key={`${token}-${match.index}`}>
          {token.replace(/^\*\*|\*\*$/g, "")}
        </strong>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) nodes.push(value.slice(lastIndex));
  return nodes;
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (/^#\s+/.test(line)) {
      blocks.push({ content: line.replace(/^#\s+/, ""), type: "h1" });
      index += 1;
      continue;
    }

    if (/^##\s+/.test(line)) {
      blocks.push({ content: line.replace(/^##\s+/, ""), type: "h2" });
      index += 1;
      continue;
    }

    if (/^###\s+/.test(line)) {
      blocks.push({ content: line.replace(/^###\s+/, ""), type: "h3" });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ content: quoteLines.join(" "), type: "blockquote" });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ items, type: "ul" });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ items, type: "ol" });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isMarkdownBlockStart(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ content: paragraphLines.join(" "), type: "p" });
  }

  return blocks;
}

function isMarkdownBlockStart(line: string) {
  return (
    /^#{1,3}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line)
  );
}
