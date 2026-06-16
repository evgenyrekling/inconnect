import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { UnsubscribeClient } from "./unsubscribe-client";

export const metadata: Metadata = {
  ...createSeoMetadata({
    title: "Unsubscribe | INConnect",
    description: "Manage INConnect email digest subscriptions.",
    path: "/unsubscribe",
  }),
  robots: {
    follow: false,
    index: false,
  },
};

type UnsubscribePageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { token = "" } = await searchParams;

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <section className="px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-2xl rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Email Preferences
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-[#191919]">
            Manage your INConnect emails
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            You can unsubscribe from this digest or stop all INConnect digest emails.
          </p>
          <UnsubscribeClient token={token} />
        </div>
      </section>
      <Footer />
    </main>
  );
}
