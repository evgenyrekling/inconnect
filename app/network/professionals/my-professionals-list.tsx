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

type ProfessionalProfile = {
  companyLinksCount: number;
  currentCompany: string;
  currentTitle: string;
  displayName: string;
  headline: string;
  id: string;
  linkedinUrl: string;
  location: string;
};

export function MyProfessionalsList() {
  const [identity, setIdentity] = useState<StoredVerifiedIdentity | null>(null);
  const [professionals, setProfessionals] = useState<ProfessionalProfile[]>([]);
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
    async function loadProfessionals() {
      if (!identity?.email) {
        setMessage("Sign in to view your private professionals.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const response = await fetch("/api/network/professionals", {
        headers: await getVerifiedAuthHeaders(),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        professionals?: ProfessionalProfile[];
      } | null;
      if (!response.ok) {
        setMessage(data?.error ?? "Sign in to view your private professionals.");
        setProfessionals([]);
        setIsLoading(false);
        return;
      }
      setProfessionals(data?.professionals ?? []);
      setMessage("");
      setIsLoading(false);
    }

    void loadProfessionals();
  }, [identity?.email, identity?.userId]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[#D9DDE3] bg-white p-8 text-center shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
        <p className="text-sm font-semibold text-[#666666]">Loading your professionals...</p>
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-lg border border-[#D9DDE3] bg-white p-8 text-center shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
        <h2 className="text-2xl font-semibold">My Professionals</h2>
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

  if (professionals.length === 0) {
    return (
      <div className="rounded-lg border border-[#D9DDE3] bg-white p-8 text-center shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
        <h2 className="text-2xl font-semibold">No professionals yet</h2>
        <p className="mt-3 text-sm leading-6 text-[#666666]">
          Add your first private professional from a public LinkedIn profile URL.
        </p>
        <Link
          className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
          href="/network/professionals/new"
        >
          Add Professional
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#D9DDE3] bg-white shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <div className="overflow-x-auto">
        <table className="min-w-[1060px] w-full border-collapse text-left text-sm">
          <thead className="bg-[#F8F8F6] text-xs font-semibold uppercase tracking-[0.14em] text-[#666666]">
            <tr>
              <HeaderCell>Name</HeaderCell>
              <HeaderCell>Headline / Title</HeaderCell>
              <HeaderCell>Current Company</HeaderCell>
              <HeaderCell>Location</HeaderCell>
              <HeaderCell>LinkedIn</HeaderCell>
              <HeaderCell>Connected Companies</HeaderCell>
              <HeaderCell>Actions</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {professionals.map((professional) => (
              <tr className="border-t border-[#D9DDE3]" key={professional.id}>
                <BodyCell>
                  <Link
                    className="font-semibold text-[#191919] transition hover:text-[#0A66C2]"
                    href={`/network/professionals/${professional.id}`}
                  >
                    {professional.displayName}
                  </Link>
                </BodyCell>
                <BodyCell>{professional.headline || professional.currentTitle || "-"}</BodyCell>
                <BodyCell>{professional.currentCompany || "-"}</BodyCell>
                <BodyCell>{professional.location || "-"}</BodyCell>
                <BodyCell>
                  {professional.linkedinUrl ? (
                    <a
                      className="font-semibold text-[#0A66C2] transition hover:underline"
                      href={professional.linkedinUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      LinkedIn
                    </a>
                  ) : (
                    "-"
                  )}
                </BodyCell>
                <BodyCell>
                  <span className="inline-flex min-w-8 items-center justify-center rounded-full border border-[#D9DDE3] bg-[#F8F8F6] px-2.5 py-1 text-xs font-semibold text-[#444444]">
                    {professional.companyLinksCount}
                  </span>
                </BodyCell>
                <BodyCell>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-[#0A66C2]/30 bg-white px-3 text-xs font-semibold text-[#0A66C2] transition hover:bg-[#E8F1FB]"
                      href={`/network/professionals/${professional.id}`}
                    >
                      View
                    </Link>
                    <Link
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-3 text-xs font-semibold text-[#191919] transition hover:border-[#0A66C2]/40"
                      href={`/network/professionals/${professional.id}#attach-company`}
                    >
                      Attach to Company
                    </Link>
                  </div>
                </BodyCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeaderCell({ children }: { children: string }) {
  return <th className="px-4 py-3 align-middle">{children}</th>;
}

function BodyCell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-4 align-middle text-[#444444]">{children}</td>;
}
