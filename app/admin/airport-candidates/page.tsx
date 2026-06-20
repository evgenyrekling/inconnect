import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { AdminAirportCandidatesDashboard } from "./admin-airport-candidates-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Admin Airport Candidates | INConnect",
    description: "Admin candidate queue for Airport Automation Daily.",
    path: "/admin/airport-candidates",
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

export default function AdminAirportCandidatesPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <AdminAirportCandidatesDashboard />
      <Footer />
    </main>
  );
}
