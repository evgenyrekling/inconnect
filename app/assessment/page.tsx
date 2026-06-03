import type { Metadata } from "next";
import { INConnectAssessmentPage } from "@/components/inconnect-platform";

export const metadata: Metadata = {
  title: "Profile Intelligence Assessment | INConnect",
  description:
    "Upload your LinkedIn Profile PDF and receive an AI-powered profile intelligence assessment.",
};

export default function AssessmentPage() {
  return <INConnectAssessmentPage />;
}
