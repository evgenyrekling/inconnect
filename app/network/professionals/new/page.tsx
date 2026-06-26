import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "@/components/inconnect-platform";
import { AddProfessionalClient } from "./add-professional-client";

type AddProfessionalPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Add Professional | INConnect Network",
  description:
    "Add a professional to INConnect from a public LinkedIn profile URL and attach them to a company account.",
};

export default async function AddProfessionalPage({
  searchParams,
}: AddProfessionalPageProps) {
  const params = await searchParams;
  const companyId = getSearchValue(params?.companyId);

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link className="text-sm font-semibold text-[#0A66C2]" href="/network/professionals">
            Back to Professionals
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            Professionals
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Add Professional</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666]">
            Add a professional from a public LinkedIn profile URL, confirm the
            available details manually, and attach the person to a company account.
          </p>
        </div>
      </section>
      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <AddProfessionalClient initialCompanyId={companyId} />
        </div>
      </section>
      <Footer />
    </main>
  );
}

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
