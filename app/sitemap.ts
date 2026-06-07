import type { MetadataRoute } from "next";
import { getPublishedBlogPosts } from "@/lib/blog-posts";
import { SITE_URL } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedBlogPosts();
  const staticRoutes = [
    "",
    "/assessment",
    "/headline-generator",
    "/about-generator",
    "/blog",
    "/pricing",
    "/about",
    "/privacy",
    "/terms",
    "/contact",
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
  ];
}
