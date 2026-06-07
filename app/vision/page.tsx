import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-page";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "INConnect Vision 2030 | Professional Opportunity Intelligence",
  description:
    "Explore the INConnect vision for evolving from LinkedIn profile intelligence into professional opportunity matching and business visibility intelligence.",
  path: "/vision",
});

export default function VisionPage() {
  return (
    <BusinessPage
      eyebrow="Vision"
      title="INConnect Vision 2030"
      intro="From LinkedIn profile intelligence to professional opportunity matching."
      sections={[
        {
          title: "Today",
          body: [
            "INConnect is currently focused on practical LinkedIn intelligence tools that help professionals and companies clarify positioning, improve visibility, and communicate value more effectively.",
          ],
          items: [
            "Profile Intelligence Assessment",
            "Headline Generator",
            "About Generator",
            "Blog",
            "Professional profile database",
          ],
        },
        {
          title: "Next",
          body: [
            "The next stage expands INConnect from profile improvement into content, trend, history, and personal brand intelligence.",
          ],
          items: [
            "Article Generator",
            "Content Intelligence",
            "Trend Radar",
            "Profile history",
            "Personal brand intelligence",
          ],
        },
        {
          title: "2030 Vision",
          body: [
            "INConnect aims to become the intelligence layer between professional profiles, visibility, and business opportunities.",
          ],
          items: [
            "Professional opportunity matching",
            "Partner discovery",
            "Business matchmaking",
            "Company visibility intelligence",
            "AI-powered professional graph",
            "Professional reputation intelligence layer",
          ],
        },
        {
          title: "Positioning",
          body: [
            "The long-term ambition is to help professionals and companies understand not only how they appear online, but which opportunities, partners, audiences, and markets are most aligned with their expertise.",
            "The path is intentionally practical: start with profile intelligence, build memory and history, then expand toward trusted opportunity intelligence.",
          ],
        },
      ]}
    />
  );
}
