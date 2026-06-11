import type { Metadata } from "next";
import {
  Footer,
  Header,
  NetworkEarlyAccessForm,
} from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Professional Network | INConnect",
  description:
    "Business matching, partner discovery, supplier discovery, expert discovery, and opportunity matching are coming soon to INConnect.",
  path: "/network-coming-soon",
});

export default function NetworkComingSoonPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
              Coming Soon
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#191919] sm:text-5xl">
              Professional Network
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
              Business matching, partner discovery, supplier discovery, expert
              discovery, and opportunity matching are coming soon.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {[
                "Business Match",
                "Supplier Discovery",
                "Expert Discovery",
                "Opportunity Matching",
              ].map((item) => (
                <article
                  className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-5"
                  key={item}
                >
                  <h2 className="text-lg font-semibold text-[#191919]">{item}</h2>
                </article>
              ))}
            </div>
          </div>
          <NetworkEarlyAccessForm />
        </div>
      </section>
      <Footer />
    </main>
  );
}
