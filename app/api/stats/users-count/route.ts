import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { count, error } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("INConnect users count lookup failed", error);
      return NextResponse.json(
        { error: "Users count is unavailable." },
        { headers: { "Cache-Control": "no-store" }, status: 500 },
      );
    }

    return NextResponse.json(
      { usersCount: count ?? 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("INConnect users count route failed", error);
    return NextResponse.json(
      { error: "Users count is unavailable." },
      { headers: { "Cache-Control": "no-store" }, status: 500 },
    );
  }
}
