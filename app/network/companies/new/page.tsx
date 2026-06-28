import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { createSeoMetadata } from "@/lib/seo";
import { AddCompanyClient } from "./add-company-client";

export const metadata: Metadata = createSeoMetadata({
  title: "Add Company | INConnect Network",
  description: "Manually add a company to the shared INConnect Companies database.",
  path: "/network/companies/new",
});

export default function AddCompanyPage() {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <AddCompanyClient />
      <Footer />
    </main>
  );
}
