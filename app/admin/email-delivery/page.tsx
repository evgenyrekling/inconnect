import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { AdminEmailDeliveryDashboard } from "./email-delivery-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Admin Email Delivery | INConnect",
    description: "Admin diagnostics for INConnect Airport Daily email delivery.",
    path: "/admin/email-delivery",
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

export default function AdminEmailDeliveryPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <AdminEmailDeliveryDashboard />
      <Footer />
    </main>
  );
}
