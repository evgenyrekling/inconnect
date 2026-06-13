import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components/inconnect-platform";
import { getPublicProfileBySlug } from "@/lib/public-profiles";
import { SITE_URL } from "@/lib/seo";
import {
  PrivateProfileOwnerGate,
  ProfileDisplay,
  ProfileOwnerControls,
} from "./profile-owner-controls";

type PublicProfilePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) return { title: "Profile Not Found | INConnect" };
  if (profile.visibility === "private") {
    return {
      title: "Private Profile | INConnect",
      description: "This INConnect profile is private.",
      robots: { follow: false, index: false },
    };
  }

  const canonical = `${SITE_URL}/p/${profile.slug}`;
  const indexable = profile.visibility === "public" && profile.isPublic;
  return {
    title: `${profile.displayName} | INConnect Profile`,
    description: profile.summary || profile.headline,
    alternates: { canonical },
    openGraph: {
      title: `${profile.displayName} | INConnect Profile`,
      description: profile.summary || profile.headline,
      siteName: "INConnect",
      type: "profile",
      url: canonical,
    },
    robots: { follow: indexable, index: indexable },
  };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) notFound();

  const indexable = profile.visibility === "public" && profile.isPublic;
  const schema = indexable
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        description: profile.summary,
        jobTitle: profile.professionalRole,
        name: profile.displayName,
        url: `${SITE_URL}/p/${profile.slug}`,
        worksFor: profile.company ? { "@type": "Organization", name: profile.company } : undefined,
      }
    : null;

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      {profile.visibility === "private" ? (
        <PrivateProfileOwnerGate slug={profile.slug} />
      ) : (
        <>
          <ProfileOwnerControls profile={profile} />
          <ProfileDisplay profile={profile} />
        </>
      )}
      {schema && (
        <script
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          type="application/ld+json"
        />
      )}
      <Footer />
    </main>
  );
}
