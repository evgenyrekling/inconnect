import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { AuthDebugPanel } from "./auth-debug-panel";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Auth Debug | INConnect",
    description: "Supabase browser authentication diagnostics for INConnect.",
    path: "/debug/auth",
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

export default function AuthDebugPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <AuthDebugPanel />
      <Footer />
    </main>
  );
}
