import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { ImportContactsDashboard } from "./import-contacts-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Import Contacts | INConnect Admin",
    description:
      "Admin-only CSV contact import for INConnect professional graph foundations.",
    path: "/admin/import-contacts",
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

export default function ImportContactsPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <ImportContactsDashboard />
      <Footer />
    </main>
  );
}
