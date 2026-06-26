import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/inconnect-platform";
import { getProfessionalProfiles } from "@/lib/professionals";

export const metadata: Metadata = {
  title: "Professionals | INConnect Network",
  description:
    "Manage INConnect professional profiles and connect professionals to company accounts.",
};

export const dynamic = "force-dynamic";

export default async function ProfessionalsPage() {
  const professionals = await getProfessionalProfiles();

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link className="text-sm font-semibold text-[#0A66C2]" href="/network">
            Back to Network
          </Link>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
                Professionals
              </p>
              <h1 className="mt-3 text-4xl font-semibold">Professionals</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666]">
                Create, review, and attach professional profiles to company
                accounts for future account mapping and business matchmaking.
              </p>
            </div>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
              href="/network/professionals/new"
            >
              Add Professional
            </Link>
          </div>
        </div>
      </section>
      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {professionals.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-[#D9DDE3] bg-white shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
              <div className="overflow-x-auto">
                <table className="min-w-[1060px] w-full border-collapse text-left text-sm">
                  <thead className="bg-[#F8F8F6] text-xs font-semibold uppercase tracking-[0.14em] text-[#666666]">
                    <tr>
                      <HeaderCell>Name</HeaderCell>
                      <HeaderCell>Headline / Title</HeaderCell>
                      <HeaderCell>Current Company</HeaderCell>
                      <HeaderCell>Location</HeaderCell>
                      <HeaderCell>LinkedIn</HeaderCell>
                      <HeaderCell>Connected Companies</HeaderCell>
                      <HeaderCell>Actions</HeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {professionals.map((professional) => (
                      <tr className="border-t border-[#D9DDE3]" key={professional.id}>
                        <BodyCell>
                          <Link
                            className="font-semibold text-[#191919] transition hover:text-[#0A66C2]"
                            href={`/network/professionals/${professional.id}`}
                          >
                            {professional.displayName}
                          </Link>
                        </BodyCell>
                        <BodyCell>
                          {professional.headline || professional.currentTitle || "-"}
                        </BodyCell>
                        <BodyCell>{professional.currentCompany || "-"}</BodyCell>
                        <BodyCell>{professional.location || "-"}</BodyCell>
                        <BodyCell>
                          {professional.linkedinUrl ? (
                            <a
                              className="font-semibold text-[#0A66C2] transition hover:underline"
                              href={professional.linkedinUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              LinkedIn
                            </a>
                          ) : (
                            "-"
                          )}
                        </BodyCell>
                        <BodyCell>
                          <span className="inline-flex min-w-8 items-center justify-center rounded-full border border-[#D9DDE3] bg-[#F8F8F6] px-2.5 py-1 text-xs font-semibold text-[#444444]">
                            {professional.companyLinksCount}
                          </span>
                        </BodyCell>
                        <BodyCell>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#0A66C2]/30 bg-white px-3 text-xs font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB]"
                              href={`/network/professionals/${professional.id}`}
                            >
                              View
                            </Link>
                            <Link
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-3 text-xs font-semibold text-[#191919] transition hover:border-[#0A66C2]/40"
                              href={`/network/professionals/${professional.id}#attach-company`}
                            >
                              Attach to Company
                            </Link>
                          </div>
                        </BodyCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[#D9DDE3] bg-white p-8 text-center shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
              <h2 className="text-2xl font-semibold">No professionals yet</h2>
              <p className="mt-3 text-sm leading-6 text-[#666666]">
                Add your first professional from a public LinkedIn profile URL.
              </p>
              <Link
                className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
                href="/network/professionals/new"
              >
                Add Professional
              </Link>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}

function HeaderCell({ children }: { children: string }) {
  return <th className="px-4 py-3 align-middle">{children}</th>;
}

function BodyCell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-4 align-middle text-[#444444]">{children}</td>;
}
