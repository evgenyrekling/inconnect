import { NextResponse } from "next/server";
import { extractPdfTextFromBuffer } from "@/lib/pdf-extraction";
import {
  parseUniversalSmartEntryImageToDraft,
  parseUniversalSmartEntryTextToDraft,
  type SmartEntryDraft,
} from "@/lib/smart-entry-parser";
import {
  fetchLinkedInPublicProfessionalData,
  parseProfessionalLinkedInUrl,
} from "@/lib/professionals";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Smart Entry input is required." }, { status: 400 });
    }

    const text = getFormString(formData, "text");
    const url = getFormString(formData, "url") || extractFirstUrl(text);
    const file = formData.get("file");

    if (file instanceof File) {
      const result = await analyzeFile(file, text, url);
      return result instanceof Response ? result : NextResponse.json(result);
    }

    if (url && isLinkedInProfileUrl(url) && !text.replace(url, "").trim()) {
      const draft = await createLinkedInDraft(url);
      return NextResponse.json(toAnalyzeResponse(draft, "linkedin_url"));
    }

    const urlContext = url ? await fetchPublicUrlContext(url) : "";
    const inputText = [text, urlContext].filter(Boolean).join("\n\n");
    if (!inputText.trim()) {
      return NextResponse.json(
        { error: "Paste text, a URL, or upload a file to analyze." },
        { status: 400 },
      );
    }

    const draft = await parseUniversalSmartEntryTextToDraft({
      inputText,
      inputType: url ? "url_or_text" : "text",
    });
    return NextResponse.json(toAnalyzeResponse(draft, url ? "url_or_text" : "text"));
  } catch (error) {
    console.error("UNIVERSAL SMART ENTRY ANALYZE ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Smart Entry analysis failed." },
      { status: 500 },
    );
  }
}

async function analyzeFile(file: File, text: string, url: string) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File size must be 10 MB or less." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = getFileMimeType(file);

  if (isAllowedImage(file, mimeType)) {
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    const draft = await parseUniversalSmartEntryImageToDraft({ dataUrl, mimeType });
    return toAnalyzeResponse(draft, "image");
  }

  if (isPdf(file, mimeType)) {
    const extraction = await extractPdfTextFromBuffer(buffer);
    const urlContext = url ? await fetchPublicUrlContext(url) : "";
    const inputText = [text, urlContext, extraction.fullText].filter(Boolean).join("\n\n");
    if (extraction.characterCount < 50 && !inputText.trim()) {
      return NextResponse.json(
        { error: "Could not extract readable text from this PDF." },
        { status: 400 },
      );
    }
    const draft = await parseUniversalSmartEntryTextToDraft({
      inputText,
      inputType: "pdf",
    });
    return toAnalyzeResponse(draft, "pdf");
  }

  if (isTxt(file, mimeType)) {
    const fileText = buffer.toString("utf8");
    const urlContext = url ? await fetchPublicUrlContext(url) : "";
    const draft = await parseUniversalSmartEntryTextToDraft({
      inputText: [text, urlContext, fileText].filter(Boolean).join("\n\n"),
      inputType: "txt",
    });
    return toAnalyzeResponse(draft, "txt");
  }

  return NextResponse.json(
    { error: "Supported files are PDF, JPG, PNG, WebP, and TXT." },
    { status: 400 },
  );
}

async function createLinkedInDraft(linkedinUrl: string): Promise<SmartEntryDraft> {
  const profile = await fetchLinkedInPublicProfessionalData(linkedinUrl);
  const parsed = parseProfessionalLinkedInUrl(linkedinUrl);
  const fullName = profile?.full_name || parsed?.suggestedName || "";
  const currentCompany = profile?.current_company || "";
  const currentTitle = profile?.current_title || "";
  const industry = "";
  const companies = currentCompany
    ? [
        {
          city: "",
          company_type: "Other",
          confidence: 0.55,
          country_name: "",
          description: "",
          display_name: currentCompany,
          industry,
          linkedin_url: "",
          name: currentCompany,
          notes: "Detected from LinkedIn public metadata.",
          website: "",
        },
      ]
    : [];

  return {
    companies,
    links:
      companies.length > 0
        ? [
            {
              company_index: 0,
              confidence: 0.65,
              department: "",
              is_primary: true,
              professional_index: 0,
              relationship_type: "employee",
              title: currentTitle,
            },
          ]
        : [],
    professionals: [
      {
        confidence: profile?.source === "linkedin_public_metadata" ? 0.75 : 0.35,
        current_company: currentCompany,
        current_title: currentTitle,
        education_summary: "",
        experience_summary: "",
        full_name: fullName,
        headline: profile?.headline || [currentTitle, currentCompany].filter(Boolean).join(" at "),
        industry,
        linkedin_url: profile?.linkedin_url || parsed?.originalLinkedinUrl || linkedinUrl,
        location: profile?.location || "",
        notes: "Review and edit before saving. INConnect uses only publicly available metadata.",
        phone: "",
        professional_email: "",
        profile_image_url: profile?.profile_image_url || "",
        skills: [],
      },
    ],
  };
}

function toAnalyzeResponse(draft: SmartEntryDraft, inputType: string) {
  return {
    companies: draft.companies,
    draft,
    inputType,
    professionals: draft.professionals,
    relationships: draft.links,
    summary: {
      companies: draft.companies.length,
      professionals: draft.professionals.length,
      relationships: draft.links.length,
    },
  };
}

async function fetchPublicUrlContext(value: string) {
  const url = parseSafePublicUrl(value);
  if (!url) return "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url.toString(), {
      headers: {
        accept: "text/html,text/plain,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; INConnectBot/1.0; +https://in-connect.app)",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return `URL: ${url.toString()}`;
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    const text = contentType.includes("html") ? htmlToText(body) : body;
    return [
      `URL: ${url.toString()}`,
      `Page title: ${extractTitle(body)}`,
      `Description: ${extractMeta(body, "description") || extractMeta(body, "og:description")}`,
      text,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 16000);
  } catch {
    return `URL: ${url.toString()}`;
  }
}

function parseSafePublicUrl(value: string) {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getFileMimeType(file: File) {
  if (file.type) return file.type;
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  if (/\.jpe?g$/i.test(file.name)) return "image/jpeg";
  if (/\.pdf$/i.test(file.name)) return "application/pdf";
  if (/\.txt$/i.test(file.name)) return "text/plain";
  return "application/octet-stream";
}

function isAllowedImage(file: File, mimeType: string) {
  return ALLOWED_IMAGE_TYPES.has(mimeType) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function isPdf(file: File, mimeType: string) {
  return mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isTxt(file: File, mimeType: string) {
  return mimeType.startsWith("text/") || file.name.toLowerCase().endsWith(".txt");
}

function isLinkedInProfileUrl(value: string) {
  return Boolean(parseProfessionalLinkedInUrl(value));
}

function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/[^\s)]+/i)?.[0] ?? "";
}

function htmlToText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string) {
  return decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "").slice(0, 300);
}

function extractMeta(html: string, property: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]).slice(0, 500);
  }
  return "";
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
