import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { AdminBlogDashboard } from "./admin-blog-dashboard";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Admin Blog CMS | INConnect",
    description: "Admin review dashboard for INConnect AI-generated blog drafts.",
    path: "/admin/blog",
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

export default function AdminBlogPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <AdminBlogDashboard />
      <Footer />
    </main>
  );
}
