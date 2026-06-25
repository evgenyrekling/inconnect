import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { ImportStrategicAirportsDashboard } from "./import-strategic-airports-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Import Strategic Airports | INConnect Admin",
    description:
      "Admin-only master CSV import for the INConnect Strategic Airport Database.",
    path: "/admin/import-strategic-airports",
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

export default function ImportStrategicAirportsPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <ImportStrategicAirportsDashboard />
      <Footer />
    </main>
  );
}
