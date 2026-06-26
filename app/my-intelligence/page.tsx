import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "@/components/inconnect-platform";

export const metadata: Metadata = {
  title: "My Market Intelligence | INConnect",
  description: "View your INConnect market intelligence subscriptions and briefings.",
  robots: {
    follow: false,
    index: false,
  },
};

export default function MyIntelligencePage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <section className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl rounded-lg border border-[#D9DDE3] bg-white p-8 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Market Intelligence
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-[#191919]">
            My Market Intelligence
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#666666]">
            Your saved market intelligence streams will appear here as account features
            expand.
          </p>
          <Link
            className="mt-6 inline-flex rounded-lg bg-[#4A6FD0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
            href="/intelligence"
          >
            Explore Market Intelligence
          </Link>
        </div>
      </section>
      <Footer />
    </main>
  );
}
