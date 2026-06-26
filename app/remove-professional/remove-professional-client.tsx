"use client";

import { useEffect, useState } from "react";

type Invitation = {
  owner: {
    name: string;
  };
  professional: {
    company: string;
    currentTitle: string;
    email: string;
    headline: string;
    name: string;
  } | null;
  status: string;
};

export function RemoveProfessionalClient({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setMessage("Invitation token is missing.");
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `/api/professional-invitations?${new URLSearchParams({
          context: "remove",
          token,
        }).toString()}`,
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

  async function requestRemoval() {
    setIsSubmitting(true);
    setMessage("");
    const response = await fetch("/api/professional-invitations", {
      body: JSON.stringify({ action: "remove", token }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
      success?: boolean;
    } | null;
    setIsSubmitting(false);
    if (!response.ok || !payload?.success) {
      setMessage(payload?.error ?? "Removal request could not be saved.");
      return;
    }
    setMessage("Removal request saved. This profile is no longer active for that network owner.");
    setInvitation((current) => (current ? { ...current, status: "removed" } : current));
  }

  return (
    <section className="px-5 py-12 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-2xl rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
          INConnect Network Invitation
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Request Removal</h1>
        {isLoading ? (
          <p className="mt-5 text-sm leading-6 text-[#666666]">Loading invitation...</p>
        ) : invitation?.professional ? (
          <div className="mt-6 grid gap-5">
            <div className="rounded-lg border border-[#D9DDE3] bg-[#F8F8F6] p-5">
              <h2 className="text-2xl font-semibold">{invitation.professional.name}</h2>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                {[invitation.professional.currentTitle, invitation.professional.company]
                  .filter(Boolean)
                  .join(" at ") || invitation.professional.headline}
              </p>
              <p className="mt-3 text-sm text-[#666666]">
                Added by {invitation.owner.name}.
              </p>
            </div>
            <p className="text-sm leading-6 text-[#666666]">
              This will mark the invited professional record as removed for this network owner.
              INConnect will not show private owner notes or relationship metadata here.
            </p>
            {message && (
              <p className="rounded-lg border border-[#0A66C2]/20 bg-[#E8F1FB] px-4 py-3 text-sm font-semibold text-[#0A66C2]">
                {message}
              </p>
            )}
            <button
              className="inline-flex h-11 w-fit items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-[#D9DDE3]"
              disabled={isSubmitting || invitation.status === "removed"}
              onClick={() => void requestRemoval()}
              type="button"
            >
              {isSubmitting ? "Saving..." : invitation.status === "removed" ? "Removal Requested" : "Request Removal"}
            </button>
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
