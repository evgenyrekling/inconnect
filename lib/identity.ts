import crypto from "node:crypto";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeLinkedInUrl(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export function createUserKey(email: string, _linkedinUrl = "") {
  return crypto
    .createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex");
}

export function createLegacyLinkedInScopedUserKey(email: string, linkedinUrl: string) {
  return crypto
    .createHash("sha256")
    .update(`${normalizeEmail(email)}|${normalizeLinkedInUrl(linkedinUrl)}`)
    .digest("hex");
}
