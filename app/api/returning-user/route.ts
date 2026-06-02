import { NextRequest, NextResponse } from "next/server";
import {
  hydrateStoredProfileAssessment,
  type ProfileIntelligenceAssessment,
} from "@/lib/authority-analysis";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentWeeklyUsagePeriod } from "@/lib/usage-period";

export const runtime = "nodejs";

const HISTORY_LIMIT = 5;

type AssessmentRow = {
  id: string;
  created_at: string;
  authority_score: number | null;
  ai_response: unknown;
};

type UserRow = {
  user_key: string;
  email: string;
  linkedin_url: string;
  plan_type: string | null;
  is_admin: boolean | null;
};

export async function GET(request: NextRequest) {
  const userKey = request.nextUrl.searchParams.get("userKey")?.trim();
  const assessmentId = request.nextUrl.searchParams.get("assessmentId")?.trim();

  if (!userKey) {
    return NextResponse.json(
      { error: "userKey is required.", hasPreviousAssessment: false },
      { status: 400 },
    );
  }

  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    console.error("Returning user Supabase client initialization failed", error);
    return NextResponse.json(
      { error: "Returning user lookup failed.", hasPreviousAssessment: false },
      { status: 500 },
    );
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("user_key, email, linkedin_url, plan_type, is_admin")
    .eq("user_key", userKey)
    .maybeSingle<UserRow>();

  if (userError) {
    console.error("Returning user lookup failed", userError);
    return NextResponse.json(
      { error: "Returning user lookup failed.", hasPreviousAssessment: false },
      { status: 500 },
    );
  }

  if (!user) {
    return NextResponse.json({ hasPreviousAssessment: false });
  }

  const { data: rows, error: historyError } = await supabase
    .from("assessments")
    .select("id, created_at, authority_score, ai_response")
    .eq("user_key", userKey)
    .not("ai_response", "is", null)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT)
    .returns<AssessmentRow[]>();

  if (historyError) {
    console.error("Returning user assessment history lookup failed", historyError);
    return NextResponse.json(
      { error: "Assessment history lookup failed.", hasPreviousAssessment: false },
      { status: 500 },
    );
  }

  const historyRows = rows ?? [];
  const latestRow = historyRows[0] ?? null;

  if (!latestRow) {
    return NextResponse.json({
      hasPreviousAssessment: false,
      user: createUserPayload(user),
    });
  }

  const selectedRow = assessmentId
    ? await getAssessmentById(supabase, userKey, assessmentId, historyRows)
    : latestRow;
  const latestAssessment = hydrateAssessmentRow(latestRow, userKey);
  const selectedAssessment = selectedRow
    ? hydrateAssessmentRow(selectedRow, userKey)
    : latestAssessment;
  const history = historyRows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    totalScore: getAssessmentScore(row),
  }));
  const trendScores = history
    .slice()
    .reverse()
    .map((entry) => entry.totalScore)
    .filter((score): score is number => typeof score === "number");
  const { periodStart, periodEnd } = getCurrentWeeklyUsagePeriod();
  const usageCount = await getUsageCount(supabase, userKey, periodStart, periodEnd);
  const planType = getPlanType(user);
  const usedThisWeek =
    usageCount >= 1 ||
    historyRows.some((row) => {
      const createdDate = row.created_at.slice(0, 10);
      return createdDate >= periodStart && createdDate <= periodEnd;
    });
  const canRunNewAssessment =
    planType === "admin" || planType === "pro" || !usedThisWeek;
  const nextFreeAssessmentDate = getNextFreeAssessmentDate(periodEnd);

  return NextResponse.json({
    hasPreviousAssessment: true,
    user: createUserPayload(user, planType, getAssessmentDisplayName(latestAssessment)),
    latestAssessment,
    selectedAssessment,
    latestAssessmentId: latestRow.id,
    latestAssessmentDate: latestRow.created_at,
    history,
    authorityTrend: {
      scores: trendScores,
      delta:
        trendScores.length >= 2
          ? trendScores[trendScores.length - 1] - trendScores[0]
          : 0,
      message: createTrendMessage(trendScores),
    },
    canRunNewAssessment,
    nextFreeAssessmentDate,
  });
}

async function getAssessmentById(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userKey: string,
  assessmentId: string,
  historyRows: AssessmentRow[],
) {
  const cachedRow = historyRows.find((row) => row.id === assessmentId);
  if (cachedRow) return cachedRow;

  const { data, error } = await supabase
    .from("assessments")
    .select("id, created_at, authority_score, ai_response")
    .eq("user_key", userKey)
    .eq("id", assessmentId)
    .not("ai_response", "is", null)
    .maybeSingle<AssessmentRow>();

  if (error) {
    console.error("Returning user assessment lookup by id failed", error);
    return null;
  }

  return data;
}

async function getUsageCount(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userKey: string,
  periodStart: string,
  periodEnd: string,
) {
  const { data, error } = await supabase
    .from("usage_limits")
    .select("assessment_count")
    .eq("user_key", userKey)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  if (error) {
    console.error("Returning user usage lookup failed", error);
    return 0;
  }

  return Number(data?.assessment_count ?? 0);
}

function hydrateAssessmentRow(row: AssessmentRow, userKey: string) {
  return hydrateStoredProfileAssessment({
    ...(row.ai_response as ProfileIntelligenceAssessment),
    assessmentId: row.id,
    assessmentDate: row.created_at,
    userKey,
  });
}

function getAssessmentScore(row: AssessmentRow) {
  if (typeof row.authority_score === "number") return row.authority_score;
  if (
    row.ai_response &&
    typeof row.ai_response === "object" &&
    "totalScore" in row.ai_response &&
    typeof row.ai_response.totalScore === "number"
  ) {
    return row.ai_response.totalScore;
  }
  return null;
}

function createUserPayload(user: UserRow, planType = getPlanType(user), name = "") {
  return {
    userKey: user.user_key,
    name,
    email: user.email,
    linkedinUrl: user.linkedin_url,
    planType,
    isAdmin: planType === "admin",
  };
}

function getAssessmentDisplayName(assessment: ProfileIntelligenceAssessment) {
  const name = assessment.profileSnapshot?.name?.trim() ?? "";
  return name && !/^not clearly/i.test(name) ? name : "";
}

function getPlanType(user: UserRow) {
  const isAdmin =
    Boolean(user.is_admin) || getAdminEmails().includes(normalizeEmail(user.email));
  if (isAdmin) return "admin";
  return user.plan_type === "pro" ? "pro" : "free";
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function createTrendMessage(scores: number[]) {
  if (scores.length < 2) {
    return "Your authority trend will appear after your next assessment.";
  }

  const delta = scores[scores.length - 1] - scores[0];
  const count = scores.length;

  if (delta > 0) {
    return `Your authority score increased by ${delta} points over the last ${count} assessments.`;
  }
  if (delta < 0) {
    return `Your authority score decreased by ${Math.abs(delta)} points over the last ${count} assessments.`;
  }
  return `Your authority score stayed steady over the last ${count} assessments.`;
}

function getNextFreeAssessmentDate(periodEnd: string) {
  const nextDate = new Date(`${periodEnd}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString().slice(0, 10);
}
