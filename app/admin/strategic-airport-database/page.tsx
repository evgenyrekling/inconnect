import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { StrategicAirportDatabaseDashboard } from "./strategic-airport-database-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Strategic Airport Database | INConnect Admin",
    description:
      "Admin workflow for building the INConnect Strategic Airport Database from airport identity and passenger traffic data.",
    path: "/admin/strategic-airport-database",
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

export default function StrategicAirportDatabasePage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <StrategicAirportDatabaseDashboard />
      <Footer />
    </main>
  );
}
