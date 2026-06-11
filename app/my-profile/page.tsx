import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";

export const metadata: Metadata = {
  title: "My Profile | INConnect",
  description: "Manage your INConnect profile identity and preferences.",
  robots: {
    follow: false,
    index: false,
  },
};

export default function MyProfilePage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <section className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl rounded-lg border border-[#D9DDE3] bg-white p-8 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Account
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-[#191919]">
            My Profile
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#666666]">
            Profile management is being prepared. For now, use the account menu
            to sign out and remove local identification from this device.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
