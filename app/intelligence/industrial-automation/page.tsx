import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Industrial Automation Daily | INConnect Intelligence",
  description:
    "Preview page for Industrial Automation Daily, a future INConnect intelligence stream covering robotics, industrial AI, sensors, controls, and smart infrastructure.",
  path: "/intelligence/industrial-automation",
});

export default function IndustrialAutomationIntelligencePage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <Link
            className="text-sm font-semibold text-[#0A66C2] transition hover:text-[#004182]"
            href="/intelligence"
          >
            Back to Intelligence
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#666666]">
            Coming Soon
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            Industrial Automation Daily
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
            Daily developments in factory automation, robotics, industrial AI,
            sensors, controls, digital operations, and smart infrastructure.
          </p>
          <div className="mt-8 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-6">
            <p className="text-sm font-semibold text-[#191919]">
              Preview page only.
            </p>
            <p className="mt-2 text-sm leading-6 text-[#666666]">
              Industrial Automation Daily will become a dedicated INConnect
              intelligence stream in a future release.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
