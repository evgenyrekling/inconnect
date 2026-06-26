import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  ACCOUNT_STATUS_LABELS,
  AUTOMATION_POTENTIAL_TIER_LABELS,
  formatAirportAccountDate,
  formatAutomationPotentialScore,
  formatAirportPassengerCount,
  getAirportAccountById,
  PASSENGER_TIER_LABELS,
  STRATEGIC_PRIORITY_LABELS,
} from "@/lib/airport-accounts";
import { getProfessionalLinksForCompany } from "@/lib/professionals";
import { createSeoMetadata } from "@/lib/seo";

type AirportAccountPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: AirportAccountPageProps): Promise<Metadata> {
  const { id } = await params;
  const account = await getAirportAccountById(id);
  if (!account) {
    return createSeoMetadata({
      title: "Airport Operator | INConnect Companies",
      description: "Airport operator company details in the INConnect Companies foundation.",
      path: `/network/accounts/airports/${encodeURIComponent(id)}`,
    });
  }

  return createSeoMetadata({
    title: `${account.displayName} | INConnect Airport Operator`,
    description: `Airport operator company profile for ${account.displayName}, including identity, passenger tier, strategic priority, and CRM status.`,
    path: `/network/accounts/airports/${encodeURIComponent(account.id)}`,
  });
}

