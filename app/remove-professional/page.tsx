import { Header } from "@/components/inconnect-platform";
import { RemoveProfessionalClient } from "./remove-professional-client";

export const metadata = {
  title: "Request Professional Removal | INConnect",
  description: "Request removal of a professional profile invitation on INConnect.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RemoveProfessionalPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-[#F8F8F6] text-[#191919]">
      <Header />
      <RemoveProfessionalClient token={params.token ?? ""} />
    </main>
  );
}
