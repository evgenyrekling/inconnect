"use client";

import { useState } from "react";

type CreatedProfile = {
  isPublic: boolean;
  slug: string;
  url: string;
  visibility: string;
};

const STORAGE_KEY = "inconnect:returning-user";
const UNIFIED_STORAGE_KEY = "inconnect_identity";

export function CreateNetworkProfileClient() {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [createdProfile, setCreatedProfile] = useState<CreatedProfile | null>(null);
  const [form, setForm] = useState({
    company: "",
    email: "",
    expertise: "",
    industries: "",
    location: "",
    name: "",
    problemsSolved: "",
    role: "",
    yearsOfExperience: "",
  });

  async function generateProfile() {
    setMessage("");
    setIsGenerating(true);
    const response = await fetch("/api/network/create-profile", {
      body: JSON.stringify({
        ...form,
        expertise: splitList(form.expertise),
        industries: splitList(form.industries),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      profile?: CreatedProfile;
      userKey?: string;
    } | null;
    setIsGenerating(false);

    if (!response.ok || !payload?.profile) {
      setMessage(payload?.error ?? "Profile could not be created.");
      return;
    }

    if (payload.userKey) {
      saveIdentity({
        email: form.email,
        name: form.name,
        userKey: payload.userKey,
      });
    }
    setCreatedProfile(payload.profile);
    setMessage("Your INConnect profile has been created as unlisted.");
  }

  async function makePublic() {
    if (!createdProfile) return;
    const identity = readIdentity();
    const response = await fetch("/api/public-profiles", {
      body: JSON.stringify({
        email: form.email || identity?.email,
        userKey: identity?.userKey,
        visibility: "public",
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      profile?: { isPublic: boolean; slug: string; visibility: string };
    } | null;
    if (!response.ok || !payload?.profile) {
      setMessage(payload?.error ?? "Profile visibility could not be updated.");
      return;
    }
    setCreatedProfile({
      ...createdProfile,
      isPublic: payload.profile.isPublic,
      slug: payload.profile.slug,
      url: `/p/${payload.profile.slug}`,
      visibility: payload.profile.visibility,
    });
    setMessage("Your profile is now public.");
  }

  return (
    <section className="px-5 py-12 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A66C2]">
            Build Manually
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Create Your INConnect Profile</h1>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            Add the basics, describe your expertise, and INConnect will generate a shareable
            professional profile.
          </p>
          <div className="mt-6 grid gap-2 text-sm font-semibold text-[#666666]">
            <StepLabel active={step === 1} done={step > 1} label="Step 1: Identity" />
            <StepLabel active={step === 2} done={step > 2} label="Step 2: Expertise" />
            <StepLabel active={step === 3} done={Boolean(createdProfile)} label="Step 3: Generate" />
          </div>
        </aside>

        <div className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
          {step === 1 && (
            <div className="grid gap-4">
              <h2 className="text-2xl font-semibold">Step 1</h2>
              <TextField label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
              <TextField label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
              <TextField label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} />
              <TextField label="Company" value={form.company} onChange={(value) => setForm({ ...form, company: value })} />
              <TextField label="Current Role" value={form.role} onChange={(value) => setForm({ ...form, role: value })} />
              <button className="w-fit rounded-lg bg-[#4A6FD0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5EB7]" onClick={() => setStep(2)} type="button">
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <h2 className="text-2xl font-semibold">Step 2</h2>
              <TextField label="Industries" placeholder="Airport automation, logistics, industrial automation" value={form.industries} onChange={(value) => setForm({ ...form, industries: value })} />
              <TextField label="Expertise" placeholder="RFID, BHS, sales leadership, AI, sensors" value={form.expertise} onChange={(value) => setForm({ ...form, expertise: value })} />
              <TextField label="Years of Experience" value={form.yearsOfExperience} onChange={(value) => setForm({ ...form, yearsOfExperience: value })} />
              <label className="grid gap-2 text-sm font-semibold">
                What problems do you solve?
                <textarea className="min-h-32 rounded-lg border border-[#D9DDE3] px-3 py-2 text-sm leading-6" value={form.problemsSolved} onChange={(event) => setForm({ ...form, problemsSolved: event.target.value })} />
              </label>
              <div className="flex flex-wrap gap-3">
                <button className="rounded-lg border border-[#D9DDE3] px-5 py-3 text-sm font-semibold" onClick={() => setStep(1)} type="button">
                  Back
                </button>
                <button className="rounded-lg bg-[#4A6FD0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5EB7]" onClick={() => setStep(3)} type="button">
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-semibold">Step 3</h2>
              <p className="mt-3 text-sm leading-6 text-[#666666]">
                Generate your INConnect profile. It will be created as unlisted first, so only
                people with the link can view it.
              </p>
              {!createdProfile ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="rounded-lg border border-[#D9DDE3] px-5 py-3 text-sm font-semibold" onClick={() => setStep(2)} type="button">
                    Back
                  </button>
                  <button className="rounded-lg bg-[#4A6FD0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5EB7]" disabled={isGenerating} onClick={generateProfile} type="button">
                    {isGenerating ? "Generating Profile..." : "Generate Profile with AI"}
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-lg border border-[#D9DDE3] bg-[#F8FAFC] p-5">
                  <p className="text-sm font-semibold text-[#0A66C2]">
                    Visibility: <span className="capitalize">{createdProfile.visibility}</span>
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <a className="rounded-lg bg-[#4A6FD0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5EB7]" href={createdProfile.url}>
                      View Profile
                    </a>
                    <a className="rounded-lg border border-[#D9DDE3] px-5 py-3 text-sm font-semibold" href="/profile/edit">
                      Edit Profile
                    </a>
                    {createdProfile.visibility !== "public" && (
                      <button className="rounded-lg border border-[#D9DDE3] px-5 py-3 text-sm font-semibold" onClick={makePublic} type="button">
                        Make Public
                      </button>
                    )}
                  </div>
                </div>
              )}
              {message && <p className="mt-4 text-sm font-semibold text-[#0A66C2]">{message}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TextField({
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <input
        className="rounded-lg border border-[#D9DDE3] px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function StepLabel({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className={`${active || done ? "text-[#0A66C2]" : "text-[#666666]"}`}>
      {done ? "Done: " : active ? "Current: " : ""}
      {label}
    </span>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function saveIdentity(identity: { email: string; name: string; userKey: string }) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    window.localStorage.setItem(
      UNIFIED_STORAGE_KEY,
      JSON.stringify({
        ...identity,
        normalizedEmail: identity.email.trim().toLowerCase(),
        signedInAt: new Date().toISOString(),
      }),
    );
  } catch {
    // localStorage can be unavailable in private browsing.
  }
}

function readIdentity() {
  try {
    const raw = window.localStorage.getItem(UNIFIED_STORAGE_KEY) ?? window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { email: string; userKey: string };
  } catch {
    return null;
  }
}
