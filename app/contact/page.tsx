import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-page";

export const metadata: Metadata = {
  title: "Contact | INConnect",
  description:
    "Contact INConnect for product questions, support, privacy requests, and partnership inquiries.",
};

export default function ContactPage() {
  return (
    <BusinessPage
      eyebrow="Contact"
      title="Get in touch with INConnect."
      intro="For product questions, support, privacy requests, and professional partnership inquiries, contact the INConnect team."
      sections={[
        {
          title: "Email",
          body: [
            "The best way to reach INConnect is by email at hello@in-connect.app. Please include a short description of your request so we can route it appropriately.",
          ],
        },
        {
          title: "Support topics",
          body: [
            "We can help with assessment access, uploaded PDF issues, returning-user history, account questions, and general product feedback.",
            "For privacy or data requests, include the email address and LinkedIn profile URL used for the assessment so we can identify the relevant record.",
          ],
        },
        {
          title: "Business inquiries",
          body: [
            "INConnect is built for professionals and teams who care about authority, market positioning, and profile intelligence. We welcome thoughtful product, partnership, and early customer conversations.",
          ],
        },
      ]}
    />
  );
}
