import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "@/components/inconnect-platform";
import { MyProfessionalsList } from "./my-professionals-list";

export const metadata: Metadata = {
  title: "My Professionals | INConnect Network",
  description:
    "Manage INConnect professional profiles and connect professionals to company accounts.",
};

export const dynamic = "force-dynamic";

export default async function ProfessionalsPage() {
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
              <h1 className="mt-3 text-4xl font-semibold">My Professionals</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666]">
                Create, review, and attach your private professional contacts to
                global company accounts for future account mapping and business
                matchmaking.
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
          <MyProfessionalsList />
        </div>
      </section>
      <Footer />
    </main>
  );
}
