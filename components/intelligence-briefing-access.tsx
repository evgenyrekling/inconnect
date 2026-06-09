"use client";

import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

type IntelligenceBriefingAccessProps = {
  consentLabel?: string;
  fullContent: string;
  intelligenceType: string;
  previewContent: string;
  streamTitle: string;
  unlockTitle: string;
};

type StoredReturningIdentity = {
  email: string;
  latestAssessmentId?: string;
  linkedinUrl?: string;
  name?: string;
  userKey: string;
};

type IntelligenceSubscriptionResponse = {
  email: string;
  intelligenceType: string;
  message: string;
  userKey: string;
};

const RETURNING_USER_STORAGE_KEY = "inconnect:returning-user";

export function IntelligenceBriefingAccess({
  consentLabel = "I agree that INConnect may store my information and send me relevant intelligence updates.",
  fullContent,
  intelligenceType,
  previewContent,
  streamTitle,
  unlockTitle,
}: IntelligenceBriefingAccessProps) {
  const [accessState, setAccessState] = useState<"checking" | "locked" | "unlocked">(
    "checking",
  );
  const [identity, setIdentity] = useState<StoredReturningIdentity | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hasConsent, setHasConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const displayName = useMemo(() => getIdentityDisplayName(identity), [identity]);
  const canSubmit =
    name.trim().length >= 2 && isValidEmail(email) && hasConsent && !isSubmitting;
  const isUnlocked = accessState === "unlocked";

  useEffect(() => {
    const storedIdentity = readStoredReturningIdentity();

    if (!storedIdentity?.email) {
      setAccessState("locked");
      return;
    }

    setIdentity(storedIdentity);
    setName(storedIdentity.name ?? "");
    setEmail(storedIdentity.email);
    setAccessState("unlocked");
    setMessage(displayWelcomeBackMessage(getIdentityDisplayName(storedIdentity)));
    void saveIntelligenceInterest({
      identity: storedIdentity,
      intelligenceType,
    }).catch((saveError) => {
      console.error("INConnect briefing interest could not be saved", saveError);
    });
  }, [intelligenceType]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const unlockedIdentity = await saveIntelligenceInterest({
        identity: {
          email,
          latestAssessmentId: identity?.latestAssessmentId,
          linkedinUrl: identity?.linkedinUrl ?? "",
          name,
          userKey: identity?.userKey ?? "",
        },
        intelligenceType,
      });
      setIdentity(unlockedIdentity);
      setAccessState("unlocked");
      setMessage("Full briefing unlocked.");
    } catch (unlockError) {
      setError(
        unlockError instanceof Error
          ? unlockError.message
          : "This briefing could not be unlocked. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[820px] rounded-lg border border-[#D9DDE3] bg-white p-6 shadow-[0_8px_24px_rgba(10,25,47,0.05)] sm:p-9">
      {message && (
        <div className="mb-6 rounded-lg border border-[#0A66C2]/20 bg-[#F3F7FD] px-4 py-3 text-sm font-semibold text-[#0A66C2]">
          {message}
        </div>
      )}

      <div className="relative">
        <MarkdownContent content={isUnlocked ? fullContent : previewContent} />
        {!isUnlocked && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-white/0 to-white"
          />
        )}
      </div>

      {!isUnlocked && (
        <section className="mt-8 rounded-lg border border-[#0A66C2]/20 bg-[#F3F7FD] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A66C2]">
            {streamTitle}
          </p>
          <h2 className="mt-2 text-2xl font-semibold leading-snug text-[#191919]">
            {unlockTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            Enter your details to unlock the full briefing and help INConnect
            personalize future professional intelligence updates for you.
          </p>

          {accessState === "checking" ? (
            <p className="mt-5 text-sm font-semibold text-[#0A66C2]">
              Checking your INConnect profile...
            </p>
          ) : (
            <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                Name
                <input
                  className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  value={name}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#191919]">
                Email
                <input
                  className="h-11 rounded-lg border border-[#D9DDE3] px-3 text-sm font-normal outline-none transition focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                />
              </label>
              <label className="flex items-start gap-3 text-sm leading-6 text-[#666666]">
                <input
                  checked={hasConsent}
                  className="mt-1 h-4 w-4 rounded border-[#D9DDE3] text-[#0A66C2] focus:ring-[#0A66C2]"
                  onChange={(event) => setHasConsent(event.target.checked)}
                  type="checkbox"
                />
                <span>{consentLabel}</span>
              </label>
              {error && (
                <p className="rounded-lg border border-[#B24020]/20 bg-[#FFF4F1] px-4 py-3 text-sm font-semibold text-[#B24020]">
                  {error}
                </p>
              )}
              <button
                className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#4A6FD0] px-5 text-sm font-semibold text-white transition-colors duration-200 ease-[ease] hover:bg-[#3859B8] disabled:cursor-not-allowed disabled:bg-[#D9DDE3] disabled:text-[#666666]"
                disabled={!canSubmit}
                type="submit"
              >
                {isSubmitting ? "Unlocking..." : "Unlock Full Briefing"}
              </button>
            </form>
          )}
        </section>
      )}

      {isUnlocked && displayName && (
        <p className="mt-8 text-sm font-semibold text-[#0A66C2]">
          Welcome back, {displayName}.
        </p>
      )}
    </div>
  );
}

async function saveIntelligenceInterest({
  identity,
  intelligenceType,
}: {
  identity: StoredReturningIdentity;
  intelligenceType: string;
}) {
  const response = await fetch("/api/intelligence-subscriptions", {
    body: JSON.stringify({
      email: identity.email,
      intelligenceType,
      name: identity.name ?? "",
      profileConsent: true,
      userKey: identity.userKey || undefined,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok || !isIntelligenceSubscriptionResponse(payload)) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "This briefing could not be unlocked. Please try again.";
    throw new Error(message);
  }

  const nextIdentity: StoredReturningIdentity = {
    email: payload.email,
    latestAssessmentId: identity.latestAssessmentId,
    linkedinUrl: identity.linkedinUrl ?? "",
    name: identity.name,
    userKey: payload.userKey,
  };
  storeReturningIdentity(nextIdentity);
  return nextIdentity;
}

function readStoredReturningIdentity(): StoredReturningIdentity | null {
  try {
    const raw = window.localStorage.getItem(RETURNING_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isStoredReturningIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeReturningIdentity(identity: StoredReturningIdentity) {
  try {
    window.localStorage.setItem(RETURNING_USER_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // localStorage can be unavailable in private browsing or embedded contexts.
  }
}

function isStoredReturningIdentity(value: unknown): value is StoredReturningIdentity {
  if (typeof value !== "object" || value === null) return false;

  const record = value as Record<string, unknown>;
  return typeof record.userKey === "string" && typeof record.email === "string";
}

function isIntelligenceSubscriptionResponse(
  value: unknown,
): value is IntelligenceSubscriptionResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "email" in value &&
    typeof value.email === "string" &&
    "message" in value &&
    typeof value.message === "string" &&
    "userKey" in value &&
    typeof value.userKey === "string"
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getIdentityDisplayName(identity?: StoredReturningIdentity | null) {
  const name = identity?.name?.trim() ?? "";
  if (name && !/^not clearly/i.test(name)) return name;
  return identity?.email?.split("@")[0] ?? "";
}

function displayWelcomeBackMessage(name: string) {
  return name ? `Welcome back, ${name}. Full briefing unlocked.` : "Full briefing unlocked.";
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="grid gap-5 text-[17px] leading-[1.8] text-[#444444]">
      {blocks.map((block, index) => renderMarkdownBlock(block, index))}
    </div>
  );
}

type MarkdownBlock =
  | { content: string; type: "blockquote" | "h1" | "h2" | "h3" | "p" }
  | { items: string[]; type: "ol" | "ul" };

function renderMarkdownBlock(block: MarkdownBlock, index: number) {
  switch (block.type) {
    case "h1":
      return (
        <h1
          className="mt-2 text-3xl font-semibold leading-tight text-[#191919] sm:text-4xl"
          key={index}
        >
          {renderInlineMarkdown(block.content)}
        </h1>
      );
    case "h2":
      return (
        <h2
          className="mt-10 text-2xl font-semibold leading-snug text-[#191919] first:mt-0 sm:text-3xl"
          key={index}
        >
          {renderInlineMarkdown(block.content)}
        </h2>
      );
    case "h3":
      return (
        <h3
          className="mt-6 text-xl font-semibold leading-snug text-[#191919]"
          key={index}
        >
          {renderInlineMarkdown(block.content)}
        </h3>
      );
    case "ul":
      return (
        <ul className="grid gap-2 pl-6 marker:text-[#0A66C2]" key={index}>
          {block.items.map((item, itemIndex) => (
            <li className="list-disc pl-1" key={`${item}-${itemIndex}`}>
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol
          className="grid gap-2 pl-6 marker:font-semibold marker:text-[#0A66C2]"
          key={index}
        >
          {block.items.map((item, itemIndex) => (
            <li className="list-decimal pl-1" key={`${item}-${itemIndex}`}>
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
    case "blockquote":
      return (
        <blockquote
          className="rounded-r-lg border-l-4 border-[#0A66C2] bg-[#F3F7FD] px-5 py-4 text-[#2F3A4A]"
          key={index}
        >
          {renderInlineMarkdown(block.content)}
        </blockquote>
      );
    default:
      return <p key={index}>{renderInlineMarkdown(block.content)}</p>;
  }
}

function renderInlineMarkdown(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const inlinePattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(value)) !== null) {
    if (match.index > lastIndex) nodes.push(value.slice(lastIndex, match.index));

    const token = match[0];
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      if (!linkMatch[2].startsWith("/")) {
        nodes.push(linkMatch[1]);
        lastIndex = match.index + match[0].length;
        continue;
      }

      nodes.push(
        <Link
          className="font-semibold text-[#0A66C2] underline-offset-4 transition hover:text-[#004182] hover:underline"
          href={linkMatch[2]}
          key={`${linkMatch[1]}-${match.index}`}
        >
          {linkMatch[1]}
        </Link>,
      );
    } else {
      nodes.push(
        <strong className="font-semibold text-[#191919]" key={`${token}-${match.index}`}>
          {token.replace(/^\*\*|\*\*$/g, "")}
        </strong>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) nodes.push(value.slice(lastIndex));
  return nodes;
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (/^#\s+/.test(line)) {
      blocks.push({ content: line.replace(/^#\s+/, ""), type: "h1" });
      index += 1;
      continue;
    }

    if (/^##\s+/.test(line)) {
      blocks.push({ content: line.replace(/^##\s+/, ""), type: "h2" });
      index += 1;
      continue;
    }

    if (/^###\s+/.test(line)) {
      blocks.push({ content: line.replace(/^###\s+/, ""), type: "h3" });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ content: quoteLines.join(" "), type: "blockquote" });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ items, type: "ul" });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ items, type: "ol" });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isMarkdownBlockStart(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ content: paragraphLines.join(" "), type: "p" });
  }

  return blocks;
}

function isMarkdownBlockStart(line: string) {
  return (
    /^#{1,3}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line)
  );
}
