import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/inconnect-platform";
import {
  getProfessionalCompanyLinksByProfessionalId,
  getProfessionalProfileById,
} from "@/lib/professionals";
import {
  ProfessionalCompanyAttachmentPanel,
  RemoveProfessionalCompanyLinkButton,
} from "../professional-company-attachment-panel";

type ProfessionalDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ProfessionalDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const professional = await getProfessionalProfileById(id);

  return {
    title: professional
      ? `${professional.displayName} | INConnect Professional`
      : "Professional | INConnect Network",
    description: professional
      ? `Professional profile for ${professional.displayName} in INConnect Network.`
      : "Professional profile in INConnect Network.",
  };
}

export default async function ProfessionalDetailPage({
  params,
}: ProfessionalDetailPageProps) {
  const { id } = await params;
  const professional = await getProfessionalProfileById(id);
  if (!professional) notFound();

  const companyLinks = await getProfessionalCompanyLinksByProfessionalId(professional.id);

  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <Header showSocialProof />
      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link className="text-sm font-semibold text-[#0A66C2]" href="/network/professionals">
            Back to Professionals
          </Link>
          <div className="mt-8 grid gap-6 lg:grid-cols-[auto_1fr_auto] lg:items-end">
            <Avatar name={professional.displayName} url={professional.profileImageUrl} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
                Professional
              </p>
              <h1 className="mt-3 text-4xl font-semibold">{professional.displayName}</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[#666666]">
                {professional.headline || professional.currentTitle || "Professional profile"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] px-4 text-sm font-semibold text-[#777777]"
                disabled
                type="button"
              >
                Edit
              </button>
              <a
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-4 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
                href="#attach-company"
              >
                Attach to Company
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_0.78fr]">
          <div className="grid gap-5">
            <DetailSection title="Profile Details">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem label="Current Title" value={professional.currentTitle} />
                <DetailItem label="Current Company" value={professional.currentCompany} />
                <DetailItem label="Location" value={professional.location} />
                <DetailItem label="Industry" value={professional.industry} />
                <DetailItem label="Source" value={professional.source || "linkedin_url"} />
                <DetailItem label="Visibility" value={professional.visibility} />
              </div>
              {professional.linkedinUrl && (
                <a
                  className="mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-[#0A66C2]/30 bg-white px-4 text-sm font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB]"
                  href={professional.linkedinUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open LinkedIn
                </a>
              )}
            </DetailSection>

            <DetailSection title="Companies Linked">
              {companyLinks.length > 0 ? (
                <div className="grid gap-3">
                  {companyLinks.map((link) => (
                    <article
                      className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4"
                      key={link.id}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <Link
                            className="text-lg font-semibold text-[#191919] transition hover:text-[#0A66C2]"
                            href={`/network/accounts/airports/${link.companyId}`}
                          >
                            {link.company?.displayName ?? "Company"}
                          </Link>
                          <p className="mt-1 text-sm leading-6 text-[#666666]">
                            {[link.title, link.department, formatRelationship(link.relationshipType)]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                          {link.isPrimary && (
                            <span className="mt-2 inline-flex rounded-full bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
                              Primary
                            </span>
                          )}
                        </div>
                        <RemoveProfessionalCompanyLinkButton id={link.id} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-[#666666]">
                  No companies linked yet.
                </p>
              )}
            </DetailSection>
          </div>

          <aside id="attach-company" className="self-start">
            <ProfessionalCompanyAttachmentPanel
              defaultTitle={professional.currentTitle}
              professionalId={professional.id}
            />
          </aside>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Avatar({ name, url }: { name: string; url: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "I";
  if (url) {
    return (
      <img
        alt={`${name} profile photo`}
        className="h-24 w-24 rounded-full border-4 border-[#E8F1FB] object-cover"
        src={url}
      />
    );
  }

  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#E8F1FB] bg-[#0A192F] text-3xl font-semibold text-white">
      {initial}
    </div>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#191919]">
        {value || "Not available"}
      </p>
    </div>
  );
}

function formatRelationship(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
