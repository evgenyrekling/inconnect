import type { Metadata } from "next";
import { INConnectAssessmentPage } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Profile Intelligence Assessment | INConnect",
  description:
    "Upload your LinkedIn Profile PDF and receive an AI-powered profile intelligence assessment.",
  path: "/assessment",
});

export default function AssessmentPage() {
  return <INConnectAssessmentPage />;
}
