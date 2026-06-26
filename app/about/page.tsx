import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-page";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "About INConnect | Professional Intelligence Platform",
  description:
    "Learn how INConnect connects professionals, companies, and market insights through a professional intelligence platform.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <BusinessPage
      eyebrow="About INConnect"
      title="About INConnect"
      intro="INConnect is a professional intelligence platform that connects people, companies, and market insights."
      sections={[
        {
          title: "Professionals: people and expertise",
          body: [
            "INConnect helps professionals create a credible professional profile, highlight expertise, and become visible to the right business network.",
            "The professional layer is designed around people, skills, credibility, and future opportunity discovery.",
          ],
          items: [
            "Professional profiles",
            "Expertise and industry signals",
            "Profile visibility controls",
            "Future expert discovery",
          ],
        },
        {
          title: "Companies: organizations and business targets",
          body: [
            "Companies are the organization layer of INConnect: airport operators, airlines, technology suppliers, system integrators, authorities, ground handlers, cargo operators, consultants, and partners.",
            "This layer becomes the foundation for future business development, account intelligence, and company-to-professional matching.",
          ],
          items: [
            "Airport operators",
            "Suppliers and integrators",
            "Authorities and ground handlers",
            "Future business targets",
          ],
        },
        {
          title: "Market Intelligence: briefings, news, and technology watch",
          body: [
            "INConnect Market Intelligence tracks daily briefings, industry news, reports, technology trends, and market signals.",
            "Airport Automation Daily and LinkedIn Daily are the first active intelligence streams, with more verticals planned.",
          ],
          items: [
            "Daily briefings",
            "Industry news",
            "Reports and market insights",
            "Technology watch",
          ],
        },
        {
          title: "Tools: practical AI support",
          body: [
            "INConnect also includes practical AI tools for professional visibility and business development.",
            "LinkedIn tools remain part of the platform, but INConnect is not only a LinkedIn tool. The broader platform connects professionals, companies, and market intelligence.",
          ],
          items: [
            "LinkedIn Assessment",
            "Headline Generator",
            "Content Intelligence",
            "Trend Radar",
          ],
        },
        {
          title: "Long-term vision",
          body: [
            "INConnect is evolving into an intelligence layer for professional growth, company discovery, market understanding, and opportunity matching.",
            "The long-term direction includes deeper market intelligence, professional authority signals, company account intelligence, business matching, and partner discovery.",
          ],
        },
      ]}
    />
  );
}
