import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-page";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "About INConnect | Professional Intelligence Platform",
  description:
    "Learn how INConnect combines professional profile intelligence, industry insights, authority building, and future networking opportunities.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <BusinessPage
      eyebrow="About INConnect"
      title="About INConnect"
      intro="INConnect is a professional intelligence platform helping professionals and companies discover opportunities, stay informed, and connect with the right people."
      sections={[
        {
          title: "What INConnect does",
          body: [
            "INConnect combines professional profile intelligence, industry insights, authority-building tools, and future networking opportunities into one platform.",
            "The platform helps users understand how they are positioned, what is happening in relevant markets, and where future professional and business opportunities may emerge.",
          ],
          items: [
            "Analyzes professional profile positioning",
            "Provides industry intelligence streams",
            "Supports authority building and clearer communication",
            "Includes practical LinkedIn tools for profile improvement",
            "Builds toward future business matching and opportunity discovery",
          ],
        },
        {
          title: "Current platform modules",
          body: [
            "INConnect currently includes the Profile Intelligence Assessment, LinkedIn Headline Generator, LinkedIn About Generator, B2B Sales & LinkedIn Daily, Airport Automation Daily, AI-generated professional insights, professional profile memory, and early foundations for future Pro tools.",
            "LinkedIn tools remain part of the platform, but the wider direction is professional intelligence, industry insights, authority building, business matching, and opportunity discovery.",
          ],
        },
        {
          title: "Long-term vision",
          body: [
            "INConnect is evolving into an intelligence layer for professional growth, business visibility, and opportunity discovery.",
            "The long-term direction includes deeper industry intelligence, professional authority signals, a professional profile graph, business opportunity matching, and partner discovery for professionals and companies.",
          ],
        },
      ]}
    />
  );
}
