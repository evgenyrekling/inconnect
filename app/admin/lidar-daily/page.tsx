import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { AdminLidarDailyDashboard } from "./admin-lidar-daily-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Admin LiDAR Daily | INConnect",
    description: "Admin dashboard for LiDAR Daily market articles.",
    path: "/admin/lidar-daily",
  }),
  robots: {
    follow: false,
    googleBot: { follow: false, index: false },
    index: false,
  },
};

export default function AdminLidarDailyPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <AdminLidarDailyDashboard />
      <Footer />
    </main>
  );
}
