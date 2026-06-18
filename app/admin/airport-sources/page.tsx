import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { AdminAirportSourcesDashboard } from "./admin-airport-sources-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Admin Airport Sources | INConnect",
    description: "Manage trusted sources for Airport Automation Daily.",
    path: "/admin/airport-sources",
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

export default function AdminAirportSourcesPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <AdminAirportSourcesDashboard />
      <Footer />
    </main>
  );
}
