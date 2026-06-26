import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { ProfileEditClient } from "./profile-edit-client";

export const metadata: Metadata = {
  title: "Edit Professional Profile | INConnect Network",
  description: "Edit your INConnect public professional profile visibility and sections.",
  robots: {
    follow: false,
    index: false,
  },
};

export default function ProfileEditPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <ProfileEditClient />
      <Footer />
    </main>
  );
}
