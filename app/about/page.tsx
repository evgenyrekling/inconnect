import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-page";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "About | INConnect",
  description:
    "Learn about INConnect, a professional profile intelligence platform for LinkedIn positioning and authority tracking.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <BusinessPage
      eyebrow="About INConnect"
      title="Profile intelligence for modern professionals."
      intro="INConnect helps professionals understand how their LinkedIn profile communicates authority, expertise, and market positioning."
      sections={[
        {
          title: "What INConnect does",
          body: [
            "INConnect analyzes a LinkedIn Profile PDF to produce a structured profile intelligence assessment. The platform focuses on positioning clarity, authority signals, expertise domains, and practical profile improvement opportunities.",
            "The experience is designed for professionals, founders, consultants, executives, and growth-minded teams who want a clearer picture of how they are represented in the market.",
          ],
        },
        {
          title: "Our approach",
          body: [
            "INConnect uses uploaded profile data provided by the user. It does not scrape LinkedIn, post on behalf of users, or require access to a LinkedIn account.",
            "The product is being built as a professional system of record for profile assessments, authority scoring, and long-term positioning progress.",
          ],
        },
        {
          title: "Platform direction",
          body: [
            "The current assessment experience is the foundation for future Pro capabilities, including trend radar, content intelligence, and ongoing authority tracking.",
            "Our goal is to help users make better professional positioning decisions with clear, respectful, and actionable intelligence.",
          ],
        },
      ]}
    />
  );
}
