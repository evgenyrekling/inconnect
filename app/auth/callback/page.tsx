import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { AuthCallbackClient } from "./auth-callback-client";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Signing In | INConnect",
    description: "Completing INConnect email verification.",
    path: "/auth/callback",
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

export default function AuthCallbackPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <AuthCallbackClient />
      <Footer />
    </main>
  );
}
