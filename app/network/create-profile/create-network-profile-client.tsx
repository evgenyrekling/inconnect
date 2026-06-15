"use client";

import { useState } from "react";

type CreatedProfile = {
  isPublic: boolean;
  profileStrength: number;
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
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [createdProfile, setCreatedProfile] = useState<CreatedProfile | null>(null);
  const [form, setForm] = useState({
    about: "",
    achievements: "",
    company: "",
    contactLinks: "",
    email: "",
    expertise: "",
    headline: "",
    industries: "",
    languages: "",
    location: "",
    linkedinUrl: "",
    name: "",
    problemsSolved: "",
    role: "",
    website: "",
    yearsOfExperience: "",
    customSections: [] as Array<{ content: string; title: string }>,
  });
  const requiredError = getRequiredError(form);

  async function generateProfile() {
    setMessage("");
    setIsGenerating(true);
    const response = await fetch("/api/network/create-profile", {
      body: JSON.stringify({
        ...form,
        expertise: splitList(form.expertise),
        industries: splitList(form.industries),
        languages: splitList(form.languages),
        customSections: form.customSections.filter(
          (section) => section.title.trim() && section.content.trim(),
        ),
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

    const userKey = payload.userKey ?? "";
    if (userKey) {
      saveIdentity({
        email: form.email,
        name: form.name,
        userKey,
      });
    }

    let photoUploadMessage = "";
    if (profilePhoto && userKey) {
      try {
        await uploadProfilePhoto({
          email: form.email,
          file: profilePhoto,
          slug: payload.profile.slug,
          userKey,
        });
      } catch (error) {
        photoUploadMessage =
          error instanceof Error ? ` ${error.message}` : " Profile photo could not be uploaded.";
      }
    }

    setCreatedProfile({
      ...payload.profile,
      profileStrength: calculateProfileStrength(form, Boolean(profilePhoto)),
    });
    setMessage(`Your INConnect profile has been created as unlisted.${photoUploadMessage}`);
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
            <StepLabel active={step === 1} done={step > 1} label="Step 1: Required Details" />
            <StepLabel active={step === 2} done={step > 2} label="Step 2: Optional Enrichment" />
            <StepLabel active={step === 3} done={Boolean(createdProfile)} label="Step 3: Generate" />
          </div>
        </aside>

        <div className="rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
          {step === 1 && (
            <div className="grid gap-4">
              <h2 className="text-2xl font-semibold">Step 1</h2>
              <TextField required label="Full Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
              <TextField required label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
              <TextField required label="Professional Headline" placeholder="Global Industry Manager | Airport Automation | Smart Infrastructure" value={form.headline} onChange={(value) => setForm({ ...form, headline: value })} />
              <TextField required label="Current Company" value={form.company} onChange={(value) => setForm({ ...form, company: value })} />
              <TextField required label="Current Role" value={form.role} onChange={(value) => setForm({ ...form, role: value })} />
              <TextField required label="Country / Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} />
              {requiredError && (
                <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm font-semibold text-[#B42318]">
                  {requiredError}
                </p>
              )}
              <button className="w-fit rounded-lg bg-[#4A6FD0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5EB7] disabled:cursor-not-allowed disabled:bg-[#D9DDE3] disabled:text-[#666666]" disabled={Boolean(requiredError)} onClick={() => setStep(2)} type="button">
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <h2 className="text-2xl font-semibold">Step 2</h2>
              <ProfilePhotoField file={profilePhoto} onChange={setProfilePhoto} />
              <TextField label="LinkedIn URL" placeholder="https://www.linkedin.com/in/your-profile" value={form.linkedinUrl} onChange={(value) => setForm({ ...form, linkedinUrl: value })} />
              <TextField label="Industries" placeholder="Airport automation, logistics, industrial automation" value={form.industries} onChange={(value) => setForm({ ...form, industries: value })} />
              <TextField label="Expertise" placeholder="RFID, BHS, sales leadership, AI, sensors" value={form.expertise} onChange={(value) => setForm({ ...form, expertise: value })} />
              <TextAreaField label="About" placeholder="A short professional summary in your own words." value={form.about} onChange={(value) => setForm({ ...form, about: value })} />
              <TextAreaField label="Achievements" placeholder="Awards, projects, launches, measurable wins, or career highlights." value={form.achievements} onChange={(value) => setForm({ ...form, achievements: value })} />
              <TextField label="Languages" placeholder="English, German, Hungarian" value={form.languages} onChange={(value) => setForm({ ...form, languages: value })} />
              <TextField label="Website" placeholder="https://your-site.com" value={form.website} onChange={(value) => setForm({ ...form, website: value })} />
              <TextAreaField label="Contact Links" placeholder="Calendly, portfolio, company page, newsletter, or other public links." value={form.contactLinks} onChange={(value) => setForm({ ...form, contactLinks: value })} />
              <TextField label="Years of Experience" value={form.yearsOfExperience} onChange={(value) => setForm({ ...form, yearsOfExperience: value })} />
              <TextAreaField label="What problems do you solve?" value={form.problemsSolved} onChange={(value) => setForm({ ...form, problemsSolved: value })} />
              <CustomSectionsEditor
                sections={form.customSections}
                onChange={(customSections) => setForm({ ...form, customSections })}
              />
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
                  <button className="rounded-lg bg-[#4A6FD0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5EB7] disabled:cursor-not-allowed disabled:bg-[#D9DDE3] disabled:text-[#666666]" disabled={isGenerating || Boolean(requiredError)} onClick={generateProfile} type="button">
                    {isGenerating ? "Generating Profile..." : "Generate Profile with AI"}
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-lg border border-[#D9DDE3] bg-[#F8FAFC] p-5">
                  <p className="text-sm font-semibold text-[#0A66C2]">
                    Visibility: <span className="capitalize">{createdProfile.visibility}</span>
                  </p>
                  <div className="mt-4 rounded-lg border border-[#D9DDE3] bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-[#191919]">Profile Strength</p>
                      <p className="text-2xl font-semibold text-[#0A66C2]">
                        {createdProfile.profileStrength}/100
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#D9DDE3]">
                      <div
                        className="h-full rounded-full bg-[#4A6FD0]"
                        style={{ width: `${createdProfile.profileStrength}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[#666666]">
                      Add a photo, summary, expertise, industries, achievements, links,
                      and custom content to improve completeness.
                    </p>
                  </div>
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
  required = false,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}{required ? " *" : ""}
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

function TextAreaField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <textarea
        className="min-h-28 rounded-lg border border-[#D9DDE3] px-3 py-2 text-sm leading-6"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function ProfilePhotoField({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="rounded-lg border border-[#D9DDE3] bg-[#F8FAFC] p-4">
      <p className="text-sm font-semibold">Profile Photo</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer rounded-lg bg-[#4A6FD0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3D5EB7]">
          {file ? "Replace Photo" : "Upload Photo"}
          <input
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        {file && (
          <button
            className="rounded-lg border border-[#D9DDE3] px-4 py-3 text-sm font-semibold"
            onClick={() => onChange(null)}
            type="button"
          >
            Remove
          </button>
        )}
      </div>
      {file && <p className="mt-3 text-xs text-[#666666]">{file.name}</p>}
    </div>
  );
}

function CustomSectionsEditor({
  onChange,
  sections,
}: {
  onChange: (sections: Array<{ content: string; title: string }>) => void;
  sections: Array<{ content: string; title: string }>;
}) {
  return (
    <div className="rounded-lg border border-[#D9DDE3] bg-[#F8FAFC] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Custom Sections</p>
        <button
          className="rounded-lg border border-[#D9DDE3] px-3 py-2 text-sm font-semibold"
          onClick={() => onChange([...sections, { content: "", title: "" }])}
          type="button"
        >
          Add Section
        </button>
      </div>
      <div className="mt-4 grid gap-4">
        {sections.map((section, index) => (
          <div className="grid gap-3 rounded-lg border border-[#D9DDE3] bg-white p-3" key={index}>
            <TextField
              label="Section Title"
              value={section.title}
              onChange={(value) =>
                onChange(sections.map((item, itemIndex) => itemIndex === index ? { ...item, title: value } : item))
              }
            />
            <TextAreaField
              label="Section Content"
              value={section.content}
              onChange={(value) =>
                onChange(sections.map((item, itemIndex) => itemIndex === index ? { ...item, content: value } : item))
              }
            />
            <button
              className="w-fit rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
              onClick={() => onChange(sections.filter((_, itemIndex) => itemIndex !== index))}
              type="button"
            >
              Remove Section
            </button>
          </div>
        ))}
      </div>
    </div>
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

function getRequiredError(form: {
  company: string;
  email: string;
  headline: string;
  location: string;
  name: string;
  role: string;
}) {
  if (!form.name.trim()) return "Full Name is required.";
  if (!isValidEmail(form.email)) return "A valid Email is required.";
  if (!form.headline.trim()) return "Professional Headline is required.";
  if (!form.company.trim()) return "Current Company is required.";
  if (!form.role.trim()) return "Current Role is required.";
  if (!form.location.trim()) return "Country / Location is required.";
  return "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function calculateProfileStrength(
  form: {
    about: string;
    achievements: string;
    contactLinks: string;
    customSections: Array<{ content: string; title: string }>;
    expertise: string;
    industries: string;
    linkedinUrl: string;
    website: string;
  },
  hasPhoto: boolean,
) {
  let score = 40;
  if (hasPhoto) score += 15;
  if (form.about.trim().length >= 80) score += 15;
  if (splitList(form.expertise).length >= 3) score += 10;
  if (splitList(form.industries).length >= 1) score += 8;
  if (form.achievements.trim().length >= 30) score += 7;
  if ([form.linkedinUrl, form.website, form.contactLinks].some((value) => value.trim())) score += 5;
  if (form.customSections.some((section) => section.title.trim() && section.content.trim())) score += 5;
  return Math.min(100, score);
}

async function uploadProfilePhoto({
  email,
  file,
  slug,
  userKey,
}: {
  email: string;
  file: File;
  slug: string;
  userKey: string;
}) {
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Profile photo must be jpg, jpeg, png, or webp.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Profile photo must be smaller than 5 MB.");
  }

  const formData = new FormData();
  formData.append("email", email);
  formData.append("file", file);
  formData.append("slug", slug);
  formData.append("userKey", userKey);

  const response = await fetch("/api/public-profiles/photo", {
    body: formData,
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? "Profile photo could not be uploaded.");
  }
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
