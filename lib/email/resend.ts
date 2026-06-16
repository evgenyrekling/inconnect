import { renderDigestEmail } from "@/lib/digest-email";

type SendDigestEmailInput = {
  briefingText: string;
  digestTitle: string;
  heroImageUrl: string;
  readUrl: string;
  replyTo?: string;
  subject?: string;
  title: string;
  to: string;
  unsubscribeUrl?: string;
};

type ResendResponse = {
  id?: string;
  error?: {
    message?: string;
    name?: string;
  };
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendAirportDailyEmail(input: Omit<SendDigestEmailInput, "digestTitle">) {
  return sendDigestEmail({
    ...input,
    digestTitle: "Airport Automation Daily",
    subject: input.subject ?? `Airport Automation Daily | ${stripBriefingSuffix(input.title)}`,
  });
}

export async function sendLinkedInDailyEmail(input: Omit<SendDigestEmailInput, "digestTitle">) {
  return sendDigestEmail({
    ...input,
    digestTitle: "LinkedIn Daily",
    subject: input.subject ?? `LinkedIn Daily | ${input.title}`,
  });
}

export async function sendDigestEmail({
  briefingText,
  digestTitle,
  heroImageUrl,
  readUrl,
  replyTo,
  subject,
  title,
  to,
  unsubscribeUrl,
}: SendDigestEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "daily@in-connect.app";
  const configuredReplyTo = replyTo || process.env.EMAIL_REPLY_TO || "evgeny.rekling@gmail.com";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const rendered = renderDigestEmail({
    briefingText,
    digestTitle,
    heroImageUrl,
    readUrl,
    title,
    unsubscribeUrl,
  });

  const response = await fetch(RESEND_ENDPOINT, {
    body: JSON.stringify({
      from: `INConnect Daily <${from}>`,
      headers: unsubscribeUrl
        ? {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
      html: rendered.html,
      reply_to: configuredReplyTo,
      subject: subject ?? rendered.subject,
      text: rendered.plainText,
      to,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = (await response.json().catch(() => null)) as ResendResponse | null;

  if (!response.ok || payload?.error) {
    throw new Error(
      payload?.error?.message || `Resend email request failed with status ${response.status}.`,
    );
  }

  return {
    id: payload?.id ?? "",
  };
}

function stripBriefingSuffix(value: string) {
  return value.replace(/\s*\|\s*INConnect 1-Minute Briefing\s*$/i, "").trim();
}
