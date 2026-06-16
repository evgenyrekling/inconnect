import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogArticleAccess } from "@/app/blog/[slug]/blog-article-access";
import { DigestSubscriptionCard } from "@/components/digest-subscription-card";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  type BlogPost,
  demoBlogPosts,
  formatBlogDate,
  getPublishedBlogPostBySlug,
  getPublishedBlogPosts,
} from "@/lib/blog-posts";
import { SITE_URL } from "@/lib/seo";

type LinkedInDailyBriefingPageProps = {
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
}: LinkedInDailyBriefingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "LinkedIn Daily Briefing Not Found | INConnect",
    };
  }

  const canonicalUrl = `${SITE_URL}/intelligence/linkedin-daily/${post.slug}`;

  return {
    title: post.seoTitle,
    description: post.seoDescription,
    alternates: {
      canonical: canonicalUrl,
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
      authors: ["INConnect Intelligence"],
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      description: post.seoDescription,
      images: [post.heroImageUrl],
      title: post.seoTitle,
    },
  };
}

export default async function LinkedInDailyBriefingPage({
  params,
}: LinkedInDailyBriefingPageProps) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);

  if (!post) notFound();

  const articleContent = prepareArticleContent(post.content);
  const previewContent = createArticlePreview(post.content);
  const relatedArticles = selectRelatedArticles(
    post,
    await getPublishedBlogPosts(),
  );
  const canonicalUrl = `${SITE_URL}/intelligence/linkedin-daily/${post.slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    author: {
      "@type": "Organization",
      name: "INConnect Intelligence",
    },
    dateModified: post.publishedAt,
    datePublished: post.publishedAt,
    description: post.seoDescription,
    headline: post.title,
    image: post.heroImageUrl,
    mainEntityOfPage: canonicalUrl,
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
              Back to Intelligence
            </Link>
            <Link
              className="text-sm font-semibold text-[#0A66C2] transition hover:text-[#004182]"
              href="/intelligence/linkedin-daily"
            >
              LinkedIn Daily Archive
            </Link>
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            LinkedIn Daily
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            {post.title}
          </h1>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#666666]">
            <span>{formatBlogDate(post.publishedAt)}</span>
            <span>INConnect Intelligence</span>
          </div>
          <div className="mt-8 aspect-video overflow-hidden rounded-lg border border-[#D9DDE3] bg-[#E8F1FB] shadow-[0_12px_30px_rgba(10,25,47,0.08)]">
            <img
              alt=""
              className="h-full w-full object-cover"
              src={post.heroImageUrl}
            />
          </div>
          <p className="mt-8 text-lg leading-8 text-[#444444]">
            {post.excerpt}
          </p>
        </div>
      </article>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[820px]">
          <BlogArticleAccess
            fullContent={articleContent}
            previewContent={previewContent}
          />
          <DigestSubscriptionCard
            description="Get each new LinkedIn Daily briefing in your inbox."
            digestTitle="LinkedIn Daily"
            digestType="linkedin_daily"
          />
        </div>
      </section>
      <RelatedLinkedInBriefings articles={relatedArticles} />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        type="application/ld+json"
      />
      <Footer />
    </main>
  );
}

const ARTICLE_NEXT_STEPS = [
  "## Next Steps",
  "",
  "- [Run Free Assessment](/assessment)",
  "- [Generate LinkedIn Headline](/headline-generator)",
  "- [Generate LinkedIn About Section](/about-generator)",
].join("\n");

function prepareArticleContent(content: string) {
  const contentWithoutManagedSections = removeManagedArticleSections(content.trim());
  return `${contentWithoutManagedSections}\n\n${ARTICLE_NEXT_STEPS}`;
}

function createArticlePreview(content: string) {
  const contentWithoutManagedSections = removeManagedArticleSections(content.trim());
  return truncateMarkdownByWordShare(contentWithoutManagedSections, 0.3);
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

function removeManagedArticleSections(content: string) {
  return content
    .replace(/\n*##\s+Further Reading[\s\S]*$/i, "")
    .replace(
      /\n*##\s+(?:Improve Your LinkedIn Presence|Next Steps|Try INConnect's Free Tools)[\s\S]*$/i,
      "",
    )
    .replace(
      /\n*Want to improve your LinkedIn presence\? Try INConnect's free AI tools(?:\s+at\s+\/assessment,\s+\/headline-generator,\s+and\s+\/about-generator)?\.?[\s\S]*$/i,
      "",
    )
    .trim();
}

function selectRelatedArticles(currentPost: BlogPost, posts: BlogPost[]) {
  const candidates = posts.filter((post) => post.slug !== currentPost.slug);
  const sameCategoryPosts = candidates.filter(
    (post) => post.category === currentPost.category,
  );

  return [
    ...sameCategoryPosts,
    ...candidates.filter((post) => post.category !== currentPost.category),
  ].slice(0, 3);
}

function RelatedLinkedInBriefings({ articles }: { articles: BlogPost[] }) {
  if (articles.length === 0) return null;

  return (
    <section className="px-5 pb-12 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
          Related LinkedIn Daily Briefings
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {articles.map((article) => (
            <Link
              className="group overflow-hidden rounded-lg border border-[#D9DDE3] bg-white shadow-[0_8px_24px_rgba(10,25,47,0.05)] transition hover:-translate-y-0.5 hover:border-[#0A66C2]/40 hover:shadow-[0_14px_32px_rgba(10,25,47,0.09)]"
              href={`/intelligence/linkedin-daily/${article.slug}`}
              key={article.slug}
            >
              <div className="aspect-[16/9] bg-[#E8F1FB]">
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  src={article.heroImageUrl}
                />
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
                  {article.category}
                </p>
                <h2 className="mt-2 text-base font-semibold leading-snug text-[#191919] group-hover:text-[#0A66C2]">
                  {article.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#666666]">
                  {article.excerpt}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
