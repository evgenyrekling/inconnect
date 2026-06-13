"use client";

import { useEffect, useState } from "react";
import type { PublicProfile, PublicProfileSection } from "@/lib/public-profiles";

type StoredIdentity = {
  email: string;
  name?: string;
  userKey: string;
};

const STORAGE_KEY = "inconnect:returning-user";

export function ProfileEditClient() {
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const stored = readIdentity();
    setIdentity(stored);
    if (stored?.userKey) void loadProfile(stored.userKey);
  }, []);

  async function loadProfile(userKey: string) {
    const response = await fetch(`/api/public-profiles?userKey=${encodeURIComponent(userKey)}`);
    const payload = (await response.json()) as { profile: PublicProfile | null };
    setProfile(payload.profile);
  }

  async function createProfile() {
    if (!identity?.userKey) return;
    setIsSaving(true);
    setMessage("");
    const response = await fetch("/api/public-profiles", {
      body: JSON.stringify({ userKey: identity.userKey }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string; profile?: PublicProfile };
    setIsSaving(false);
    if (!response.ok || !payload.profile) {
      setMessage(payload.error ?? "Profile could not be created.");
      return;
    }
    setProfile(payload.profile);
    setMessage("Your profile has been created.");
  }

  async function saveProfile(nextProfile = profile) {
    if (!identity?.userKey || !nextProfile) return;
    setIsSaving(true);
    setMessage("");
    const response = await fetch("/api/public-profiles", {
      body: JSON.stringify({
        displayName: nextProfile.displayName,
        headline: nextProfile.headline,
        sections: nextProfile.sections,
        userKey: identity.userKey,
        visibility: nextProfile.visibility,
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = (await response.json()) as { error?: string; profile?: PublicProfile };
    setIsSaving(false);
    if (!response.ok || !payload.profile) {
      setMessage(payload.error ?? "Profile could not be saved.");
      return;
    }
    setProfile(payload.profile);
    setMessage("Profile saved.");
  }

  async function deleteProfile() {
    if (!identity?.userKey || !profile) return;
    if (!window.confirm("Delete your INConnect profile?")) return;
    setIsSaving(true);
    await fetch(`/api/public-profiles?userKey=${encodeURIComponent(identity.userKey)}`, {
      method: "DELETE",
    });
    setIsSaving(false);
    setProfile(null);
    setMessage("Profile deleted.");
  }

  if (!identity) {
    return (
      <section className="px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-2xl rounded-lg border border-[#D9DDE3] bg-white p-6">
          <h1 className="text-3xl font-semibold">Identify yourself</h1>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            Please use Sign In in the top-right account menu first.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-12 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
          <h1 className="text-3xl font-semibold">Edit INConnect Profile</h1>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            You control what is visible. Profiles are unlisted by default.
          </p>
          {!profile ? (
            <button
              className="mt-6 rounded-lg bg-[#4A6FD0] px-4 py-3 text-sm font-semibold text-white"
              disabled={isSaving}
              onClick={createProfile}
              type="button"
            >
              {isSaving ? "Creating..." : "Create My Profile"}
            </button>
          ) : (
            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold">
                Display name
                <input className="rounded-lg border border-[#D9DDE3] px-3 py-2" value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Headline
                <textarea className="min-h-24 rounded-lg border border-[#D9DDE3] px-3 py-2" value={profile.headline} onChange={(event) => setProfile({ ...profile, headline: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Visibility
                <select className="rounded-lg border border-[#D9DDE3] px-3 py-2" value={profile.visibility} onChange={(event) => setProfile({ ...profile, isPublic: event.target.value === "public", visibility: event.target.value })}>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-3">
                <button className="rounded-lg bg-[#4A6FD0] px-4 py-3 text-sm font-semibold text-white" disabled={isSaving} onClick={() => saveProfile()} type="button">
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button className="rounded-lg border border-[#D9DDE3] px-4 py-3 text-sm font-semibold" onClick={() => addSection(profile, setProfile)} type="button">
                  Add Custom Section
                </button>
                <button className="rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-red-600" onClick={deleteProfile} type="button">
                  Delete Profile
                </button>
              </div>
              <a className="text-sm font-semibold text-[#0A66C2]" href={`/p/${profile.slug}`}>
                View Profile
              </a>
            </div>
          )}
          {message && <p className="mt-4 text-sm font-semibold text-[#0A66C2]">{message}</p>}
        </div>

        {profile && (
          <div className="grid gap-4">
            {profile.sections.map((section, index) => (
              <SectionEditor
                key={section.id}
                onChange={(nextSection) =>
                  setProfile({
                    ...profile,
                    sections: profile.sections.map((item) =>
                      item.id === section.id ? nextSection : item,
                    ),
                  })
                }
                onDelete={() =>
                  setProfile({
                    ...profile,
                    sections: profile.sections.filter((item) => item.id !== section.id),
                  })
                }
                section={section}
                sectionNumber={index + 1}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SectionEditor({
  onChange,
  onDelete,
  section,
  sectionNumber,
}: {
  onChange: (section: PublicProfileSection) => void;
  onDelete: () => void;
  section: PublicProfileSection;
  sectionNumber: number;
}) {
  return (
    <article className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
          Section {sectionNumber}
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input checked={section.visible} onChange={(event) => onChange({ ...section, visible: event.target.checked })} type="checkbox" />
          Visible
        </label>
      </div>
      <input className="mt-4 w-full rounded-lg border border-[#D9DDE3] px-3 py-2 text-lg font-semibold" value={section.title} onChange={(event) => onChange({ ...section, title: event.target.value })} />
      <textarea className="mt-3 min-h-28 w-full rounded-lg border border-[#D9DDE3] px-3 py-2 text-sm leading-6" value={section.content} onChange={(event) => onChange({ ...section, content: event.target.value })} />
      <button className="mt-3 text-sm font-semibold text-red-600" onClick={onDelete} type="button">
        Delete custom section
      </button>
    </article>
  );
}

function addSection(profile: PublicProfile, setProfile: (profile: PublicProfile) => void) {
  const nextOrder = profile.sections.length + 1;
  setProfile({
    ...profile,
    sections: [
      ...profile.sections,
      {
        content: "",
        id: `custom-${Date.now()}`,
        items: [],
        order: nextOrder,
        title: "Custom Section",
        visible: true,
      },
    ],
  });
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
