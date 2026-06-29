import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const [users, professionals, companies] = await Promise.all([
      countVerifiedUsers(),
      countProfessionals(),
      countCompanies(),
    ]);

    console.info("Platform stats loaded", { companies, professionals, users });

    return NextResponse.json(
      { companies, professionals, users },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    console.error("PLATFORM STATS LOOKUP FAILED", error);
    return NextResponse.json(
      { error: "Platform stats are unavailable." },
      { headers: { "Cache-Control": "no-store" }, status: 500 },
    );
  }
}

async function countVerifiedUsers() {
  const supabase = getSupabaseAdminClient();
  const verified = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("email_verified", true);

  if (!verified.error) return verified.count ?? 0;

  console.warn("PLATFORM STATS VERIFIED USERS FALLBACK", verified.error);
  const fallback = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .not("email", "is", null);

  if (fallback.error) throw fallback.error;
  return fallback.count ?? 0;
}

async function countProfessionals() {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("public_profiles")
    .select("id", { count: "exact", head: true })
    .not("owner_user_id", "is", null)
    .neq("visibility", "removed")
    .in("source", ["linkedin_url", "linkedin_public_metadata", "manual_professional"]);

  if (error) {
    console.warn("PLATFORM STATS PROFESSIONALS FALLBACK", error);
    const fallback = await supabase
      .from("public_profiles")
      .select("id", { count: "exact", head: true })
      .not("owner_user_id", "is", null)
      .neq("visibility", "removed");
    if (fallback.error) throw fallback.error;
    return fallback.count ?? 0;
  }

  return count ?? 0;
}

async function countCompanies() {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if (error) throw error;
  return count ?? 0;
}
