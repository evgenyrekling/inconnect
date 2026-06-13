import type { Metadata } from "next";
import { Footer, Header } from "@/components/inconnect-platform";
import { ProfileEditClient } from "@/app/profile/edit/profile-edit-client";

type PublicProfileEditPageProps = {
  params: Promise<{ slug: string }>;
};

export const metadata: Metadata = {
  title: "Edit INConnect Profile | INConnect",
  description: "Edit your INConnect public profile.",
  robots: { follow: false, index: false },
};

export default async function PublicProfileEditPage({ params }: PublicProfileEditPageProps) {
  const { slug } = await params;

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <ProfileEditClient profileSlug={slug} />
      <Footer />
    </main>
  );
}
