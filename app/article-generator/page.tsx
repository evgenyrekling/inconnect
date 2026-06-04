import type { Metadata } from "next";
import { INConnectArticleGeneratorPage } from "@/components/inconnect-platform";

export const metadata: Metadata = {
  title: "LinkedIn Article Generator | INConnect",
  description:
    "Admin-only INConnect Pro prototype for generating LinkedIn-style long-form article packages.",
};

export default function ArticleGeneratorPage() {
  return <INConnectArticleGeneratorPage />;
}
