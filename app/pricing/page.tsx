import type { Metadata } from "next";
import { INConnectPricingPage } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Pricing | INConnect",
  description:
    "Compare INConnect free and Pro plans for LinkedIn profile intelligence, headline generation, trend radar, and content intelligence.",
  path: "/pricing",
});

export default function PricingPage() {
  return <INConnectPricingPage />;
}
