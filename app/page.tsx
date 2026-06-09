import type { Metadata } from "next";
import { INConnectHomePage } from "@/components/inconnect-platform";
import { createSeoMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  description:
    "INConnect combines professional profile intelligence, industry insights, and future networking opportunities to help professionals and companies grow.",
  path: "/",
  title: "INConnect | Professional Intelligence Platform",
});

export default function Home() {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description:
      "Professional intelligence platform combining profile intelligence, industry insights, authority building, and future business matching.",
    name: "INConnect",
    potentialAction: {
      "@type": "SearchAction",
      queryInput: "required name=search_term_string",
      target: `${SITE_URL}/blog?search={search_term_string}`,
    },
    url: SITE_URL,
  };

  return (
    <>
      <INConnectHomePage />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        type="application/ld+json"
      />
    </>
  );
}
