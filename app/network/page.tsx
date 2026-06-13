import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header, NetworkEarlyAccessForm } from "@/components/inconnect-platform";

export const metadata: Metadata = {
  title: "INConnect Network | Professional Discovery",
  description:
    "Discover professionals, companies, expertise, and future business opportunities through INConnect Network.",
};

export default function NetworkPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-14 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Network
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl">
            INConnect Network
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
            Discover professionals, companies, expertise, and future business
            opportunities.
          </p>
        </div>
      </section>
      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
          <NetworkCard
            actionHref="/network/profiles"
            actionLabel="Explore Profiles"
            description="AI-generated professional profiles created from INConnect assessments and user-approved data."
            status="Active"
            title="Professional Profiles"
          />
          <NetworkCard
            description="Discover potential partners, customers, suppliers, experts, and opportunities."
            status="Coming Soon"
            title="Business Matching"
          />
          <NetworkCard
            description="Find professionals by industry, expertise, role, region, and business interests."
            status="Coming Soon"
            title="Expert Discovery"
          />
        </div>
      </section>
      <section className="px-5 pb-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
          <h2 className="text-2xl font-semibold">Join Network Early Access</h2>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            Business matching, partner discovery, supplier discovery, expert
            discovery, and opportunity matching are coming soon.
          </p>
          <div className="mt-6">
            <NetworkEarlyAccessForm />
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function NetworkCard({
  actionHref,
  actionLabel,
  description,
  status,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  status: string;
  title: string;
}) {
  return (
    <article className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
        {status}
      </p>
      <h2 className="mt-3 text-2xl font-semibold">{title}</h2>
      <p className="mt-4 text-sm leading-6 text-[#666666]">{description}</p>
      {actionHref && actionLabel && (
        <Link
          className="mt-6 inline-flex rounded-lg bg-[#4A6FD0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      )}
    </article>
  );
}
