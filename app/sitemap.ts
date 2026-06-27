import type { MetadataRoute } from "next";
import { getPublishedAirportBriefings } from "@/lib/airport-briefings";
import { getPublishedBlogPosts } from "@/lib/blog-posts";
import { getPublishedMarketArticles } from "@/lib/market-articles";
import { getPublicProfiles } from "@/lib/public-profiles";
import { SITE_URL } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, airportBriefings, lidarArticles, publicProfiles] = await Promise.all([
    getPublishedBlogPosts(),
    getPublishedAirportBriefings(),
    getPublishedMarketArticles("lidar_daily"),
    getPublicProfiles(),
  ]);
  const staticRoutes = [
    "",
    "/assessment",
    "/headline-generator",
    "/about-generator",
    "/intelligence",
    "/intelligence/airport-automation",
    "/intelligence/lidar-daily",
    "/intelligence/linkedin-daily",
    "/intelligence/smart-mobility",
    "/intelligence/industrial-automation",
    "/network",
    "/network/accounts",
    "/network/accounts/airports",
    "/network/profiles",
    "/blog",
    "/pricing",
    "/about",
    "/privacy",
    "/terms",
    "/contact",
    "/vision",
  ];

  return [
    ...staticRoutes.map((route) => ({
      changeFrequency: route === "" || route === "/blog" ? ("daily" as const) : ("weekly" as const),
      lastModified: new Date(),
      priority: route === "" ? 1 : route === "/blog" ? 0.9 : 0.7,
      url: `${SITE_URL}${route}`,
    })),
    ...posts.map((post) => ({
      changeFrequency: "weekly" as const,
      lastModified: new Date(post.publishedAt),
      priority: 0.8,
      url: `${SITE_URL}/blog/${post.slug}`,
    })),
    ...posts.map((post) => ({
      changeFrequency: "daily" as const,
      lastModified: new Date(post.publishedAt),
      priority: 0.85,
      url: `${SITE_URL}/intelligence/linkedin-daily/${post.slug}`,
    })),
    ...airportBriefings.map((briefing) => ({
      changeFrequency: "daily" as const,
      lastModified: new Date(briefing.generatedAt),
      priority: 0.8,
      url: `${SITE_URL}/intelligence/airport-automation/${briefing.slug}`,
    })),
    ...lidarArticles.map((article) => ({
      changeFrequency: "daily" as const,
      lastModified: new Date(article.publishedAt),
      priority: 0.8,
      url: `${SITE_URL}/intelligence/lidar-daily/${article.slug}`,
    })),
    ...publicProfiles.map((profile) => ({
      changeFrequency: "weekly" as const,
      lastModified: new Date(),
      priority: 0.7,
      url: `${SITE_URL}/p/${profile.slug}`,
    })),
  ];
}
