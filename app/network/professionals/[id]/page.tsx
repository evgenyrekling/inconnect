import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "@/components/inconnect-platform";
import { ProfessionalDetailClient } from "./professional-detail-client";

type ProfessionalDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private Professional | INConnect Network",
  description: "Private professional contact in INConnect Network.",
};

export default async function ProfessionalDetailPage({
  params,
}: ProfessionalDetailPageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link className="text-sm font-semibold text-[#0A66C2]" href="/network/professionals">
            Back to My Professionals
          </Link>
        </div>
      </section>
      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <ProfessionalDetailClient professionalId={id} />
        </div>
      </section>
      <Footer />
    </main>
  );
}