export default async function AirportAccountPage({
  params,
}: AirportAccountPageProps) {
  const { id } = await params;
  const account = await getAirportAccountById(id);
  if (!account) notFound();
  const professionalLinks = await getProfessionalLinksForCompany(account.id);

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link
            className="text-sm font-semibold text-[#0A66C2]"
            href="/network/accounts/airports"
          >
            Back to Airport Operators
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <HeaderBadge>{account.iataCode}</HeaderBadge>
            {account.icaoCode && <HeaderBadge>{account.icaoCode}</HeaderBadge>}
            <HeaderBadge>{account.countryName || account.countryCode}</HeaderBadge>
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl">
                {account.displayName}
              </h1>
              <div className="mt-5 flex flex-wrap gap-2">
                <StatusBadge tone={account.passengerTier === "unknown" ? "gray" : "blue"}>
                  {PASSENGER_TIER_LABELS[account.passengerTier]}
                </StatusBadge>
                <StatusBadge
                  tone={account.strategicPriority === "unrated" ? "gray" : "green"}
                >
                  {STRATEGIC_PRIORITY_LABELS[account.strategicPriority]}
                </StatusBadge>
                <StatusBadge tone={account.status === "inactive" ? "gray" : "blue"}>
                  {ACCOUNT_STATUS_LABELS[account.status]}
                </StatusBadge>
                <StatusBadge
                  tone={
                    account.automationPotentialTier === "unknown" ? "gray" : "green"
                  }
                >
                  {`Automation: ${AUTOMATION_POTENTIAL_TIER_LABELS[account.automationPotentialTier]}`}
                </StatusBadge>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-4 text-sm font-semibold text-[#777777]"
                disabled
                type="button"
              >
                Edit
              </button>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#0A66C2]/30 bg-white px-4 text-sm font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB]"
                href={`/network/professionals/new?companyId=${account.id}`}
              >
                Attach Professional
              </Link>
              <button
                className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-4 text-sm font-semibold text-[#777777]"
                disabled
                type="button"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_0.75fr]">
          <div className="grid gap-5">
            <AccountSection title="Overview">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <DetailItem label="Airport Name" value={account.displayName} />
                <DetailItem label="IATA" value={account.iataCode} />
                <DetailItem label="ICAO" value={account.icaoCode} />
                <DetailItem label="Status" value={ACCOUNT_STATUS_LABELS[account.status]} />
              </div>
            </AccountSection>

            <AccountSection title="Airport Information">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem label="Country" value={account.countryName || account.countryCode} />
                <DetailItem label="City" value={account.city || account.municipality} />
                <DetailItem label="Municipality" value={account.municipality} />
                <DetailItem label="Region Code" value={account.regionCode} />
                <DetailItem label="Airport Type" value={account.airportType.replace(/_/g, " ")} />
                <DetailItem label="Scheduled Service" value={account.scheduledService || "Unknown"} />
                <DetailItem label="OurAirports Ident" value={account.ourairportsIdent} />
                <DetailItem
                  label="Coordinates"
                  value={
                    account.latitude !== null && account.longitude !== null
                      ? `${account.latitude.toFixed(4)}, ${account.longitude.toFixed(4)}`
                      : "Not available"
                  }
                />
              </div>
            </AccountSection>

            <AccountSection title="Notes">
              <p className="text-sm leading-7 text-[#666666]">
                {account.notes || "No notes yet."}
              </p>
            </AccountSection>

            <AccountSection title="Professionals">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[#666666]">
                  Professionals attached to this company account.
                </p>
                <Link
                  className="inline-flex h-10 w-fit items-center justify-center rounded-lg bg-[#4A6FD0] px-4 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
                  href={`/network/professionals/new?companyId=${account.id}`}
                >
                  Add Professional
                </Link>
              </div>
              {professionalLinks.length > 0 ? (
                <div className="grid gap-3">
                  {professionalLinks.map((link) => (
                    <article
                      className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4"
                      key={link.id}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <Link
                            className="text-lg font-semibold text-[#191919] transition hover:text-[#0A66C2]"
                            href={`/network/professionals/${link.professionalId}`}
                          >
                            {link.professional?.displayName ?? "Professional"}
                          </Link>
                          <p className="mt-1 text-sm leading-6 text-[#666666]">
                            {[
                              link.title || link.professional?.currentTitle,
                              link.department,
                              formatRelationship(link.relationshipType),
                            ]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                          {link.professional?.linkedinUrl && (
                            <a
                              className="mt-2 inline-flex text-sm font-semibold text-[#0A66C2] transition hover:underline"
                              href={link.professional.linkedinUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              LinkedIn
                            </a>
                          )}
                        </div>
                        {link.isPrimary && (
                          <span className="inline-flex w-fit rounded-full bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
                            Primary
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState description="No professionals connected." />
              )}
            </AccountSection>

            <AccountSection title="Timeline">
              <EmptyState description="No company timeline activity yet." />
            </AccountSection>

            <AccountSection title="Future Opportunities">
              <EmptyState description="No opportunities connected yet." />
            </AccountSection>
          </div>

          <aside className="grid gap-5 self-start">
            <AccountSection title="Passenger Statistics">
              <p className="text-lg font-semibold text-[#191919]">
                {formatAirportPassengerCount(account.annualPassengers)}
              </p>
              <div className="mt-4 grid gap-3">
                <DetailItem
                  label="Passenger Tier"
                  value={PASSENGER_TIER_LABELS[account.passengerTier]}
                />
                <DetailItem
                  label="Strategic Priority"
                  value={STRATEGIC_PRIORITY_LABELS[account.strategicPriority]}
                />
                <DetailItem
                  label="Passenger Year"
                  value={account.passengerYear ? String(account.passengerYear) : ""}
                />
                <DetailItem
                  label="Traffic Source"
                  value={account.sourceTraffic || "Not enriched yet"}
                />
              </div>
            </AccountSection>

            <AccountSection title="Automation Potential">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
                Initial INConnect automation potential estimate
              </p>
              <p className="mt-3 text-3xl font-semibold text-[#191919]">
                {formatAutomationPotentialScore(account.automationPotentialScore)}
              </p>
              <p className="mt-2 text-lg font-semibold text-[#0A66C2]">
                {AUTOMATION_POTENTIAL_TIER_LABELS[account.automationPotentialTier]}
              </p>
              <div className="mt-5 rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">
                  Notes
                </p>
                <p className="mt-2 text-sm leading-6 text-[#666666]">
                  {account.automationScoreNotes ||
                    "Calculated from passenger traffic, airport type, and strategic priority."}
                </p>
              </div>
            </AccountSection>

            <AccountSection title="Company Metadata">
              <div className="grid gap-3">
                <DetailItem label="Identity Source" value={account.sourceIdentity} />
                <DetailItem label="Source URL" value={account.sourceUrl} />
                <DetailItem label="Last Updated" value={formatAirportAccountDate(account.updatedAt)} />
              </div>
            </AccountSection>
          </aside>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function AccountSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#191919]">
        {value || "Not available"}
      </p>
    </div>
  );
}

function EmptyState({
  actionLabel,
  description,
}: {
  actionLabel?: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#A7B3C2] bg-[#F8F8F6] p-5">
      <p className="text-sm leading-6 text-[#666666]">{description}</p>
      {actionLabel && (
        <button
          className="mt-4 inline-flex h-10 cursor-not-allowed items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-4 text-sm font-semibold text-[#777777]"
          disabled
          type="button"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function HeaderBadge({ children }: { children: string }) {
  if (!children) return null;
  return (
    <span className="rounded-full bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
      {children}
    </span>
  );
}

function StatusBadge({
  children,
  tone,
}: {
  children: string;
  tone: "blue" | "gray" | "green";
}) {
  const className =
    tone === "blue"
      ? "border-[#0A66C2]/20 bg-[#E8F1FB] text-[#0A66C2]"
      : tone === "green"
        ? "border-[#2E7D32]/20 bg-[#EAF6EC] text-[#2E7D32]"
        : "border-[#D9DDE3] bg-[#F8F8F6] text-[#666666]";

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function formatRelationship(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
