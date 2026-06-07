import type { Metadata } from "next";
import { INConnectArticleGeneratorPage } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "LinkedIn Article Generator | INConnect",
  description:
    "Admin-only INConnect Pro prototype for generating LinkedIn-style long-form article packages.",
  path: "/article-generator",
});

export default function ArticleGeneratorPage() {
  return <INConnectArticleGeneratorPage />;
}
