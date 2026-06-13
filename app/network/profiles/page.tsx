import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "@/components/inconnect-platform";
import { getPublicProfiles } from "@/lib/public-profiles";

export const metadata: Metadata = {
  title: "Professional Profiles | INConnect Network",
  description: "Explore public professional INConnect profiles by expertise, industry, and location.",
};

export const dynamic = "force-dynamic";

export default async function NetworkProfilesPage() {
  const profiles = await getPublicProfiles();

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link className="text-sm font-semibold text-[#0A66C2]" href="/network">
            Back to Network
          </Link>
          <h1 className="mt-8 text-4xl font-semibold">Professional Profiles</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#666666]">
            Public INConnect profiles created from user-approved professional
            intelligence.
          </p>
        </div>
      </section>
      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {profiles.length === 0 ? (
            <div className="rounded-lg border border-[#D9DDE3] bg-white p-6 text-sm text-[#666666]">
              No public profiles are listed yet.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <Link
                  className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] transition hover:-translate-y-0.5 hover:border-[#0A66C2]/40"
                  href={`/p/${profile.slug}`}
                  key={profile.id}
                >
                  <h2 className="text-xl font-semibold">{profile.displayName}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#666666]">{profile.headline}</p>
                  <p className="mt-3 text-sm font-semibold text-[#0A66C2]">
                    {profile.location || profile.professionalRole}
                  </p>
                  <TagRow items={[...profile.industries, ...profile.expertise].slice(0, 5)} />
                  <span className="mt-5 inline-flex text-sm font-semibold text-[#0A66C2]">
                    View Profile
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}

function TagRow({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <span className="rounded-full bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}
