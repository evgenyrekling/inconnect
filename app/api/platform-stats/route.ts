import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  try {
    const [registeredUsers, privateProfessionals, companies] = await Promise.all([
      countRegisteredUsers(),
      countPrivateProfessionals(),
      countCompanies(),
    ]);
    const totalProfessionals = registeredUsers + privateProfessionals;

    console.info("Platform stats loaded", {
      companies,
      privateProfessionals,
      registeredUsers,
      totalProfessionals,
    });

    return NextResponse.json(
      {
        companies,
        privateProfessionals,
        registeredUsers,
        totalProfessionals,
      },
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

async function countRegisteredUsers() {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

async function countPrivateProfessionals() {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("public_profiles")
    .select("id", { count: "exact", head: true })
    .eq("profile_type", "professional")
    .neq("visibility", "removed")
    .or("owner_user_id.not.is.null,owner_email.not.is.null");

  if (error) {
    console.warn("PLATFORM STATS PRIVATE PROFESSIONALS FALLBACK", error);
    const fallback = await supabase
      .from("public_profiles")
      .select("id", { count: "exact", head: true })
      .neq("visibility", "removed")
      .or("owner_user_id.not.is.null,owner_email.not.is.null");
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
