import type { Metadata } from "next";
import { INConnectHeadlineGeneratorPage } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "LinkedIn Headline Generator | INConnect",
  description:
    "Generate strategic LinkedIn headline options from your role, expertise, industries, business value, and desired perception.",
  path: "/headline-generator",
});

export default function HeadlineGeneratorPage() {
  return <INConnectHeadlineGeneratorPage />;
}
