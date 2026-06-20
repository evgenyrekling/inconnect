import type { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const AIRPORT_BRIEFINGS_EXPECTED_COLUMNS = [
  "id",
  "slug",
  "title",
  "airport_name",
  "category",
  "excerpt",
  "content",
  "hero_image_url",
  "hero_image_prompt",
  "source_name",
  "source_url",
  "source_domain",
  "source_image_url",
  "source_image_domain",
  "image_attribution",
  "keywords",
  "research_sources",
  "research_summary",
  "summary",
  "inconnect_view",
  "reading_time",
  "is_source_based",
  "quality_score",
  "status",
  "is_draft_candidate",
  "auto_send_allowed",
  "quality_rejection_reason",
  "source_url_type",
  "seo_title",
  "seo_description",
  "published",
  "published_at",
  "sent_at",
  "generated_at",
  "created_at",
] as const;

export const AIRPORT_DAILY_CANDIDATES_EXPECTED_COLUMNS = [
  "id",
  "title",
  "source_url",
  "source_name",
  "source_image_url",
  "category",
  "notes",
  "status",
  "priority",
  "selected_for_digest",
  "used_at",
  "created_by_email",
  "created_at",
  "updated_at",
] as const;

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

export type AirportDailySchemaValidationResult = {
  missingColumns: Record<string, string[]>;
  missingTables: string[];
};

export async function validateAirportDailySchema(
  supabase: SupabaseAdminClient,
  context: string,
): Promise<AirportDailySchemaValidationResult> {
  const result: AirportDailySchemaValidationResult = {
    missingColumns: {},
    missingTables: [],
  };

  await validateTableColumns({
    columns: AIRPORT_BRIEFINGS_EXPECTED_COLUMNS,
    context,
    result,
    supabase,
    table: "airport_briefings",
  });
  await validateTableColumns({
    columns: AIRPORT_DAILY_CANDIDATES_EXPECTED_COLUMNS,
    context,
    result,
    supabase,
    table: "airport_daily_candidates",
  });

  const hasMissing =
    result.missingTables.length > 0 ||
    Object.values(result.missingColumns).some((columns) => columns.length > 0);

  if (hasMissing) {
    console.error("AIRPORT DAILY SCHEMA VALIDATION MISSING FIELDS", {
      context,
      migration: "supabase/migrations/202606200003_airport_daily_canonical_schema.sql",
      ...result,
    });
  } else {
    console.info("AIRPORT DAILY SCHEMA VALIDATION PASSED", { context });
  }

  return result;
}

export function isAirportDailyMissingSchemaError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const code = String((error as { code?: unknown }).code ?? "");
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    message.includes("could not find") ||
    message.includes("schema cache") ||
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

export function getAirportDailyMissingSchemaField(error: unknown) {
  if (typeof error !== "object" || error === null) return "";
  const message = String((error as { message?: unknown }).message ?? "");
  return (
    /'([^']+)'\s+column/i.exec(message)?.[1] ??
    /column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i.exec(message)?.[1] ??
    /relation\s+"?([a-zA-Z0-9_.]+)"?\s+does not exist/i.exec(message)?.[1] ??
    ""
  );
}

async function validateTableColumns({
  columns,
  context,
  result,
  supabase,
  table,
}: {
  columns: readonly string[];
  context: string;
  result: AirportDailySchemaValidationResult;
  supabase: SupabaseAdminClient;
  table: string;
}) {
  for (const column of columns) {
    const { error } = await supabase.from(table).select(column).limit(0);
    if (!error) continue;

    if ((error as { code?: string }).code === "42P01") {
      result.missingTables.push(table);
      console.error("AIRPORT DAILY SCHEMA VALIDATION TABLE MISSING", {
        context,
        error,
        table,
      });
      return;
    }

    if (isAirportDailyMissingSchemaError(error)) {
      result.missingColumns[table] = result.missingColumns[table] ?? [];
      result.missingColumns[table].push(column);
      console.error("AIRPORT DAILY SCHEMA VALIDATION COLUMN MISSING", {
        column,
        context,
        error,
        table,
      });
      continue;
    }

    console.warn("AIRPORT DAILY SCHEMA VALIDATION COLUMN CHECK WARNING", {
      column,
      context,
      error,
      table,
    });
  }
}
