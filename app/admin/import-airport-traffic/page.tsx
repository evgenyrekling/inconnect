import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { ImportAirportTrafficDashboard } from "./import-airport-traffic-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Import Airport Traffic | INConnect Admin",
    description:
      "Admin-only airport traffic enrichment import for INConnect airport account tiers.",
    path: "/admin/import-airport-traffic",
  }),
  robots: {
    follow: false,
    googleBot: {
      follow: false,
      index: false,
    },
    index: false,
  },
};

export default function ImportAirportTrafficPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <ImportAirportTrafficDashboard />
      <Footer />
    </main>
  );
}
