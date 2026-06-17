import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { AdminAirportDailyDashboard } from "./admin-airport-daily-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Admin Airport Daily | INConnect",
    description: "Admin review dashboard for Airport Automation Daily.",
    path: "/admin/airport-daily",
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

export default function AdminAirportDailyPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <AdminAirportDailyDashboard />
      <Footer />
    </main>
  );
}
