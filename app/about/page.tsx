import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-page";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "About INConnect | AI LinkedIn Intelligence Platform",
  description:
    "Learn how INConnect helps professionals and companies improve LinkedIn visibility, positioning, authority, and growth.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <BusinessPage
      eyebrow="About INConnect"
      title="About INConnect"
      intro="INConnect helps professionals and companies improve their visibility, positioning, authority, and growth on LinkedIn."
      sections={[
        {
          title: "What INConnect does",
          body: [
            "INConnect is a LinkedIn intelligence platform for understanding how professional profiles communicate expertise, credibility, and market value.",
            "The platform combines profile assessment, AI-generated professional insights, profile memory, and practical content tools so users can communicate value more clearly.",
          ],
          items: [
            "Analyzes LinkedIn profile positioning",
            "Generates stronger LinkedIn headlines",
            "Creates clearer LinkedIn About sections",
            "Helps professionals communicate value clearly",
            "Supports future content and opportunity intelligence",
          ],
        },
        {
          title: "Current platform modules",
          body: [
            "INConnect currently includes the Profile Intelligence Assessment, LinkedIn Headline Generator, LinkedIn About Generator, B2B Sales & LinkedIn Daily intelligence stream, AI-generated professional insights, professional profile memory, and early foundations for future Pro tools.",
            "Each module is designed to make professional positioning more practical, measurable, and useful for real career and business decisions.",
          ],
        },
        {
          title: "Long-term vision",
          body: [
            "INConnect is evolving from a LinkedIn optimization tool into a professional intelligence platform.",
            "The long-term direction includes deeper visibility and authority intelligence, a professional profile graph, business opportunity matching, and partner discovery for professionals and companies.",
          ],
        },
      ]}
    />
  );
}
