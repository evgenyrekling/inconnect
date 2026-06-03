import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const PROFILE_PDF_BUCKET = "profile-pdfs";

type DebugSupabaseResponse = {
  hasSupabaseUrl: boolean;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  usersTableReachable: boolean;
  userProfilesTableReachable: boolean;
  assessmentsTableReachable: boolean;
  usageLimitsReachable: boolean;
  storageBucketReachable: boolean;
};

export async function GET() {
  const response: DebugSupabaseResponse = {
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    usersTableReachable: false,
    userProfilesTableReachable: false,
    assessmentsTableReachable: false,
    usageLimitsReachable: false,
    storageBucketReachable: false,
  };

  if (!response.hasSupabaseUrl || !response.hasServiceRoleKey) {
    return NextResponse.json(response);
  }

  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    console.error("Supabase debug client initialization failed", error);
    return NextResponse.json(response);
  }

  const [
    usersTableReachable,
    userProfilesTableReachable,
    assessmentsTableReachable,
    usageLimitsReachable,
    storageBucketReachable,
  ] = await Promise.all([
    isTableReachable(supabase, "users"),
    isTableReachable(supabase, "user_profiles"),
    isTableReachable(supabase, "assessments"),
    isTableReachable(supabase, "usage_limits"),
    isStorageBucketReachable(supabase),
  ]);

  return NextResponse.json({
    ...response,
    usersTableReachable,
    userProfilesTableReachable,
    assessmentsTableReachable,
    usageLimitsReachable,
    storageBucketReachable,
  });
}

async function isTableReachable(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tableName: "users" | "user_profiles" | "assessments" | "usage_limits",
) {
  try {
    const { error } = await supabase
      .from(tableName)
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error(`Supabase debug ${tableName} table check failed`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Supabase debug ${tableName} table check threw`, error);
    return false;
  }
}

async function isStorageBucketReachable(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  try {
    const { error } = await supabase.storage.getBucket(PROFILE_PDF_BUCKET);

    if (error) {
      console.error("Supabase debug storage bucket check failed", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Supabase debug storage bucket check threw", error);
    return false;
  }
}
