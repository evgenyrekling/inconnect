import type { Metadata } from "next";
import { BusinessPage } from "@/components/business-page";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Terms of Use | INConnect",
  description:
    "Review the terms for using INConnect, including AI-generated results, uploaded content, acceptable use, and future Pro features.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <BusinessPage
      eyebrow="Terms of Use"
      title="Terms of Use"
      intro="These terms describe the expected use of INConnect, including its LinkedIn intelligence tools, AI-generated outputs, and future platform features."
      sections={[
        {
          title: "Acceptance of Terms",
          body: [
            "By using INConnect, you agree to use the platform responsibly and in accordance with these terms. If you do not agree, you should not use the service.",
          ],
        },
        {
          title: "Description of Service",
          body: [
            "INConnect provides LinkedIn profile intelligence, headline generation, About section generation, blog content, and related professional positioning tools.",
            "The platform is designed to help professionals and companies understand and improve visibility, authority, and communication of value on LinkedIn.",
          ],
        },
        {
          title: "AI-Generated Results",
          body: [
            "INConnect provides AI-generated suggestions, assessments, profile insights, headlines, About sections, and related outputs.",
            "Users are responsible for reviewing, editing, and deciding how to use any AI-generated results before applying them to a profile, message, article, or business activity.",
          ],
        },
        {
          title: "No Guarantee of Outcomes",
          body: [
            "INConnect does not guarantee jobs, sales, profile views, leads, revenue, business outcomes, search rankings, partnerships, or social media performance.",
            "Results depend on many external factors, including user behavior, market conditions, audience relevance, and platform changes outside INConnect's control.",
          ],
        },
        {
          title: "User Responsibility",
          body: [
            "You are responsible for the accuracy of information you provide, the documents you upload, and the way you use generated outputs.",
            "You should not treat INConnect outputs as legal, financial, employment, or professional certification advice.",
          ],
        },
        {
          title: "Acceptable Use",
          body: [
            "You may not use INConnect to upload unlawful, infringing, deceptive, harmful, or abusive content.",
            "You may not attempt to disrupt the service, bypass usage limits, access private systems, or use the platform to misrepresent your identity or credentials.",
          ],
        },
        {
          title: "Uploaded Content",
          body: [
            "Users confirm they have the right to upload profile documents and use generated outputs created from the information they provide.",
            "Uploaded LinkedIn Profile PDFs and related data are used to provide the requested assessment and platform memory features.",
          ],
        },
        {
          title: "Intellectual Property",
          body: [
            "INConnect, its branding, interface, platform structure, and proprietary assessment logic remain the property of INConnect or its owner.",
            "Users may use generated outputs for their own professional profile and business communication, subject to these terms.",
          ],
        },
        {
          title: "Future Pro Features",
          body: [
            "Some features may later become paid, Pro-only, limited, modified, or discontinued as the platform evolves.",
            "Coming soon labels describe product direction and do not guarantee a specific launch date, feature scope, or pricing model.",
          ],
        },
        {
          title: "Limitation of Liability",
          body: [
            "INConnect is provided as an informational and productivity tool. To the fullest extent permitted by law, INConnect is not liable for indirect, incidental, consequential, or business losses related to use of the service.",
          ],
        },
        {
          title: "Changes to Terms",
          body: [
            "INConnect may update these terms as the platform changes. Continued use of the service after updates means you accept the revised terms.",
          ],
        },
        {
          title: "Contact",
          body: [
            "For questions about these terms, contact INConnect at evgeny.rekling@gmail.com.",
          ],
        },
      ]}
    />
  );
}
