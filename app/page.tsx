import type { Metadata } from "next";
import { INConnectHomePage } from "@/components/inconnect-platform";
import { createSeoMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  description:
    "Professional intelligence for growth, visibility, and connections. Discover opportunities, stay informed, improve your professional presence, and connect with the right people.",
  path: "/",
  title: "INConnect | Professional Intelligence Platform",
});

export default function Home() {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description:
      "Professional intelligence platform combining industry insights, professional visibility tools, and future network intelligence.",
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
