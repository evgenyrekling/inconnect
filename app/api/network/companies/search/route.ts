import { NextResponse } from "next/server";
import { searchCompanies } from "@/lib/professionals";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  const query = searchParams.get("query")?.trim() ?? "";

  const companies = await searchCompanies(query, id || undefined);
  return NextResponse.json({ companies });
}
