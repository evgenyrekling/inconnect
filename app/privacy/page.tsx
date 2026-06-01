import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-page";

export const metadata: Metadata = {
  title: "Privacy | INConnect",
  description:
    "Review how INConnect handles profile assessment data, uploaded PDFs, and user contact information.",
};

export default function PrivacyPage() {
  return (
    <BusinessPage
      eyebrow="Privacy"
      title="We handle professional profile data with care."
      intro="This privacy overview explains how INConnect collects, stores, and uses information provided through the profile assessment experience."
      sections={[
        {
          title: "Information we collect",
          body: [
            "When you run an assessment, INConnect may collect your email address, LinkedIn profile URL, uploaded LinkedIn Profile PDF, extracted profile text, assessment results, usage information, and related diagnostic data needed to operate the service.",
            "We collect this information to generate and store your assessment, help returning users access their latest results, and maintain fair usage limits for free assessments.",
          ],
        },
        {
          title: "How information is used",
          body: [
            "Assessment data is used to provide profile intelligence, track score history, display recent assessments, and improve the reliability of the platform.",
            "INConnect does not post to LinkedIn, does not scrape LinkedIn, and does not sell uploaded profile PDFs.",
          ],
        },
        {
          title: "Storage and security",
          body: [
            "Uploaded PDFs and assessment records are stored using server-side infrastructure and database controls. Access is limited to the operations required to provide the assessment experience.",
            "No service can guarantee perfect security, but INConnect is designed to minimize unnecessary exposure of user data and avoid exposing secret keys or sensitive server credentials to the browser.",
          ],
        },
        {
          title: "Contact",
          body: [
            "For privacy questions or data requests, contact INConnect at hello@in-connect.app. We will review reasonable requests related to access, correction, or deletion of assessment data.",
          ],
        },
      ]}
    />
  );
}
