"use client";

import { useEffect, useState } from "react";
import type { PublicProfile, PublicProfileSection } from "@/lib/public-profiles";

type StoredIdentity = {
  email: string;
  name?: string;
  userId?: string;
  userKey: string;
};

const STORAGE_KEY = "inconnect:returning-user";

export function ProfileOwnerControls({ profile }: { profile: PublicProfile }) {
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setIdentity(readIdentity());
  }, []);

  const isOwner = isProfileOwner(identity, profile);
  if (!isOwner) return null;

  async function copyProfileLink() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setMessage("Profile link copied.");
  }

  async function shareProfile() {
    if (!navigator.share) return;
    await navigator.share({
      title: `${profile.displayName} | INConnect Profile`,
      text: profile.headline,
      url: window.location.href,
    });
  }

  async function updateVisibility(visibility: "public" | "unlisted" | "private") {
    if (!identity?.userKey) return;
    setIsBusy(true);
    setMessage("");
    const response = await fetch("/api/public-profiles", {
      body: JSON.stringify({ email: identity.email, userKey: identity.userKey, visibility }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    setIsBusy(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(payload?.error ?? "Profile visibility could not be updated.");
      return;
    }
    window.location.reload();
  }

  async function deleteProfile() {
    if (!identity?.userKey) return;
    setIsBusy(true);
    const response = await fetch(
      `/api/public-profiles?${new URLSearchParams({
        email: identity.email,
        userKey: identity.userKey,
      }).toString()}`,
      { method: "DELETE" },
    );
    setIsBusy(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(payload?.error ?? "Profile could not be deleted.");
      return;
    }
    window.location.href = "/network";
  }

  return (
    <div className="border-b border-[#D9DDE3] bg-[#EEF4FC] px-5 py-4 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
            Owner Controls
          </p>
          <p className="mt-1 text-sm text-[#475569]">
            Visibility: <span className="font-semibold capitalize">{profile.visibility}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border border-[#C8D7EA] bg-white px-3 py-2 text-sm font-semibold text-[#0A192F] transition hover:border-[#4A6FD0] hover:text-[#0A66C2]" onClick={copyProfileLink} type="button">
            Copy Profile Link
          </button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button className="rounded-lg border border-[#C8D7EA] bg-white px-3 py-2 text-sm font-semibold text-[#0A192F] transition hover:border-[#4A6FD0] hover:text-[#0A66C2]" onClick={shareProfile} type="button">
              Share
            </button>
          )}
          <a className="rounded-lg bg-[#4A6FD0] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#3D5EB7]" href="/profile/edit">
            Edit Profile
          </a>
          {profile.visibility !== "public" && (
            <button className="rounded-lg border border-[#C8D7EA] bg-white px-3 py-2 text-sm font-semibold text-[#0A192F] transition hover:border-[#4A6FD0] hover:text-[#0A66C2]" disabled={isBusy} onClick={() => updateVisibility("public")} type="button">
              Make Public
            </button>
          )}
          {profile.visibility !== "unlisted" && (
            <button className="rounded-lg border border-[#C8D7EA] bg-white px-3 py-2 text-sm font-semibold text-[#0A192F] transition hover:border-[#4A6FD0] hover:text-[#0A66C2]" disabled={isBusy} onClick={() => updateVisibility("unlisted")} type="button">
              Make Unlisted
            </button>
          )}
          {profile.visibility !== "private" && (
            <button className="rounded-lg border border-[#F4B4B4] bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50" disabled={isBusy} onClick={() => updateVisibility("private")} type="button">
              Make Private
            </button>
          )}
          <button className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700" disabled={isBusy} onClick={() => setShowDeleteConfirm(true)} type="button">
            Delete Profile
          </button>
        </div>
      </div>
      {message && <p className="mx-auto mt-3 max-w-5xl text-sm font-semibold text-[#0A66C2]">{message}</p>}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-[#0A192F]/70 p-6">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-[#0A192F]">Delete Profile</h2>
            <p className="mt-3 text-sm leading-6 text-[#475569]">
              Are you sure? This will remove your INConnect profile page.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button className="rounded-lg border border-[#D9DDE3] px-4 py-2 text-sm font-semibold" onClick={() => setShowDeleteConfirm(false)} type="button">
                Cancel
              </button>
              <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white" disabled={isBusy} onClick={deleteProfile} type="button">
                Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PrivateProfileOwnerGate({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const identity = readIdentity();
    if (!identity?.userKey) return;
    const params = new URLSearchParams({
      email: identity.email,
      userKey: identity.userKey,
    });
    void fetch(`/api/public-profiles?${params.toString()}`)
      .then((response) => response.json())
      .then((payload: { profile: PublicProfile | null }) => {
        if (payload.profile?.slug === slug && isProfileOwner(identity, payload.profile)) {
          setProfile(payload.profile);
          setIsOwner(true);
        }
      })
      .catch(() => undefined);
  }, [slug]);

  if (isOwner && profile) {
    return (
      <>
        <ProfileOwnerControls profile={profile} />
        <ProfileDisplay profile={profile} showHiddenSections />
      </>
    );
  }

  return (
    <section className="px-5 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-2xl rounded-lg border border-[#D9DDE3] bg-white p-8 text-center shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
          Private Profile
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-[#0A192F]">This profile is private.</h1>
        <p className="mt-3 text-sm leading-6 text-[#666666]">
          The profile owner controls who can view this INConnect profile page.
        </p>
      </div>
    </section>
  );
}

export function ProfileDisplay({
  profile,
  showHiddenSections = false,
}: {
  profile: PublicProfile;
  showHiddenSections?: boolean;
}) {
  const sections = profile.sections.filter((section) => showHiddenSections || section.visible);
  return (
    <>
      <section className="bg-[#0A192F] px-5 py-14 text-white sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center">
          <ProfileHeaderPhoto name={profile.displayName} url={profile.profilePhotoUrl} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#78B7F4]">
              INConnect Profile
            </p>
            <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">{profile.displayName}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-white/78">{profile.headline}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/72">
              {profile.professionalRole && <span>{profile.professionalRole}</span>}
              {profile.company && <span>{profile.company}</span>}
              {profile.location && <span>{profile.location}</span>}
              {typeof profile.authorityScore === "number" && (
                <span>{profile.authorityScore}/100 Authority Score</span>
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-5xl gap-5">
          {sections.map((section) => (
            <ProfileSectionCard key={section.id} section={section} showHiddenSections={showHiddenSections} />
          ))}
          <article className="rounded-lg border border-[#0A66C2]/20 bg-white p-6 text-center shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
            <h2 className="text-2xl font-semibold">Connect through INConnect</h2>
            <p className="mt-3 text-sm leading-6 text-[#666666]">
              Connection requests are coming soon.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}

function ProfileHeaderPhoto({ name, url }: { name: string; url: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "I";
  if (url) {
    return (
      <img
        alt={`${name} profile photo`}
        className="h-24 w-24 shrink-0 rounded-full border-4 border-white/20 object-cover shadow-[0_12px_32px_rgba(0,0,0,0.25)] sm:h-[120px] sm:w-[120px]"
        src={url}
      />
    );
  }

  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 text-3xl font-semibold text-white shadow-[0_12px_32px_rgba(0,0,0,0.25)] sm:h-[120px] sm:w-[120px]">
      {initial}
    </div>
  );
}

function ProfileSectionCard({
  section,
  showHiddenSections,
}: {
  section: PublicProfileSection;
  showHiddenSections: boolean;
}) {
  return (
    <article className={`rounded-lg border bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)] ${section.visible ? "border-[#D9DDE3]" : "border-dashed border-[#C8D7EA] opacity-70"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold">{section.title}</h2>
        {showHiddenSections && !section.visible && (
          <span className="rounded-full bg-[#EEF4FC] px-3 py-1 text-xs font-semibold text-[#0A66C2]">
            Hidden
          </span>
        )}
      </div>
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
  );
}

function readIdentity() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredIdentity;
    return parsed?.userKey && parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

function isProfileOwner(identity: StoredIdentity | null, profile: PublicProfile) {
  if (!identity) return false;
  const normalizedIdentityEmail = normalizeClientEmail(identity.email);
  return Boolean(
    (identity.userKey && identity.userKey === profile.userKey) ||
      (identity.userId && profile.userId && identity.userId === profile.userId) ||
      (normalizedIdentityEmail &&
        profile.ownerNormalizedEmail &&
        normalizedIdentityEmail === profile.ownerNormalizedEmail),
  );
}

function normalizeClientEmail(email: string) {
  return email.trim().toLowerCase();
}
