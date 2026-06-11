import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-page";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "INConnect Vision 2030 | Professional Intelligence Platform",
  description:
    "Explore the INConnect vision for professional intelligence, industry insights, authority building, opportunity discovery, and future business matching.",
  path: "/vision",
});

export default function VisionPage() {
  return (
    <BusinessPage
      eyebrow="Vision"
      title="INConnect Vision 2030"
      intro="From profile intelligence and industry insights to professional opportunity discovery."
      sections={[
        {
          title: "Today",
          body: [
            "INConnect is currently focused on practical professional intelligence tools that help professionals and companies clarify positioning, stay informed, build authority, and communicate value more effectively.",
          ],
          items: [
            "Profile Intelligence Assessment",
            "Headline Generator",
            "About Generator",
            "Airport Automation Daily",
            "LinkedIn Daily",
            "Professional profile database",
          ],
        },
        {
          title: "Next",
          body: [
            "The next stage expands INConnect from profile improvement into industry intelligence, opportunity signals, professional history, and personal brand intelligence.",
          ],
          items: [
            "Article Generator",
            "Industry intelligence streams",
            "Opportunity discovery signals",
            "Profile history",
            "Personal brand intelligence",
          ],
        },
        {
          title: "2030 Vision",
          body: [
            "INConnect aims to become the intelligence layer between professional profiles, industry developments, trusted networks, and business opportunities.",
          ],
          items: [
            "Professional opportunity matching",
            "Partner discovery",
            "Business matchmaking",
            "Company intelligence and visibility",
            "AI-powered professional graph",
            "Professional reputation intelligence layer",
          ],
        },
        {
          title: "Positioning",
          body: [
            "The long-term ambition is to help professionals and companies understand not only how they appear online, but which opportunities, partners, audiences, industries, and markets are most aligned with their expertise.",
            "The path is intentionally practical: start with profile intelligence and industry insights, build memory and history, then expand toward trusted opportunity intelligence and business matching.",
          ],
        },
      ]}
    />
  );
}
