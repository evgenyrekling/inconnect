import crypto from "node:crypto";
import { normalizeEmail } from "@/lib/identity";
import type { ProfessionalProfile } from "@/lib/professionals";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type InvitationRow = {
  claimed_at: string | null;
  created_at: string | null;
  id: string;
  invitation_token: string;
  normalized_professional_email: string;
  owner_user_id: string | null;
  professional_email: string;
  professional_id: string | null;
  removed_at: string | null;
  sent_at: string | null;
  status: string | null;
};

type InvitationProfessionalRow = {
  company: string | null;
  current_company: string | null;
  current_title: string | null;
  display_name: string | null;
  headline: string | null;
  id: string;
  linkedin_url: string | null;
  normalized_professional_email: string | null;
  professional_email: string | null;
};

type OwnerRow = {
  email: string | null;
  id: string;
  name: string | null;
  normalized_email: string | null;
};

type ResendResponse = {
  id?: string;
  error?: {
    message?: string;
    name?: string;
  };
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RECENT_INVITATION_DAYS = 14;

export async function createAndSendProfessionalInvitation(input: {
  ownerEmail: string;
  ownerName?: string;
  ownerUserId: string;
  professional: ProfessionalProfile;
}) {
  const professionalEmail = cleanEmail(input.professional.professionalEmail);
  if (!professionalEmail) {
    return {
      sent: false,
      message: "Professional email was not provided.",
      status: "skipped",
    };
  }

  const supabase = getSupabaseAdminClient();
  const normalizedProfessionalEmail = normalizeEmail(professionalEmail);
  const since = new Date(Date.now() - RECENT_INVITATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentInvitation, error: recentError } = await supabase
    .from("professional_invitations")
    .select("id, sent_at, status")
    .eq("owner_user_id", input.ownerUserId)
    .eq("normalized_professional_email", normalizedProfessionalEmail)
    .gte("sent_at", since)
    .in("status", ["sent", "claimed"])
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; sent_at: string | null; status: string | null }>();

  if (recentError) {
    console.error("PROFESSIONAL INVITATION DUPLICATE LOOKUP ERROR", recentError);
    throw new Error(recentError.message || "Invitation duplicate check failed.");
  }

  if (recentInvitation) {
    return {
      sent: false,
      message: "Invitation already sent recently.",
      status: "duplicate_recent",
    };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const sentAt = new Date().toISOString();
  const baseUrl = getBaseUrl();
  const claimUrl = `${baseUrl}/claim-professional?token=${token}`;
  const removalUrl = `${baseUrl}/remove-professional?token=${token}`;
  const ownerName = cleanText(input.ownerName) || input.ownerEmail.split("@")[0] || "An INConnect user";

  const emailResult = await sendInvitationEmail({
    claimUrl,
    ownerEmail: input.ownerEmail,
    ownerName,
    professionalEmail,
    professionalName: input.professional.displayName,
    removalUrl,
  });

  const { data: invitation, error: insertError } = await supabase
    .from("professional_invitations")
    .insert({
      invitation_token: token,
      normalized_professional_email: normalizedProfessionalEmail,
      owner_user_id: input.ownerUserId,
      professional_email: professionalEmail,
      professional_id: input.professional.id,
      sent_at: sentAt,
      status: "sent",
    })
    .select("id, professional_id, owner_user_id, professional_email, normalized_professional_email, invitation_token, status, sent_at, claimed_at, removed_at, created_at")
    .single<InvitationRow>();

  if (insertError) {
    console.error("PROFESSIONAL INVITATION INSERT ERROR", insertError);
    throw new Error(insertError.message || "Invitation could not be saved.");
  }

  await logInvitationEvent(invitation.id, "invitation_sent", {
    resendMessageId: emailResult.id,
    recipient: professionalEmail,
  });

  console.info("PROFESSIONAL INVITATION SENT", {
    invitationId: invitation.id,
    professionalId: input.professional.id,
    recipient: professionalEmail,
    resendMessageId: emailResult.id,
  });

  return {
    invitationId: invitation.id,
    message: "Invitation email sent.",
    resendMessageId: emailResult.id,
    sent: true,
    status: "sent",
  };
}

export async function getProfessionalInvitation(token: string, eventType?: string) {
  const cleanToken = cleanText(token);
  if (!cleanToken) return null;

  const supabase = getSupabaseAdminClient();
  const { data: invitation, error } = await supabase
    .from("professional_invitations")
    .select("id, professional_id, owner_user_id, professional_email, normalized_professional_email, invitation_token, status, sent_at, claimed_at, removed_at, created_at")
    .eq("invitation_token", cleanToken)
    .maybeSingle<InvitationRow>();

  if (error) {
    console.error("PROFESSIONAL INVITATION TOKEN LOOKUP ERROR", error);
    throw new Error(error.message || "Invitation could not be loaded.");
  }
  if (!invitation) return null;

  const { data: professional, error: professionalError } = await supabase
    .from("public_profiles")
    .select("id, display_name, headline, linkedin_url, current_title, current_company, company, professional_email, normalized_professional_email")
    .eq("id", invitation.professional_id ?? "")
    .maybeSingle<InvitationProfessionalRow>();
  if (professionalError) {
    console.error("PROFESSIONAL INVITATION PROFILE LOOKUP ERROR", professionalError);
    throw new Error(professionalError.message || "Professional profile could not be loaded.");
  }

  const owner = invitation.owner_user_id
    ? await getInvitationOwner(invitation.owner_user_id)
    : null;

  if (eventType) {
    await logInvitationEvent(invitation.id, eventType, {});
  }

  return {
    id: invitation.id,
    professional: sanitizeProfessional(professional, invitation),
    professionalEmail: invitation.professional_email,
    sentAt: invitation.sent_at ?? "",
    status: invitation.status ?? "sent",
    owner: {
      email: owner?.email ?? "",
      name: owner?.name || owner?.email?.split("@")[0] || "An INConnect user",
    },
  };
}

export async function claimProfessionalInvitation(input: {
  token: string;
  verifiedEmail: string;
  verifiedUserId: string;
}) {
  const invitation = await getProfessionalInvitation(input.token);
  if (!invitation) throw new Error("Invitation was not found.");
  if (normalizeEmail(input.verifiedEmail) !== normalizeEmail(invitation.professionalEmail)) {
    throw new Error("Verified email does not match this invitation.");
  }

  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("professional_invitations")
    .update({
      claimed_at: now,
      status: "claimed",
    })
    .eq("id", invitation.id);
  if (error) throw new Error(error.message || "Invitation could not be claimed.");

  await logInvitationEvent(invitation.id, "profile_claimed", {
    verifiedEmail: normalizeEmail(input.verifiedEmail),
    verifiedUserId: input.verifiedUserId,
  });

  return { success: true };
}

export async function requestProfessionalRemoval(token: string) {
  const invitation = await getProfessionalInvitation(token);
  if (!invitation) throw new Error("Invitation was not found.");

  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { error: invitationError } = await supabase
    .from("professional_invitations")
    .update({
      removed_at: now,
      status: "removed",
    })
    .eq("id", invitation.id);
  if (invitationError) {
    throw new Error(invitationError.message || "Removal request could not be saved.");
  }

  if (invitation.professional?.id) {
    const { error: profileError } = await supabase
      .from("public_profiles")
      .update({
        updated_at: now,
        visibility: "removed",
      })
      .eq("id", invitation.professional.id);
    if (profileError) {
      console.error("PROFESSIONAL REMOVAL PROFILE UPDATE ERROR", profileError);
    }
  }

  await logInvitationEvent(invitation.id, "removal_requested", {});
  return { success: true };
}

async function sendInvitationEmail(input: {
  claimUrl: string;
  ownerEmail: string;
  ownerName: string;
  professionalEmail: string;
  professionalName: string;
  removalUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");

  const from = process.env.NETWORK_EMAIL_FROM || process.env.EMAIL_FROM || "daily@in-connect.app";
  const subject = `${input.ownerName} added you to their INConnect network`;
  const plainText = [
    `Hi ${input.professionalName || "there"},`,
    "",
    `${input.ownerName} added you to their professional network on INConnect.`,
    "",
    "INConnect helps professionals connect with companies, market intelligence, and business opportunities.",
    "",
    "You can claim your profile, review the information, or request removal.",
    "",
    `Claim Profile: ${input.claimUrl}`,
    `Request Removal: ${input.removalUrl}`,
    "",
    `You received this because ${input.ownerName} added your professional email while building their network on INConnect.`,
  ].join("\n");
  const html = renderInvitationEmail(input);

  const response = await fetch(RESEND_ENDPOINT, {
    body: JSON.stringify({
      from: `INConnect Network <${from}>`,
      html,
      reply_to: input.ownerEmail,
      subject,
      text: plainText,
      to: input.professionalEmail,
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
      payload?.error?.message || `Resend invitation failed with status ${response.status}.`,
    );
  }

  return { id: payload?.id ?? "" };
}

function renderInvitationEmail(input: {
  claimUrl: string;
  ownerName: string;
  professionalName: string;
  removalUrl: string;
}) {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<body style="margin:0;background:#f3f2ef;font-family:Arial,Helvetica,sans-serif;color:#191919;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f2ef;padding:24px 12px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d9dde3;border-radius:12px;overflow:hidden;">',
    '<tr><td style="padding:22px 28px;background:#071A33;color:#ffffff;">',
    '<div style="font-size:22px;font-weight:800;">INConnect</div>',
    '<div style="font-size:12px;color:#b8d3ff;margin-top:3px;">Professional Intelligence Platform</div>',
    '</td></tr>',
    '<tr><td style="padding:28px;">',
    `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(input.professionalName || "there")},</p>`,
    `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;"><strong>${escapeHtml(input.ownerName)}</strong> added you to their professional network on INConnect.</p>`,
    '<p style="margin:0 0 18px;font-size:16px;line-height:1.7;">INConnect helps professionals connect with companies, market intelligence, and business opportunities.</p>',
    '<p style="margin:0 0 24px;font-size:16px;line-height:1.7;">You can claim your profile, review the information, or request removal.</p>',
    `<p style="margin:0 0 24px;"><a href="${escapeHtml(input.claimUrl)}" style="display:inline-block;background:#4a6fd0;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:13px 18px;">Claim Profile</a> <a href="${escapeHtml(input.removalUrl)}" style="display:inline-block;margin-left:10px;border:1px solid #d9dde3;color:#191919;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 18px;">Request Removal</a></p>`,
    `<p style="margin:0;font-size:12px;line-height:1.6;color:#666666;">You received this because ${escapeHtml(input.ownerName)} added your professional email while building their network on INConnect.</p>`,
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join("");
}

async function getInvitationOwner(ownerUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, normalized_email")
    .eq("id", ownerUserId)
    .maybeSingle<OwnerRow>();
  if (error) {
    console.error("PROFESSIONAL INVITATION OWNER LOOKUP ERROR", error);
    return null;
  }
  return data;
}

async function logInvitationEvent(invitationId: string, eventType: string, details: unknown) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("professional_invitation_events").insert({
    details,
    event_type: eventType,
    invitation_id: invitationId,
  });
  if (error) {
    console.error("PROFESSIONAL INVITATION EVENT LOG ERROR", {
      error,
      eventType,
      invitationId,
    });
  }
}

function sanitizeProfessional(
  professional: InvitationProfessionalRow | null,
  invitation: InvitationRow,
) {
  if (!professional) return null;
  return {
    company: professional.current_company ?? professional.company ?? "",
    currentTitle: professional.current_title ?? "",
    email: invitation.professional_email,
    headline: professional.headline ?? "",
    id: professional.id,
    linkedinUrl: professional.linkedin_url ?? "",
    name: professional.display_name ?? "",
  };
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ||
    "https://in-connect.app"
  ).replace(/\/+$/, "");
}

function cleanEmail(value: unknown) {
  const text = cleanText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : "";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
