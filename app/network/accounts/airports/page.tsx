import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  ACCOUNT_STATUS_LABELS,
  AUTOMATION_POTENTIAL_TIER_LABELS,
  formatAirportAccountDate,
  formatAutomationPotentialScore,
  formatAirportPassengerCount,
  getAirportAccounts,
  PASSENGER_TIER_LABELS,
  STRATEGIC_PRIORITY_LABELS,
  type AirportAccount,
} from "@/lib/airport-accounts";
import { createSeoMetadata } from "@/lib/seo";

type AirportAccountsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AirportAccountFilters = {
  automationTier: string;
  passengerTier: string;
  query: string;
  sort: string;
  status: string;
  strategicPriority: string;
};

export const metadata: Metadata = createSeoMetadata({
  title: "Airport Accounts | INConnect Network",
  description:
    "Explore airport accounts in the INConnect Accounts foundation by IATA, ICAO, country, city, passenger tier, and strategic priority.",
  path: "/network/accounts/airports",
});

export const dynamic = "force-dynamic";

export default async function AirportAccountsPage({
  searchParams,
}: AirportAccountsPageProps) {
  const params = await searchParams;
  const filters = getAirportAccountFilters(params ?? {});
  const accounts = await getAirportAccounts();
  const filteredAccounts = sortAirportAccounts(
    filterAirportAccounts(accounts, filters),
    filters.sort,
  );

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link className="text-sm font-semibold text-[#0A66C2]" href="/network/accounts">
            Back to Accounts
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Accounts / Airports
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl">
            Airport Accounts
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#666666] sm:text-lg">
            Airport records stored in the generic INConnect Accounts table with
            `account_type = airport`. This is the first account list foundation
            for future CRM, profile attachment, and opportunity workflows.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <AirportAccountFiltersForm filters={filters} />

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Airports</h2>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                Showing {filteredAccounts.length} of {accounts.length} airport
                accounts.
              </p>
            </div>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-4 text-sm font-semibold text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#E8F1FB]"
              href="/admin/strategic-airport-database"
            >
              Import Airports
            </Link>
          </div>

          {filteredAccounts.length > 0 ? (
            <AirportAccountsTable accounts={filteredAccounts} />
          ) : (
            <div className="mt-6 rounded-lg border border-[#D9DDE3] bg-white p-8 text-center shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
              <h2 className="text-2xl font-semibold">No airport accounts found</h2>
              <p className="mt-3 text-sm leading-6 text-[#666666]">
                Adjust the search or import airport identity data from OurAirports
                airports.csv.
              </p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}

function AirportAccountFiltersForm({
  filters,
}: {
  filters: AirportAccountFilters;
}) {
  return (
    <form className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr] xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr]">
        <label className="grid gap-2 text-sm font-semibold text-[#191919]">
          Search
          <input
            className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
            defaultValue={filters.query}
            name="q"
            placeholder="Airport name, IATA, ICAO, city, or country"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#191919]">
          Passenger tier
          <select
            className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
            defaultValue={filters.passengerTier}
            name="passengerTier"
          >
            <option value="">All tiers</option>
            {Object.entries(PASSENGER_TIER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#191919]">
          Strategic priority
          <select
            className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
            defaultValue={filters.strategicPriority}
            name="strategicPriority"
          >
            <option value="">All priorities</option>
            {Object.entries(STRATEGIC_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#191919]">
          Automation tier
          <select
            className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
            defaultValue={filters.automationTier}
            name="automationTier"
          >
            <option value="">All automation tiers</option>
            {Object.entries(AUTOMATION_POTENTIAL_TIER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#191919]">
          Sort
          <select
            className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
            defaultValue={filters.sort}
            name="sort"
          >
            <option value="">Default</option>
            <option value="automation_desc">Highest Automation Potential</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#191919]">
          Status
          <select
            className="h-11 rounded-lg border border-[#D9DDE3] bg-white px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
            defaultValue={filters.status}
            name="status"
          >
            <option value="">All statuses</option>
            {Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
          type="submit"
        >
          Search Accounts
        </button>
        <Link
          className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#E8F1FB]"
          href="/network/accounts/airports"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}

function AirportAccountsTable({ accounts }: { accounts: AirportAccount[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-[#D9DDE3] bg-white shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <div className="overflow-x-auto">
        <table className="min-w-[1380px] w-full border-collapse text-left text-sm">
          <thead className="bg-[#F8F8F6] text-xs font-semibold uppercase tracking-[0.14em] text-[#666666]">
            <tr>
              <HeaderCell>Airport Name</HeaderCell>
              <HeaderCell>IATA</HeaderCell>
              <HeaderCell>ICAO</HeaderCell>
              <HeaderCell>Country</HeaderCell>
              <HeaderCell>City</HeaderCell>
              <HeaderCell>Passengers</HeaderCell>
              <HeaderCell>Passenger Tier</HeaderCell>
              <HeaderCell>Automation Score</HeaderCell>
              <HeaderCell>Automation Tier</HeaderCell>
              <HeaderCell>Strategic Priority</HeaderCell>
              <HeaderCell>Status</HeaderCell>
              <HeaderCell>Profiles Connected</HeaderCell>
              <HeaderCell>Last Updated</HeaderCell>
              <HeaderCell>Actions</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr
                className="border-t border-[#D9DDE3] transition hover:bg-[#F8FAFC]"
                key={account.id}
              >
                <BodyCell>
                  <Link
                    className="font-semibold text-[#191919] transition hover:text-[#0A66C2]"
                    href={`/network/accounts/airports/${account.id}`}
                  >
                    {account.displayName}
                  </Link>
                </BodyCell>
                <BodyCell>
                  <span className="font-semibold text-[#0A66C2]">
                    {account.iataCode}
                  </span>
                </BodyCell>
                <BodyCell>{account.icaoCode || "-"}</BodyCell>
                <BodyCell>{account.countryName || account.countryCode || "-"}</BodyCell>
                <BodyCell>{account.city || account.municipality || "-"}</BodyCell>
                <BodyCell>{formatAirportPassengerCount(account.annualPassengers)}</BodyCell>
                <BodyCell>
                  <Badge tone={account.passengerTier === "unknown" ? "gray" : "blue"}>
                    {PASSENGER_TIER_LABELS[account.passengerTier]}
                  </Badge>
                </BodyCell>
                <BodyCell>
                  {formatAutomationPotentialScore(account.automationPotentialScore)}
                </BodyCell>
                <BodyCell>
                  <Badge
                    tone={
                      account.automationPotentialTier === "unknown" ? "gray" : "green"
                    }
                  >
                    {AUTOMATION_POTENTIAL_TIER_LABELS[account.automationPotentialTier]}
                  </Badge>
                </BodyCell>
                <BodyCell>
                  <Badge
                    tone={account.strategicPriority === "unrated" ? "gray" : "green"}
                  >
                    {STRATEGIC_PRIORITY_LABELS[account.strategicPriority]}
                  </Badge>
                </BodyCell>
                <BodyCell>
                  <Badge tone={account.status === "inactive" ? "gray" : "blue"}>
                    {ACCOUNT_STATUS_LABELS[account.status]}
                  </Badge>
                </BodyCell>
                <BodyCell>0</BodyCell>
                <BodyCell>{formatAirportAccountDate(account.updatedAt)}</BodyCell>
                <BodyCell>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-[#0A66C2]/30 bg-white px-3 text-xs font-semibold text-[#0A66C2] transition hover:border-[#0A66C2] hover:bg-[#E8F1FB]"
                      href={`/network/accounts/airports/${account.id}`}
                    >
                      Open
                    </Link>
                    <button
                      className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-3 text-xs font-semibold text-[#777777]"
                      disabled
                      type="button"
                    >
                      Attach Profile
                    </button>
                    <button
                      className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-3 text-xs font-semibold text-[#777777]"
                      disabled
                      type="button"
                    >
                      Edit
                    </button>
                  </div>
                </BodyCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeaderCell({ children }: { children: string }) {
  return <th className="px-4 py-3 align-middle">{children}</th>;
}

function BodyCell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-4 align-middle text-[#444444]">{children}</td>;
}

function Badge({
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
      className={`inline-flex w-fit items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function getAirportAccountFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AirportAccountFilters {
  return {
    automationTier: getSearchValue(searchParams.automationTier),
    passengerTier: getSearchValue(searchParams.passengerTier),
    query: getSearchValue(searchParams.q),
    sort: getSearchValue(searchParams.sort),
    status: getSearchValue(searchParams.status),
    strategicPriority: getSearchValue(searchParams.strategicPriority),
  };
}

function filterAirportAccounts(
  accounts: AirportAccount[],
  filters: AirportAccountFilters,
) {
  return accounts.filter((account) => {
    if (
      filters.query &&
      !matchesText(
        filters.query,
        account.name,
        account.displayName,
        account.iataCode,
        account.icaoCode,
        account.city,
        account.municipality,
        account.countryCode,
        account.countryName,
      )
    ) {
      return false;
    }

    if (
      filters.passengerTier &&
      filters.passengerTier !== account.passengerTier
    ) {
      return false;
    }

    if (
      filters.automationTier &&
      filters.automationTier !== account.automationPotentialTier
    ) {
      return false;
    }

    if (
      filters.strategicPriority &&
      filters.strategicPriority !== account.strategicPriority
    ) {
      return false;
    }

    if (filters.status && filters.status !== account.status) {
      return false;
    }

    return true;
  });
}

function sortAirportAccounts(accounts: AirportAccount[], sort: string) {
  if (sort !== "automation_desc") return accounts;

  return [...accounts].sort((first, second) => {
    const firstScore = first.automationPotentialScore ?? -1;
    const secondScore = second.automationPotentialScore ?? -1;
    return secondScore - firstScore || first.displayName.localeCompare(second.displayName);
  });
}

function matchesText(filterValue: string, ...values: string[]) {
  const normalizedFilter = filterValue.trim().toLowerCase();
  return values.some((value) => value.toLowerCase().includes(normalizedFilter));
}

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
