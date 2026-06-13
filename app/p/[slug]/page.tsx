import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components/inconnect-platform";
import { getPublicProfileBySlug } from "@/lib/public-profiles";
import { SITE_URL } from "@/lib/seo";

type PublicProfilePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);
  if (!profile || profile.visibility === "private") return { title: "Profile Not Found | INConnect" };

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
  if (!profile || profile.visibility === "private") notFound();

  const visibleSections = profile.sections.filter((section) => section.visible);
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
      <section className="bg-[#0A192F] px-5 py-14 text-white sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#78B7F4]">
            INConnect Profile
          </p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">{profile.displayName}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/78">{profile.headline}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/72">
            {profile.professionalRole && <span>{profile.professionalRole}</span>}
            {profile.company && <span>{profile.company}</span>}
            {profile.location && <span>{profile.location}</span>}
            {typeof profile.authorityScore === "number" && <span>{profile.authorityScore}/100 Authority Score</span>}
          </div>
        </div>
      </section>
      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-5xl gap-5">
          {visibleSections.map((section) => (
            <article className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]" key={section.id}>
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              {section.content && <p className="mt-4 text-base leading-7 text-[#666666]">{section.content}</p>}
              {section.items.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {section.items.map((item) => (
                    <span className="rounded-full bg-[#E8F1FB] px-3 py-1 text-sm font-semibold text-[#0A66C2]" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
          <article className="rounded-lg border border-[#0A66C2]/20 bg-white p-6 text-center shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
            <h2 className="text-2xl font-semibold">Connect through INConnect</h2>
            <p className="mt-3 text-sm leading-6 text-[#666666]">
              Connection requests are coming soon.
            </p>
          </article>
        </div>
      </section>
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
