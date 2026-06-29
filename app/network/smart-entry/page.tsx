import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { SmartEntryClient } from "./smart-entry-client";

export const metadata: Metadata = createSeoMetadata({
  title: "Smart Entry | INConnect Network",
  description:
    "Add professionals, companies, and relationships to INConnect Network from one simple entry point.",
  path: "/network/smart-entry",
});

export default function SmartEntryPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <SmartEntryClient />
      <Footer />
    </main>
  );
}
