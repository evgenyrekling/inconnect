import type { Metadata } from "next";
import { INConnectIntelligencePage } from "@/components/inconnect-platform";
import { getPublishedAirportBriefings } from "@/lib/airport-briefings";
import { type BlogPost, getPublishedBlogPosts } from "@/lib/blog-posts";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Intelligence | INConnect",
  description:
    "Daily professional intelligence streams for industry briefings, market developments, technology trends, and business opportunities.",
  path: "/intelligence",
});

export const dynamic = "force-dynamic";

const INTELLIGENCE_BLOG_TERMS = [
  "linkedin",
  "sales",
  "personal branding",
  "career growth",
  "ai",
  "professional visibility",
  "visibility",
  "thought leadership",
  "authority",
  "profile optimization",
];

export default async function IntelligencePage() {
  const [latestAirportBriefing] = await getPublishedAirportBriefings(1);
  const latestInsightPosts = getLatestIntelligencePosts(await getPublishedBlogPosts());

  return (
    <INConnectIntelligencePage
      latestAirportBriefing={
        latestAirportBriefing
          ? {
              excerpt: latestAirportBriefing.excerpt,
              generatedAt: latestAirportBriefing.generatedAt,
              slug: latestAirportBriefing.slug,
              title: latestAirportBriefing.title,
            }
          : null
      }
      latestInsightPosts={latestInsightPosts}
    />
  );
}

function getLatestIntelligencePosts(posts: BlogPost[]) {
  const relevantPosts = posts.filter((post) => {
    const value = `${post.category} ${post.title}`.toLowerCase();
    return INTELLIGENCE_BLOG_TERMS.some((term) => value.includes(term));
  });

  return (relevantPosts.length > 0 ? relevantPosts : posts).slice(0, 1);
}
