import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-page";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Contact INConnect",
  description:
    "Contact INConnect for questions, feedback, partnership opportunities, privacy requests, and data deletion requests.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <BusinessPage
      eyebrow="Contact"
      title="Contact INConnect"
      intro="For questions, feedback, partnership inquiries, or data deletion requests, contact INConnect directly."
      sections={[
        {
          title: "General Questions",
          body: [
            "For product questions, feedback, support, or general INConnect inquiries, email evgeny.rekling@gmail.com.",
          ],
        },
        {
          title: "Partnership Opportunities",
          body: [
            "For professional partnerships, platform collaborations, business development, or future Pro feature discussions, email evgeny.rekling@gmail.com.",
          ],
        },
        {
          title: "Privacy / Data Deletion Requests",
          body: [
            "For privacy questions or deletion requests, email evgeny.rekling@gmail.com and include the email address used with INConnect so the relevant records can be located.",
          ],
        },
      ]}
    />
  );
}
