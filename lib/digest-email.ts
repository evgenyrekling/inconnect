type DigestEmailInput = {
  briefingText: string;
  heroImageUrl: string;
  readUrl: string;
  title: string;
};

export function renderDigestEmail({
  briefingText,
  heroImageUrl,
  readUrl,
  title,
}: DigestEmailInput) {
  const plainText = [
    title,
    "",
    stripMarkdown(briefingText),
    "",
    `Read Full Briefing: ${readUrl}`,
  ].join("\n");

  const html = [
    '<!doctype html>',
    '<html lang="en">',
    "<body style=\"margin:0;background:#f3f2ef;font-family:Arial,Helvetica,sans-serif;color:#191919;\">",
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f2ef;padding:24px 12px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #d9dde3;border-radius:12px;overflow:hidden;">',
    `<tr><td><img src="${escapeHtml(heroImageUrl)}" alt="" width="680" style="display:block;width:100%;height:auto;border:0;" /></td></tr>`,
    '<tr><td style="padding:28px;">',
    '<p style="margin:0 0 10px;color:#0a66c2;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">INConnect Intelligence</p>',
    `<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#191919;">${escapeHtml(title)}</h1>`,
    `<div style="font-size:16px;line-height:1.75;color:#444444;">${formatEmailParagraphs(briefingText)}</div>`,
    `<p style="margin:28px 0 0;"><a href="${escapeHtml(readUrl)}" style="display:inline-block;background:#4a6fd0;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:13px 18px;">Read Full Briefing</a></p>`,
    "</td></tr>",
    "</table>",
    "</td></tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");

  return {
    html,
    plainText,
    subject: title,
  };
}

function formatEmailParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;">${formatInlineMarkdown(paragraph)}</p>`)
    .join("");
}

function formatInlineMarkdown(value: string) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" style="color:#0a66c2;font-weight:700;text-decoration:underline;">$1</a>',
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function stripMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[#>*_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
