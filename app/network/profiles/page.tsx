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
            Build a professional profile you can share with colleagues, customers,
            partners, and recruiters.
          </p>
        </div>
      </section>
      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
              Build Your INConnect Profile
            </p>
            <h2 className="mt-3 text-3xl font-semibold">Create a professional profile</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#666666]">
              Create a professional profile you can share with colleagues, customers,
              partners, and recruiters.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="rounded-lg border border-[#D9DDE3] bg-[#F8FAFC] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
                  Option 1
                </p>
                <h3 className="mt-3 text-xl font-semibold">Build from LinkedIn PDF</h3>
                <p className="mt-2 text-sm leading-6 text-[#666666]">
                  Upload your LinkedIn Profile PDF and let INConnect build your profile
                  from your assessment.
                </p>
                <Link className="mt-5 inline-flex rounded-lg bg-[#4A6FD0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5EB7]" href="/assessment">
                  Build from LinkedIn PDF
                </Link>
              </article>
              <article className="rounded-lg border border-[#D9DDE3] bg-[#F8FAFC] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
                  Option 2
                </p>
                <h3 className="mt-3 text-xl font-semibold">Build Manually</h3>
                <p className="mt-2 text-sm leading-6 text-[#666666]">
                  Enter your professional details and generate an unlisted INConnect
                  profile with AI.
                </p>
                <Link className="mt-5 inline-flex rounded-lg bg-[#4A6FD0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5EB7]" href="/network/create-profile">
                  Build Manually
                </Link>
              </article>
            </div>
          </div>

          {profiles.length > 0 && (
            <>
              <div className="mt-12">
                <h2 className="text-3xl font-semibold">Public Profiles</h2>
                <p className="mt-3 text-sm leading-6 text-[#666666]">
                  Explore public INConnect profiles created from user-approved
                  professional intelligence.
                </p>
              </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <Link
                  className="group flex h-full cursor-pointer flex-col rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#0A66C2]/45 hover:shadow-[0_16px_36px_rgba(10,25,47,0.1)] focus:outline-none focus-visible:border-[#0A66C2] focus-visible:ring-2 focus-visible:ring-[#0A66C2]/20"
                  href={`/p/${profile.slug}`}
                  key={profile.id}
                >
                  <div className="flex items-start gap-4">
                    <DirectoryAvatar name={profile.displayName} url={profile.profilePhotoUrl} />
                    <div>
                      <h2 className="text-xl font-semibold transition group-hover:text-[#0A66C2]">
                        {profile.displayName}
                      </h2>
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
                  <span className="sr-only">View {profile.displayName} profile</span>
                </Link>
              ))}
            </div>
            </>
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
