import type { Metadata } from "next";
import { INConnectPricingPage } from "@/components/inconnect-platform";

export const metadata: Metadata = {
  title: "Pricing | INConnect",
  description:
    "Compare INConnect free and Pro plans for LinkedIn profile intelligence, headline generation, trend radar, and content intelligence.",
};

export default function PricingPage() {
  return <INConnectPricingPage />;
}
