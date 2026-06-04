import type { Metadata } from "next";
import { INConnectAboutGeneratorPage } from "@/components/inconnect-platform";

export const metadata: Metadata = {
  title: "LinkedIn About Generator | INConnect",
  description:
    "Generate strategic LinkedIn About section options from your role, expertise, industries, business value, professional identity, and writing style.",
};

export default function AboutGeneratorPage() {
  return <INConnectAboutGeneratorPage />;
}
