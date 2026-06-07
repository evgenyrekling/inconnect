import type { Metadata } from "next";
import { INConnectHomePage } from "@/components/inconnect-platform";
import { createSeoMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  description:
    "Discover how the market sees you and improve your LinkedIn positioning, visibility, authority, and professional growth opportunities with INConnect.",
  path: "/",
  title: "INConnect | Your AI LinkedIn Intelligence Platform",
});

export default function Home() {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description:
      "AI LinkedIn intelligence platform for profile assessment, headline generation, About section generation, and professional positioning insights.",
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
