import type { Metadata } from "next";
import { INConnectHeadlineGeneratorPage } from "@/components/inconnect-platform";

export const metadata: Metadata = {
  title: "LinkedIn Headline Generator | INConnect",
  description:
    "Generate strategic LinkedIn headline options from your role, expertise, industries, business value, and desired perception.",
};

export default function HeadlineGeneratorPage() {
  return <INConnectHeadlineGeneratorPage />;
}
