import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-page";

export const metadata: Metadata = {
  title: "Terms | INConnect",
  description:
    "Review the terms for using INConnect profile intelligence assessments and related platform features.",
};

export default function TermsPage() {
  return (
    <BusinessPage
      eyebrow="Terms"
      title="Professional use terms for INConnect."
      intro="These terms describe the expected use of INConnect and the profile intelligence assessments generated through the platform."
      sections={[
        {
          title: "Use of the platform",
          body: [
            "INConnect is provided to help users understand and improve their professional profile positioning. You are responsible for ensuring that information you upload is yours to use and that your use of the platform complies with applicable obligations.",
            "You may not use INConnect to upload unlawful, infringing, deceptive, or harmful content, or to interfere with the availability or security of the service.",
          ],
        },
        {
          title: "Assessment outputs",
          body: [
            "Assessment results are informational and should be treated as professional guidance, not a guarantee of career outcomes, business results, hiring decisions, or social media performance.",
            "You remain responsible for reviewing recommendations before applying them to your profile, communications, or business materials.",
          ],
        },
        {
          title: "Availability and future features",
          body: [
            "Some features may be marked as coming soon or planned for future Pro releases. These labels communicate product direction and do not guarantee a specific release date or feature scope.",
            "INConnect may update, pause, or modify features as the platform evolves.",
          ],
        },
        {
          title: "Questions",
          body: [
            "For questions about these terms, contact INConnect at hello@in-connect.app.",
          ],
        },
      ]}
    />
  );
}
