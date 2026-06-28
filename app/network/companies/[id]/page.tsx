import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/inconnect-platform";
import { getCompanyAccountById } from "@/lib/company-accounts";
import { createSeoMetadata } from "@/lib/seo";
import { CompanyProfessionalsPanel } from "../../accounts/airports/[id]/company-professionals-panel";

type CompanyPageProps = {
  params: Promise<{ id: string }>;
};

const STRATEGIC_LABELS: Record<string, string> = {
  high: "High",
  low: "Low",
  medium: "Medium",
  strategic: "Strategic",
  unrated: "Unrated",
};

const STATUS_LABELS: Record<string, string> = {
  competitor: "Competitor",
  customer: "Customer",
  inactive: "Inactive",
  partner: "Partner",
  prospect: "Prospect",
  support: "Support",
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: CompanyPageProps): Promise<Metadata> {
  const { id } = await params;
  const company = await getCompanyAccountById(id);
  if (!company) {
    return createSeoMetadata({
      title: "Company | INConnect Network",
      description: "Company details in the INConnect Companies database.",
      path: `/network/companies/${encodeURIComponent(id)}`,
    });
  }

  return createSeoMetadata({
    title: `${company.displayName} | INConnect Company`,
    description: `Company profile for ${company.displayName} in the INConnect Companies database.`,
    path: `/network/companies/${encodeURIComponent(company.id)}`,
  });
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { id } = await params;
  const company = await getCompanyAccountById(id);
  if (!company) notFound();

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link className="text-sm font-semibold text-[#0A66C2]" href="/network/accounts">
            Back to Companies
          </Link>
          <div className="mt-8 flex flex-wrap gap-2">
            <HeaderBadge>{company.companyType || "Company"}</HeaderBadge>
            <HeaderBadge>{company.countryName || "Country not set"}</HeaderBadge>
            <HeaderBadge>{STATUS_LABELS[company.status] ?? company.status}</HeaderBadge>
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl">
                {company.displayName}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666]">
                {company.description ||
                  "A manually added company in the shared INConnect Companies database."}
              </p>
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
                href={`/network/professionals/new?companyId=${company.id}`}
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
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_0.72fr]">
          <div className="grid gap-5">
            <AccountSection title="Company Information">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem label="Company Type" value={company.companyType} />
                <DetailItem label="Industry" value={company.industry} />
                <DetailItem label="Country" value={company.countryName} />
                <DetailItem label="City" value={company.city} />
                <DetailLink label="Website" value={company.website} />
                <DetailLink label="LinkedIn" value={company.linkedinUrl} />
              </div>
            </AccountSection>

            <AccountSection title="Description">
              <p className="text-sm leading-7 text-[#666666]">
                {company.description || "No description yet."}
              </p>
            </AccountSection>

            <AccountSection title="Notes">
              <p className="text-sm leading-7 text-[#666666]">
                {company.notes || "No notes yet."}
              </p>
            </AccountSection>

            <AccountSection title="Attached Professionals">
              <CompanyProfessionalsPanel companyId={company.id} />
            </AccountSection>
          </div>

          <aside className="grid gap-5 self-start">
            <AccountSection title="CRM State">
              <div className="grid gap-3">
                <DetailItem
                  label="Strategic Priority"
                  value={STRATEGIC_LABELS[company.strategicPriority] ?? company.strategicPriority}
                />
                <DetailItem
                  label="Account Status"
                  value={STATUS_LABELS[company.status] ?? company.status}
                />
                <DetailItem label="Identity Source" value={company.sourceIdentity} />
                <DetailItem label="Last Updated" value={formatDate(company.updatedAt)} />
              </div>
            </AccountSection>

            <AccountSection title="Opportunities">
              <EmptyState description="No opportunities connected yet." />
            </AccountSection>
          </aside>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function HeaderBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-[#0A66C2]/20 bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
      {children}
    </span>
  );
}

function AccountSection({ children, title }: { children: ReactNode; title: string }) {
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

function DetailLink({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">
        {label}
      </p>
      {value ? (
        <a
          className="mt-2 block break-all text-sm font-semibold leading-6 text-[#0A66C2] hover:underline"
          href={value}
          rel="noopener noreferrer"
          target="_blank"
        >
          {value}
        </a>
      ) : (
        <p className="mt-2 text-sm font-semibold leading-6 text-[#191919]">
          Not available
        </p>
      )}
    </div>
  );
}

function EmptyState({ description }: { description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#A7B3C2] bg-[#F8F8F6] p-5">
      <p className="text-sm leading-6 text-[#666666]">{description}</p>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
