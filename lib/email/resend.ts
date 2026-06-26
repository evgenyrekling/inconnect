import { renderDigestEmail } from "@/lib/digest-email";

type SendDigestEmailInput = {
  briefingText: string;
  digestTitle: string;
  heroImageUrl: string;
  readUrl: string;
  replyTo?: string;
  sourceUrl?: string;
  subject?: string;
  title: string;
  to: string;
  unsubscribeUrl?: string;
};

type ResendResponse = {
  id?: string;
  error?: {
    code?: string;
    message?: string;
    name?: string;
  };
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export class ResendEmailSendError extends Error {
  httpStatus: number;
  provider = "resend";
  providerCode: string;
  providerResponse: ResendResponse | null;
  recipient: string;

  constructor({
    httpStatus,
    message,
    providerCode,
    providerResponse,
    recipient,
  }: {
    httpStatus: number;
    message: string;
    providerCode?: string;
    providerResponse: ResendResponse | null;
    recipient: string;
  }) {
    super(message);
    this.name = "ResendEmailSendError";
    this.httpStatus = httpStatus;
    this.providerCode = providerCode ?? "";
    this.providerResponse = providerResponse;
    this.recipient = recipient;
  }
}

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
  sourceUrl,
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

  const logPrefix =
    digestTitle === "Airport Automation Daily"
      ? "AIRPORT DAILY EMAIL"
      : `${digestTitle.toUpperCase()} EMAIL`;

  console.info(`${logPrefix} RENDERING STARTED`, {
    digestTitle,
    recipient: to,
    title,
  });

  const rendered = renderDigestEmail({
    briefingText,
    digestTitle,
    heroImageUrl,
    readUrl,
    sourceUrl,
    title,
    unsubscribeUrl,
  });

  console.info(`${logPrefix} RENDERING COMPLETED`, {
    digestTitle,
    htmlLength: rendered.html.length,
    plainTextLength: rendered.plainText.length,
    recipient: to,
    subject: subject ?? rendered.subject,
  });

  const resendRequestBody = {
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
  };

  console.info(`${logPrefix} RESEND REQUEST STARTED`, {
    from,
    hasHtml: Boolean(resendRequestBody.html),
    hasText: Boolean(resendRequestBody.text),
    recipient: to,
    replyTo: configuredReplyTo,
    subject: resendRequestBody.subject,
  });

  const response = await fetch(RESEND_ENDPOINT, {
    body: JSON.stringify(resendRequestBody),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = (await response.json().catch(() => null)) as ResendResponse | null;

  console.info(`${logPrefix} RESEND RESPONSE RECEIVED`, {
    httpStatus: response.status,
    ok: response.ok,
    recipient: to,
    response: payload,
  });

  if (!response.ok || payload?.error) {
    const errorMessage =
      payload?.error?.message || `Resend email request failed with status ${response.status}.`;

    console.error(`${logPrefix} EMAIL FAILED`, {
      errorCode: payload?.error?.code ?? payload?.error?.name ?? "",
      errorMessage,
      httpStatus: response.status,
      recipient: to,
      response: payload,
    });

    throw new ResendEmailSendError({
      httpStatus: response.status,
      message: errorMessage,
      providerCode: payload?.error?.code ?? payload?.error?.name,
      providerResponse: payload,
      recipient: to,
    });
  }

  console.info(`${logPrefix} EMAIL SUCCESSFULLY SENT`, {
    httpStatus: response.status,
    providerMessageId: payload?.id ?? "",
    recipient: to,
    status: "sent",
  });

  return {
    id: payload?.id ?? "",
    provider: "resend" as const,
    providerResponse: payload,
    recipient: to,
    status: "sent" as const,
  };
}

function stripBriefingSuffix(value: string) {
  return value.replace(/\s*\|\s*INConnect 1-Minute Briefing\s*$/i, "").trim();
}
