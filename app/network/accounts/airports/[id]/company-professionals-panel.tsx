"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmailOTPLoginModal } from "@/components/email-otp-login-modal";
import {
  getVerifiedAuthHeaders,
  readStoredVerifiedIdentity,
  type StoredVerifiedIdentity,
} from "@/lib/auth-client";

type ProfessionalCompanyLink = {
  department: string;
  id: string;
  isPrimary: boolean;
  professional: {
    currentTitle: string;
    displayName: string;
    linkedinUrl: string;
  } | null;
  professionalId: string;
  relationshipType: string;
  title: string;
};

export function CompanyProfessionalsPanel({ companyId }: { companyId: string }) {
  const [identity, setIdentity] = useState<StoredVerifiedIdentity | null>(null);
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
    async function loadLinks() {
      if (!identity?.email) {
        setMessage("Sign in to view your attached professionals for this company.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const params = new URLSearchParams({ companyId });
      const response = await fetch(`/api/network/professional-company-links?${params.toString()}`, {
        headers: await getVerifiedAuthHeaders(),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        links?: ProfessionalCompanyLink[];
      } | null;
      if (!response.ok) {
        setMessage(data?.error ?? "Sign in to view your attached professionals for this company.");
        setLinks([]);
        setIsLoading(false);
        return;
      }
      setLinks(data?.links ?? []);
      setMessage("");
      setIsLoading(false);
    }

    void loadLinks();
  }, [companyId, identity?.email, identity?.userId]);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-[#666666]">
          Your private professionals attached to this company account.
        </p>
        <Link
          className="inline-flex h-10 w-fit items-center justify-center rounded-lg bg-[#4A6FD0] px-4 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
          href={`/network/professionals/new?companyId=${companyId}`}
        >
          Add Professional
        </Link>
      </div>

      {isLoading ? (
        <EmptyText>Loading attached professionals...</EmptyText>
      ) : message ? (
        <div className="rounded-lg border border-dashed border-[#A7B3C2] bg-[#F8F8F6] p-5">
          <p className="text-sm leading-6 text-[#666666]">{message}</p>
          <button
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[#4A6FD0] px-4 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
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
      ) : links.length > 0 ? (
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
                    href={`/network/professionals/${link.professionalId}`}
                  >
                    {link.professional?.displayName ?? "Professional"}
                  </Link>
                  <p className="mt-1 text-sm leading-6 text-[#666666]">
                    {[
                      link.title || link.professional?.currentTitle,
                      link.department,
                      formatRelationship(link.relationshipType),
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                  {link.professional?.linkedinUrl && (
                    <a
                      className="mt-2 inline-flex text-sm font-semibold text-[#0A66C2] transition hover:underline"
                      href={link.professional.linkedinUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      LinkedIn
                    </a>
                  )}
                </div>
                {link.isPrimary && (
                  <span className="inline-flex w-fit rounded-full bg-[#E8F1FB] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
                    Primary
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyText>No professionals connected.</EmptyText>
      )}
    </>
  );
}

function EmptyText({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#A7B3C2] bg-[#F8F8F6] p-5">
      <p className="text-sm leading-6 text-[#666666]">{children}</p>
    </div>
  );
}

function formatRelationship(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
