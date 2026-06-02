import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type FeedbackType = "positive" | "negative";

type FeedbackRequest = {
  assessmentId: string;
  userKey: string;
  feedbackType: FeedbackType;
  feedbackText: string;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as unknown;
  const input = normalizeFeedbackRequest(payload);

  if (!input) {
    return NextResponse.json(
      { error: "Assessment feedback is incomplete." },
      { status: 400 },
    );
  }

  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    console.error("Assessment feedback Supabase initialization failed", error);
    return NextResponse.json(
      { error: "Feedback could not be saved." },
      { status: 500 },
    );
  }

  const { data: assessment, error: assessmentError } = await supabase
    .from("assessments")
    .select("id, user_key")
    .eq("id", input.assessmentId)
    .eq("user_key", input.userKey)
    .maybeSingle();

  if (assessmentError) {
    console.error("Assessment feedback ownership lookup failed", assessmentError);
    return NextResponse.json(
      { error: "Feedback could not be saved." },
      { status: 500 },
    );
  }

  if (!assessment) {
    return NextResponse.json(
      { error: "Assessment was not found." },
      { status: 404 },
    );
  }

  const { data: existingFeedback, error: existingError } = await supabase
    .from("assessment_feedback")
    .select("id, created_at")
    .eq("assessment_id", input.assessmentId)
    .maybeSingle();

  if (existingError) {
    console.error("Assessment feedback duplicate lookup failed", existingError);
    return NextResponse.json(
      { error: "Feedback could not be saved." },
      { status: 500 },
    );
  }

  if (existingFeedback) {
    return NextResponse.json({
      success: true,
      duplicate: true,
      message: "Feedback already submitted.",
      feedbackId: existingFeedback.id,
    });
  }

  const { data, error } = await supabase
    .from("assessment_feedback")
    .insert({
      assessment_id: input.assessmentId,
      user_key: input.userKey,
      feedback_type: input.feedbackType,
      feedback_text: input.feedbackText || null,
    })
    .select("id, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: "Feedback already submitted.",
      });
    }

    console.error("Assessment feedback insert failed", error);
    return NextResponse.json(
      { error: "Feedback could not be saved." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    duplicate: false,
    message: "Thank you for your feedback.",
    feedbackId: data.id,
    createdAt: data.created_at,
  });
}

function normalizeFeedbackRequest(value: unknown): FeedbackRequest | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const assessmentId = getString(record.assessmentId);
  const userKey = getString(record.userKey);
  const feedbackType = getFeedbackType(record.feedbackType);
  const feedbackText = getString(record.feedbackText).slice(0, 2000);

  if (!assessmentId || !userKey || !feedbackType) return null;
  if (feedbackType === "negative" && !feedbackText) return null;

  return {
    assessmentId,
    userKey,
    feedbackType,
    feedbackText,
  };
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFeedbackType(value: unknown): FeedbackType | null {
  return value === "positive" || value === "negative" ? value : null;
}
