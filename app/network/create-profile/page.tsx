import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { CreateNetworkProfileClient } from "./create-network-profile-client";

export const metadata: Metadata = {
  title: "Create Professional Profile | INConnect Network",
  description: "Build a shareable INConnect professional profile manually or from your LinkedIn profile.",
};

export default function CreateNetworkProfilePage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <CreateNetworkProfileClient />
      <Footer />
    </main>
  );
}
