import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "@/components/inconnect-platform";
import { getAirportAccounts } from "@/lib/airport-accounts";
import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Companies | INConnect Network",
  description:
    "Explore INConnect company intelligence foundations for airport operators, airlines, suppliers, integrators, authorities, ground handlers, cargo operators, consultants, and future business targets.",
  path: "/network/accounts",
});

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const airportAccounts = await getAirportAccounts();

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link className="text-sm font-semibold text-[#0A66C2]" href="/network">
            Back to Network
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Companies
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl">
            INConnect Companies
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
            A company foundation for airport operators, airlines, technology
            suppliers, system integrators, authorities, ground handlers, cargo
            operators, consultants, and future business opportunities.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <AccountCategoryCard
              actionHref="/network/accounts/airports"
              actionLabel="Open Airport Operators"
              count={airportAccounts.length}
              description="Seeded airport operator companies using OurAirports identity data, passenger tiers, strategic priority, and future professional attachment."
              status="Active"
              title="Airport Operators"
            />
            <AccountCategoryCard
              description="Future company layer for airline relationships, route strategy, passenger experience, and operational stakeholders."
              status="Future"
              title="Airlines"
            />
            <AccountCategoryCard
              description="Future company intelligence for airport technology vendors, automation providers, and infrastructure partners."
              status="Future"
              title="Suppliers"
            />
            <AccountCategoryCard
              description="Future company layer for project delivery partners, system integrators, and implementation networks."
              status="Future"
              title="Integrators"
            />
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function AccountCategoryCard({
  actionHref,
  actionLabel,
  count,
  description,
  status,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  count?: number;
  description: string;
  status: "Active" | "Future";
  title: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
          {status}
        </p>
        {typeof count === "number" && (
          <span className="rounded-full bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
            {count} companies
          </span>
        )}
      </div>
      <h2 className="mt-4 text-2xl font-semibold">{title}</h2>
      <p className="mt-3 flex-1 text-sm leading-6 text-[#666666]">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-4 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      ) : (
        <span className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-4 text-sm font-semibold text-[#777777]">
          Coming Soon
        </span>
      )}
    </article>
  );
}
