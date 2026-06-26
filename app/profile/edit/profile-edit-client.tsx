"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PublicProfile, PublicProfileSection } from "@/lib/public-profiles";

type StoredIdentity = {
  email: string;
  name?: string;
  userId?: string;
  userKey: string;
};

const STORAGE_KEY = "inconnect:returning-user";
const UNIFIED_STORAGE_KEY = "inconnect_identity";

export function ProfileEditClient({ profileSlug }: { profileSlug?: string }) {
  const router = useRouter();
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [message, setMessage] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [savedProfilePath, setSavedProfilePath] = useState("");
  const [isPhotoSaving, setIsPhotoSaving] = useState(false);
  const [isRedirectPending, setIsRedirectPending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = readIdentity();
    setIdentity(stored);
    if (stored?.userKey) void loadProfile(stored.userKey, stored.email, profileSlug);
  }, [profileSlug]);

  useEffect(() => {
    return () => {
      clearRedirectTimer();
    };
  }, []);

  async function loadProfile(userKey: string, email = identity?.email ?? "", slug = profileSlug) {
    const params = new URLSearchParams({ email, userKey });
    if (slug) params.set("slug", slug);
    const response = await fetch(`/api/public-profiles?${params.toString()}`);
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
    clearRedirectTimer();
    setIsSaving(true);
    setIsRedirectPending(false);
    setMessage("");
    setSavedProfilePath("");
    const response = await fetch("/api/public-profiles", {
      body: JSON.stringify({
        company: nextProfile.company,
        displayName: nextProfile.displayName,
        headline: nextProfile.headline,
        location: nextProfile.location,
        professionalRole: nextProfile.professionalRole,
        sections: nextProfile.sections,
        slug: profileSlug,
        summary: nextProfile.summary,
        email: identity.email,
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
    setMessage("Profile updated.");
    const profilePath = `/p/${payload.profile.slug}`;
    setSavedProfilePath(profilePath);
    setIsRedirectPending(true);
    router.refresh();
    redirectTimeoutRef.current = setTimeout(() => {
      router.push(profilePath);
    }, 1000);
  }

  function continueEditing() {
    clearRedirectTimer();
    setIsRedirectPending(false);
  }

  function clearRedirectTimer() {
    if (!redirectTimeoutRef.current) return;
    clearTimeout(redirectTimeoutRef.current);
    redirectTimeoutRef.current = null;
  }

  async function deleteProfile() {
    if (!identity?.userKey || !profile) return;
    if (!window.confirm("Delete your INConnect profile?")) return;
    setIsSaving(true);
    await fetch(
      `/api/public-profiles?${new URLSearchParams({
        email: identity.email,
        ...(profileSlug ? { slug: profileSlug } : {}),
        userKey: identity.userKey,
      }).toString()}`,
      {
      method: "DELETE",
      },
    );
    setIsSaving(false);
    setProfile(null);
    setMessage("Profile deleted.");
  }

  async function uploadProfilePhoto(file: File | null) {
    if (!identity?.userKey || !profile || !file) return;
    setPhotoMessage("");
    setIsPhotoSaving(true);

    try {
      if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
        setPhotoMessage("Use a jpg, jpeg, png, or webp image.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setPhotoMessage("Use an image smaller than 5 MB.");
        return;
      }

      const webpFile = await convertImageToWebp(file);
      const formData = new FormData();
      formData.append("userKey", identity.userKey);
      formData.append("email", identity.email);
      if (profileSlug) formData.append("slug", profileSlug);
      formData.append("file", webpFile);

      const response = await fetch("/api/public-profiles/photo", {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        profilePhotoStoragePath?: string;
        profilePhotoUrl?: string;
      } | null;

      if (!response.ok || !payload?.profilePhotoUrl) {
        setPhotoMessage(payload?.error ?? "Profile photo could not be uploaded.");
        return;
      }

      setProfile({
        ...profile,
        profilePhotoStoragePath: payload.profilePhotoStoragePath ?? "",
        profilePhotoUrl: payload.profilePhotoUrl,
      });
      setPhotoMessage("Profile photo saved.");
    } catch (error) {
      setPhotoMessage(error instanceof Error ? error.message : "Profile photo could not be uploaded.");
    } finally {
      setIsPhotoSaving(false);
    }
  }

  async function removeProfilePhoto() {
    if (!identity?.userKey || !profile) return;
    setPhotoMessage("");
    setIsPhotoSaving(true);
    const response = await fetch(
      `/api/public-profiles/photo?${new URLSearchParams({
        email: identity.email,
        ...(profileSlug ? { slug: profileSlug } : {}),
        userKey: identity.userKey,
      }).toString()}`,
      { method: "DELETE" },
    );
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setIsPhotoSaving(false);
    if (!response.ok) {
      setPhotoMessage(payload?.error ?? "Profile photo could not be removed.");
      return;
    }
    setProfile({ ...profile, profilePhotoStoragePath: "", profilePhotoUrl: "" });
    setPhotoMessage("Profile photo removed.");
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
          <h1 className="text-3xl font-semibold">Edit INConnect Professional Profile</h1>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            You control what is visible. Professional profiles are unlisted by default.
          </p>
          {!profile ? (
            <button
              className="mt-6 rounded-lg bg-[#4A6FD0] px-4 py-3 text-sm font-semibold text-white"
              disabled={isSaving}
              onClick={createProfile}
              type="button"
            >
              {isSaving ? "Creating..." : "Create Professional Profile"}
            </button>
          ) : (
            <div className="mt-6 grid gap-4">
              <div className="rounded-lg border border-[#D9DDE3] bg-[#F8FAFC] p-4">
                <p className="text-sm font-semibold">Profile Photo</p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <ProfilePhotoPreview name={profile.displayName} url={profile.profilePhotoUrl} />
                  <div className="grid gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#4A6FD0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5EB7]">
                      {profile.profilePhotoUrl ? "Replace Photo" : "Upload Photo"}
                      <input
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        className="sr-only"
                        disabled={isPhotoSaving}
                        onChange={(event) => {
                          void uploadProfilePhoto(event.target.files?.[0] ?? null);
                          event.currentTarget.value = "";
                        }}
                        type="file"
                      />
                    </label>
                    {profile.profilePhotoUrl && (
                      <button className="rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-red-600" disabled={isPhotoSaving} onClick={removeProfilePhoto} type="button">
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#666666]">
                  JPG, PNG, or WebP. Maximum 5 MB. Photos are stored as WebP.
                </p>
                {photoMessage && <p className="mt-3 text-sm font-semibold text-[#0A66C2]">{photoMessage}</p>}
              </div>
              <label className="grid gap-2 text-sm font-semibold">
                Display name
                <input className="rounded-lg border border-[#D9DDE3] px-3 py-2" value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Headline
                <textarea className="min-h-24 rounded-lg border border-[#D9DDE3] px-3 py-2" value={profile.headline} onChange={(event) => setProfile({ ...profile, headline: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Professional role
                <input className="rounded-lg border border-[#D9DDE3] px-3 py-2" value={profile.professionalRole} onChange={(event) => setProfile({ ...profile, professionalRole: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Company
                <input className="rounded-lg border border-[#D9DDE3] px-3 py-2" value={profile.company} onChange={(event) => setProfile({ ...profile, company: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Location
                <input className="rounded-lg border border-[#D9DDE3] px-3 py-2" value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Summary
                <textarea className="min-h-28 rounded-lg border border-[#D9DDE3] px-3 py-2" value={profile.summary} onChange={(event) => setProfile({ ...profile, summary: event.target.value })} />
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
                  Delete Professional Profile
                </button>
              </div>
              <a className="text-sm font-semibold text-[#0A66C2]" href={`/p/${profile.slug}`}>
                View Professional
              </a>
            </div>
          )}
          {message && (
            <div className="mt-4 rounded-lg border border-[#D9DDE3] bg-[#F8FAFC] p-4">
              <p className="text-sm font-semibold text-[#0A66C2]">{message}</p>
              {savedProfilePath && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    className="rounded-lg bg-[#4A6FD0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5EB7]"
                    href={savedProfilePath}
                  >
                    View Updated Professional Profile
                  </Link>
                  <button
                    className="rounded-lg border border-[#D9DDE3] px-4 py-3 text-sm font-semibold text-[#191919] transition hover:border-[#0A66C2] hover:text-[#0A66C2]"
                    onClick={continueEditing}
                    type="button"
                  >
                    Continue Editing
                  </button>
                </div>
              )}
              {isRedirectPending && (
                <p className="mt-3 text-xs leading-5 text-[#666666]">
                  Redirecting to your updated professional profile...
                </p>
              )}
            </div>
          )}
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
                onMoveDown={() => moveSection(profile, setProfile, section.id, 1)}
                onMoveUp={() => moveSection(profile, setProfile, section.id, -1)}
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

function ProfilePhotoPreview({ name, url }: { name: string; url: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "I";
  if (url) {
    return (
      <img
        alt={`${name} profile photo`}
        className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-[0_8px_24px_rgba(10,25,47,0.12)] sm:h-[120px] sm:w-[120px]"
        src={url}
      />
    );
  }

  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-[#0A192F] text-3xl font-semibold text-white shadow-[0_8px_24px_rgba(10,25,47,0.12)] sm:h-[120px] sm:w-[120px]">
      {initial}
    </div>
  );
}

function SectionEditor({
  onChange,
  onDelete,
  onMoveDown,
  onMoveUp,
  section,
  sectionNumber,
}: {
  onChange: (section: PublicProfileSection) => void;
  onDelete: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  section: PublicProfileSection;
  sectionNumber: number;
}) {
  const isCustom = section.id.startsWith("custom-");
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
      <div className="mt-3 flex flex-wrap gap-3">
        <button className="rounded-lg border border-[#D9DDE3] px-3 py-2 text-sm font-semibold" onClick={onMoveUp} type="button">
          Move Up
        </button>
        <button className="rounded-lg border border-[#D9DDE3] px-3 py-2 text-sm font-semibold" onClick={onMoveDown} type="button">
          Move Down
        </button>
        {isCustom && (
          <button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600" onClick={onDelete} type="button">
            Delete custom section
          </button>
        )}
      </div>
    </article>
  );
}

async function convertImageToWebp(file: File) {
  if (file.type === "image/webp") {
    return new File([file], "profile-photo.webp", { type: "image/webp" });
  }

  const bitmap = await createImageBitmap(file);
  const maxSize = 900;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image could not be prepared.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.9);
  });
  if (!blob) throw new Error("Image could not be converted to WebP.");
  return new File([blob], "profile-photo.webp", { type: "image/webp" });
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

function moveSection(
  profile: PublicProfile,
  setProfile: (profile: PublicProfile) => void,
  sectionId: string,
  direction: -1 | 1,
) {
  const sections = [...profile.sections].sort((a, b) => a.order - b.order);
  const index = sections.findIndex((section) => section.id === sectionId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= sections.length) return;
  const current = sections[index];
  const next = sections[nextIndex];
  sections[index] = next;
  sections[nextIndex] = current;
  setProfile({
    ...profile,
    sections: sections.map((section, sectionIndex) => ({
      ...section,
      order: sectionIndex + 1,
    })),
  });
}

function readIdentity() {
  try {
    const raw = window.localStorage.getItem(UNIFIED_STORAGE_KEY) ?? window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredIdentity;
    return parsed?.userKey && parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}
