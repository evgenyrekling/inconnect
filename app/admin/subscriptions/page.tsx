import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { AdminSubscriptionsDashboard } from "./subscriptions-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Admin Subscriptions | INConnect",
    description: "Admin dashboard for INConnect daily digest subscriptions.",
    path: "/admin/subscriptions",
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

export default function AdminSubscriptionsPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <AdminSubscriptionsDashboard />
      <Footer />
    </main>
  );
}
