import { Header } from "@/components/inconnect-platform";
import { ClaimProfessionalClient } from "./claim-professional-client";

export const metadata = {
  title: "Claim Professional Profile | INConnect",
  description: "Claim or manage a professional profile invitation on INConnect.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ClaimProfessionalPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-[#F8F8F6] text-[#191919]">
      <Header />
      <ClaimProfessionalClient token={params.token ?? ""} />
    </main>
  );
}
