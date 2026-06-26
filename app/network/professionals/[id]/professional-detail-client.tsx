"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { EmailOTPLoginModal } from "@/components/email-otp-login-modal";
import {
  getVerifiedAuthHeaders,
  readStoredVerifiedIdentity,
  type StoredVerifiedIdentity,
} from "@/lib/auth-client";
import {
  ProfessionalCompanyAttachmentPanel,
  RemoveProfessionalCompanyLinkButton,
} from "../professional-company-attachment-panel";

type ProfessionalProfile = {
  currentCompany: string;
  currentTitle: string;
  displayName: string;
  headline: string;
  id: string;
  industry: string;
  linkedinUrl: string;
  location: string;
  profileImageUrl: string;
  source: string;
  visibility: string;
};

type ProfessionalCompanyLink = {
  company: {
    displayName: string;
  } | null;
  companyId: string;
  department: string;
  id: string;
  isPrimary: boolean;
  relationshipType: string;
  title: string;
};

export function ProfessionalDetailClient({ professionalId }: { professionalId: string }) {
  const [identity, setIdentity] = useState<StoredVerifiedIdentity | null>(null);
  const [professional, setProfessional] = useState<ProfessionalProfile | null>(null);
  const [links, setLinks] = useState<ProfessionalCompanyLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function refreshIdentity() {
      setIdentity(readStoredVerifiedIdentity());
    }

    refreshIdentity();
    window.addEventListener("inconnect:identity-changed", refreshIdentity);
    window.addEventListener("storage", refreshIdentity);
    return () => {
      window.removeEventListener("inconnect:identity-changed", refreshIdentity);
      window.removeEventListener("storage", refreshIdentity);
    };
  }, []);

  useEffect(() => {
    async function loadProfessional() {
      if (!identity?.email) {
        setMessage("Sign in to view this private professional.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const params = new URLSearchParams({ id: professionalId });
      const authHeaders = await getVerifiedAuthHeaders();
      const response = await fetch(`/api/network/professionals?${params.toString()}`, {
        headers: authHeaders,
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        professional?: ProfessionalProfile | null;
      } | null;
      if (!response.ok || !data?.professional) {
        setMessage(data?.error ?? "Professional was not found for this user.");
        setProfessional(null);
        setIsLoading(false);
        return;
      }

      setProfessional(data.professional);
      const linkParams = new URLSearchParams({ professionalId });
      const linksResponse = await fetch(
        `/api/network/professional-company-links?${linkParams.toString()}`,
        { headers: authHeaders },
      );
      const linksData = (await linksResponse.json().catch(() => null)) as {
        links?: ProfessionalCompanyLink[];
      } | null;
      setLinks(linksData?.links ?? []);
      setIsLoading(false);
    }

    void loadProfessional();
  }, [identity?.email, identity?.userId, professionalId]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[#D9DDE3] bg-white p-8 text-center">
        <p className="text-sm font-semibold text-[#666666]">Loading professional...</p>
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="rounded-lg border border-[#D9DDE3] bg-white p-8 text-center">
        <h2 className="text-2xl font-semibold">Private Professional</h2>
        <p className="mt-3 text-sm leading-6 text-[#666666]">{message}</p>
        <button
          className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
          onClick={() => setIsSignInOpen(true)}
          type="button"
        >
          Sign In
        </button>
        {isSignInOpen && (
          <EmailOTPLoginModal
            onClose={() => setIsSignInOpen(false)}
            onSignedIn={(nextIdentity) => {
              setIdentity(nextIdentity);
              setIsSignInOpen(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.78fr]">
      <div className="grid gap-5">
        <section className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Avatar name={professional.displayName} url={professional.profileImageUrl} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
                Private Professional
              </p>
              <h1 className="mt-3 text-4xl font-semibold">{professional.displayName}</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[#666666]">
                {professional.headline || professional.currentTitle || "Professional profile"}
              </p>
            </div>
          </div>
        </section>

        <DetailSection title="Profile Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Current Title" value={professional.currentTitle} />
            <DetailItem label="Current Company" value={professional.currentCompany} />
            <DetailItem label="Location" value={professional.location} />
            <DetailItem label="Industry" value={professional.industry} />
            <DetailItem label="Source" value={professional.source || "linkedin_url"} />
            <DetailItem label="Visibility" value="Private" />
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
          {links.length > 0 ? (
            <div className="grid gap-3">
              {links.map((link) => (
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
            <p className="text-sm leading-6 text-[#666666]">No companies linked yet.</p>
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
