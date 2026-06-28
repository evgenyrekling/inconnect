import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  ACCOUNT_STATUS_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  getCompanyAccounts,
  getCompanyDetailUrl,
  STRATEGIC_PRIORITY_OPTIONS,
  type CompanyAccount,
} from "@/lib/company-accounts";
import { createSeoMetadata } from "@/lib/seo";

type AccountsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type CompanyFilters = {
  companyType: string;
  country: string;
  industry: string;
  query: string;
  status: string;
  strategicPriority: string;
};

export const metadata: Metadata = createSeoMetadata({
  title: "Companies | INConnect Network",
  description:
    "Explore INConnect company intelligence foundations for airport operators, airlines, suppliers, integrators, authorities, ground handlers, cargo operators, consultants, and future business targets.",
  path: "/network/accounts",
});

export const dynamic = "force-dynamic";

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = await searchParams;
  const filters = getCompanyFilters(params ?? {});
  const companyAccounts = await getCompanyAccounts();
  const filteredAccounts = filterCompanies(companyAccounts, filters);
  const airportAccounts = companyAccounts.filter((account) => account.accountType === "airport");
  const manualCompanies = companyAccounts.filter((account) => account.accountType === "company");

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
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <p className="max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
              A company foundation for airport operators, airlines, technology
              suppliers, system integrators, authorities, ground handlers, cargo
              operators, consultants, and future business opportunities.
            </p>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
              href="/network/companies/new"
            >
              + Add Company
            </Link>
          </div>
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
              actionHref="#company-list"
              actionLabel="Browse Companies"
              count={manualCompanies.length}
              description="Future company intelligence for airport technology vendors, automation providers, and infrastructure partners."
              status="Active"
              title="Suppliers"
            />
            <AccountCategoryCard
              description="Future company layer for project delivery partners, system integrators, and implementation networks."
              status="Future"
              title="Integrators"
            />
          </div>

          <section className="mt-10" id="company-list">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Company List</h2>
                <p className="mt-2 text-sm leading-6 text-[#666666]">
                  Showing {filteredAccounts.length} of {companyAccounts.length} companies.
                </p>
              </div>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-4 text-sm font-semibold text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#E8F1FB]"
                href="/network/companies/new"
              >
                + Add Company
              </Link>
            </div>
            <CompanyFiltersForm filters={filters} />
            {filteredAccounts.length > 0 ? (
              <CompaniesTable companies={filteredAccounts} />
            ) : (
              <div className="mt-6 rounded-lg border border-[#D9DDE3] bg-white p-8 text-center shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
                <h2 className="text-2xl font-semibold">No companies found</h2>
                <p className="mt-3 text-sm leading-6 text-[#666666]">
                  Adjust filters or add a company manually.
                </p>
              </div>
            )}
          </section>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function CompanyFiltersForm({ filters }: { filters: CompanyFilters }) {
  return (
    <form className="mt-5 rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <FilterInput
          label="Search"
          name="q"
          placeholder="Company, IATA, ICAO, city, country"
          value={filters.query}
        />
        <FilterSelect label="Company type" name="companyType" value={filters.companyType}>
          <option value="">All types</option>
          {COMPANY_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>
        <FilterInput label="Industry" name="industry" placeholder="Industry" value={filters.industry} />
        <FilterInput label="Country" name="country" placeholder="Country" value={filters.country} />
        <FilterSelect
          label="Strategic Priority"
          name="strategicPriority"
          value={filters.strategicPriority}
        >
          <option value="">All priorities</option>
          {STRATEGIC_PRIORITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatLabel(option)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Status" name="status" value={filters.status}>
          <option value="">All statuses</option>
          {ACCOUNT_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatLabel(option)}
            </option>
          ))}
        </FilterSelect>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
          type="submit"
        >
          Search Companies
        </button>
        <Link
          className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#E8F1FB]"
          href="/network/accounts#company-list"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}

