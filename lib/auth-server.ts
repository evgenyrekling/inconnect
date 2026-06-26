import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getOrCreateUserByEmail } from "@/lib/user-profile-store";

export type VerifiedInconnectUser = {
  email: string;
  name: string;
  normalizedEmail: string;
  supabaseAuthUserId: string;
  userId: string;
  userKey: string;
};

export async function getVerifiedInconnectUserFromRequest(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) {
    console.error("INConnect verified auth lookup failed", error);
    return null;
  }

  const email = normalizeEmail(data.user.email);
  const name =
    getAuthUserName(data.user.user_metadata) ||
    getAuthUserName(data.user.app_metadata) ||
    "";
  const isAdminUser = getAdminEmails().includes(email);
  const { user } = await getOrCreateUserByEmail(supabase, {
    email,
    isAdminUser,
    name,
    planType: isAdminUser ? "admin" : "free",
  });
  const timestamp = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {
    auth_provider: "email_otp",
    email_verified: true,
    last_login_at: timestamp,
    normalized_email: email,
    supabase_auth_user_id: data.user.id,
    updated_at: timestamp,
  };
  if (!user.name && name) updatePayload.name = name;
  updatePayload.email_verified_at = timestamp;

  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", user.id)
    .select("id, user_key, name, email, normalized_email, supabase_auth_user_id")
    .single<{
      email: string;
      id: string;
      name: string | null;
      normalized_email: string | null;
      supabase_auth_user_id: string | null;
      user_key: string;
    }>();

  if (updateError) {
    console.error("INConnect verified user sync update failed", {
      error: updateError,
      updatePayload,
      userId: user.id,
    });
    throw updateError;
  }

  return {
    email: updatedUser.email,
    name: updatedUser.name ?? name,
    normalizedEmail: updatedUser.normalized_email ?? email,
    supabaseAuthUserId: updatedUser.supabase_auth_user_id ?? data.user.id,
    userId: updatedUser.id,
    userKey: updatedUser.user_key,
  } satisfies VerifiedInconnectUser;
}

export function requireVerifiedInconnectUser(user: VerifiedInconnectUser | null) {
  if (!user) {
    throw new Error("Verified email sign-in is required.");
  }

  return user;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
}

function getAuthUserName(metadata: unknown) {
  if (typeof metadata !== "object" || metadata === null) return "";
  const record = metadata as Record<string, unknown>;
  const value = record.name ?? record.full_name;
  return typeof value === "string" ? value.trim() : "";
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}
