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
                  className="flex h-full flex-col rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] transition hover:-translate-y-0.5 hover:border-[#0A66C2]/40"
                  href={`/p/${profile.slug}`}
                  key={profile.id}
                >
                  <div className="flex items-start gap-4">
                    <DirectoryAvatar name={profile.displayName} url={profile.profilePhotoUrl} />
                    <div>
                      <h2 className="text-xl font-semibold">{profile.displayName}</h2>
                      {profile.location && (
                        <p className="mt-1 text-sm font-semibold text-[#0A66C2]">
                          {profile.location}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#666666]">{profile.headline}</p>
                  {!profile.location && profile.professionalRole && (
                    <p className="mt-3 text-sm font-semibold text-[#0A66C2]">
                      {profile.professionalRole}
                    </p>
                  )}
                  <TagRow label="Industries" items={profile.industries.slice(0, 4)} />
                  <TagRow label="Expertise" items={profile.expertise.slice(0, 5)} />
                  <span className="mt-auto inline-flex w-fit rounded-lg bg-[#4A6FD0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3D5EB7]">
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

function DirectoryAvatar({ name, url }: { name: string; url: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "I";
  if (url) {
    return (
      <img
        alt={`${name} profile photo`}
        className="h-16 w-16 shrink-0 rounded-full border-2 border-[#E8F1FB] object-cover"
        src={url}
      />
    );
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-[#E8F1FB] bg-[#0A192F] text-xl font-semibold text-white">
      {initial}
    </div>
  );
}

function TagRow({ items, label }: { items: string[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span className="rounded-full bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]" key={item}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