function CompaniesTable({ companies }: { companies: CompanyAccount[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-[#D9DDE3] bg-white shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
          <thead className="bg-[#F8F8F6] text-xs font-semibold uppercase tracking-[0.14em] text-[#666666]">
            <tr>
              <HeaderCell>Company</HeaderCell>
              <HeaderCell>Type</HeaderCell>
              <HeaderCell>Industry</HeaderCell>
              <HeaderCell>Country</HeaderCell>
              <HeaderCell>City</HeaderCell>
              <HeaderCell>Strategic Priority</HeaderCell>
              <HeaderCell>Status</HeaderCell>
              <HeaderCell>Actions</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr className="border-t border-[#D9DDE3] transition hover:bg-[#F8FAFC]" key={company.id}>
                <BodyCell>
                  <Link
                    className="font-semibold text-[#191919] transition hover:text-[#0A66C2]"
                    href={getCompanyDetailUrl(company.id, company.accountType, company.iataCode)}
                  >
                    {company.displayName}
                  </Link>
                  {(company.iataCode || company.icaoCode) && (
                    <p className="mt-1 text-xs text-[#666666]">
                      {[company.iataCode, company.icaoCode].filter(Boolean).join(" / ")}
                    </p>
                  )}
                </BodyCell>
                <BodyCell>{company.companyType || "-"}</BodyCell>
                <BodyCell>{company.industry || "-"}</BodyCell>
                <BodyCell>{company.countryName || "-"}</BodyCell>
                <BodyCell>{company.city || "-"}</BodyCell>
                <BodyCell>
                  <Badge>{formatLabel(company.strategicPriority)}</Badge>
                </BodyCell>
                <BodyCell>
                  <Badge>{formatLabel(company.status)}</Badge>
                </BodyCell>
                <BodyCell>
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-[#0A66C2]/30 bg-white px-3 text-xs font-semibold text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#E8F1FB]"
                    href={getCompanyDetailUrl(company.id, company.accountType, company.iataCode)}
                  >
                    View
                  </Link>
                </BodyCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterInput({
  label,
  name,
  placeholder,
  value,
}: {
  label: string;
  name: string;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#191919]">
      {label}
      <input
        className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
        defaultValue={value}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function FilterSelect({
  children,
  label,
  name,
  value,
}: {
  children: ReactNode;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#191919]">
      {label}
      <select
        className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
        defaultValue={value}
        name={name}
      >
        {children}
      </select>
    </label>
  );
}

function HeaderCell({ children }: { children: string }) {
  return <th className="px-4 py-3 align-middle">{children}</th>;
}

function BodyCell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-4 align-middle text-[#444444]">{children}</td>;
}

function Badge({ children }: { children: string }) {
  return (
    <span className="inline-flex w-fit items-center whitespace-nowrap rounded-full border border-[#D9DDE3] bg-[#F8F8F6] px-3 py-1 text-xs font-semibold text-[#444444]">
      {children}
    </span>
  );
}

function getCompanyFilters(
  searchParams: Record<string, string | string[] | undefined>,
): CompanyFilters {
  return {
    companyType: getSearchValue(searchParams.companyType),
    country: getSearchValue(searchParams.country),
    industry: getSearchValue(searchParams.industry),
    query: getSearchValue(searchParams.q),
    status: getSearchValue(searchParams.status),
    strategicPriority: getSearchValue(searchParams.strategicPriority),
  };
}

function filterCompanies(companies: CompanyAccount[], filters: CompanyFilters) {
  return companies.filter((company) => {
    if (
      filters.query &&
      !matchesText(
        filters.query,
        company.displayName,
        company.name,
        company.iataCode,
        company.icaoCode,
        company.city,
        company.countryName,
        company.industry,
      )
    ) {
      return false;
    }
    if (filters.companyType && filters.companyType !== company.companyType) return false;
    if (filters.industry && !matchesText(filters.industry, company.industry)) return false;
    if (filters.country && !matchesText(filters.country, company.countryName)) return false;
    if (filters.strategicPriority && filters.strategicPriority !== company.strategicPriority) {
      return false;
    }
    if (filters.status && filters.status !== company.status) return false;
    return true;
  });
}

function matchesText(filterValue: string, ...values: string[]) {
  const normalizedFilter = filterValue.trim().toLowerCase();
  return values.some((value) => value.toLowerCase().includes(normalizedFilter));
}

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatLabel(value: string) {
  if (!value) return "Unrated";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
