"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmailOTPLoginModal } from "@/components/email-otp-login-modal";
import { getVerifiedAuthHeaders } from "@/lib/auth-client";

type Invitation = {
  owner: {
    email: string;
    name: string;
  };
  professional: {
    company: string;
    currentTitle: string;
    email: string;
    headline: string;
    id: string;
    linkedinUrl: string;
    name: string;
  } | null;
  professionalEmail: string;
  status: string;
};

export function ClaimProfessionalClient({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setMessage("Invitation token is missing.");
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `/api/professional-invitations?${new URLSearchParams({ token }).toString()}`,
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        invitation?: Invitation;
      } | null;
      if (!response.ok || !payload?.invitation) {
        setMessage(payload?.error ?? "Invitation could not be loaded.");
        setIsLoading(false);
        return;
      }
      setInvitation(payload.invitation);
      setIsLoading(false);
    }

    void loadInvitation();
  }, [token]);

  async function claimProfile() {
    setMessage("");
    const response = await fetch("/api/professional-invitations", {
      body: JSON.stringify({ action: "claim", token }),
      headers: { "Content-Type": "application/json", ...(await getVerifiedAuthHeaders()) },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
      success?: boolean;
    } | null;
    if (response.status === 401) {
      setIsSignInOpen(true);
      return;
    }
    if (!response.ok || !payload?.success) {
      setMessage(payload?.error ?? "Profile could not be claimed.");
      return;
    }
    setMessage("Profile claimed. You can now create your own INConnect profile.");
    setInvitation((current) => (current ? { ...current, status: "claimed" } : current));
  }

  return (
    <section className="px-5 py-12 sm:px-8 lg:px-10">
      {isSignInOpen && (
        <EmailOTPLoginModal
          onClose={() => setIsSignInOpen(false)}
          onSignedIn={() => {
            setIsSignInOpen(false);
            window.setTimeout(() => void claimProfile(), 0);
          }}
        />
      )}
      <div className="mx-auto max-w-3xl rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
          INConnect Network Invitation
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Claim Professional Profile</h1>
        {isLoading ? (
          <p className="mt-5 text-sm leading-6 text-[#666666]">Loading invitation...</p>
        ) : invitation?.professional ? (
          <div className="mt-6 grid gap-5">
            <div className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-5">
              <h2 className="text-2xl font-semibold">{invitation.professional.name}</h2>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                {invitation.professional.headline ||
                  invitation.professional.currentTitle ||
                  "Professional profile"}
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Email" value={invitation.professional.email} />
                <Info label="Company" value={invitation.professional.company} />
                <Info label="Title" value={invitation.professional.currentTitle} />
                <Info label="LinkedIn" value={invitation.professional.linkedinUrl} />
              </dl>
            </div>
            <p className="text-sm leading-6 text-[#666666]">
              {invitation.owner.name} added this basic professional profile to their
              INConnect network. Private notes, relationship details, and internal
              comments are not shown here.
            </p>
            {message && (
              <p className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] px-4 py-3 text-sm font-semibold text-[#0A66C2]">
                {message}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
                onClick={() => void claimProfile()}
                type="button"
              >
                Claim Profile
              </button>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D9DDE3] bg-white px-5 text-sm font-semibold text-[#191919] transition hover:border-[#0A66C2]/40"
                href="/network/create-profile"
              >
                Create My INConnect Profile
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#F4B4B4] bg-white px-5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                href={`/remove-professional?token=${encodeURIComponent(token)}`}
              >
                Request Removal
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm leading-6 text-[#666666]">
            {message || "Invitation could not be loaded."}
          </p>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#666666]">
        {label}
      </dt>
      <dd className="mt-1 break-words font-semibold text-[#191919]">{value || "Not available"}</dd>
    </div>
  );
}
