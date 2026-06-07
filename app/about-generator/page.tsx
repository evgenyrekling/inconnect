import type { Metadata } from "next";
import { INConnectAboutGeneratorPage } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "LinkedIn About Generator | INConnect",
  description:
    "Generate strategic LinkedIn About section options from your role, expertise, industries, business value, professional identity, and writing style.",
  path: "/about-generator",
});

export default function AboutGeneratorPage() {
  return <INConnectAboutGeneratorPage />;
}
