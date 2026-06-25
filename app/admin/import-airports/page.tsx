import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { ImportAirportsDashboard } from "./import-airports-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Import Airport Accounts | INConnect Admin",
    description:
      "Admin-only OurAirports CSV import for INConnect airport account foundations.",
    path: "/admin/import-airports",
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

export default function ImportAirportsPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <ImportAirportsDashboard />
      <Footer />
    </main>
  );
}
