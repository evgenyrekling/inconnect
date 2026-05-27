import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import {
  normalizeAuthorityAnalysis,
  type AuthorityAnalysisResponse,
} from "@/lib/authority-analysis";

type AnalyzeProfileRequest = {
  linkedinUrl?: string;
  email?: string;
  headline?: string;
  about?: string;
  postsText?: string;
};

const missingProfileTextMessage =
  "Please paste LinkedIn About section or recent content for AI analysis.";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "totalScore",
    "primaryIndustry",
    "topExpertiseAreas",
    "strengths",
    "weaknesses",
    "contentOpportunities",
    "authoritySummary",
    "improvementActions",
    "trendPositioning",
    "shareText",
  ],
  properties: {
    totalScore: { type: "number" },
    primaryIndustry: { type: "string" },
    topExpertiseAreas: {
      type: "array",
      items: { type: "string" },
    },
    strengths: {
      type: "array",
      items: { type: "string" },
    },
    weaknesses: {
      type: "array",
      items: { type: "string" },
    },
    contentOpportunities: {
      type: "array",
      items: { type: "string" },
    },
    authoritySummary: { type: "string" },
    improvementActions: {
      type: "array",
      items: { type: "string" },
    },
    trendPositioning: {
      type: "array",
      items: { type: "string" },
    },
    shareText: { type: "string" },
  },
} as const;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as AnalyzeProfileRequest | null;
  const linkedinUrl = body?.linkedinUrl?.trim() ?? "";
  const email = body?.email?.trim() ?? "";
  const headline = body?.headline?.trim() ?? "";
  const about = body?.about?.trim() ?? "";
  const postsText = body?.postsText?.trim() ?? "";

  if (!linkedinUrl || !email) {
    return NextResponse.json(
      { error: "LinkedIn profile URL and email are required." },
      { status: 400 },
    );
  }

  if (!headline || !about) {
    return NextResponse.json({ error: missingProfileTextMessage }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  try {
    const analysis = await analyzeProfileWithOpenAI({
      linkedinUrl,
      email,
      headline,
      about,
      postsText,
    });

    // Supabase storage will be added here later. Use email + LinkedIn URL as the
    // unique user identifier and persist the normalized authority analysis.

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("OpenAI profile analysis failed", error);
    return NextResponse.json(
      { error: "AI analysis could not be completed. Please try again." },
      { status: 502 },
    );
  }
}

async function analyzeProfileWithOpenAI({
  linkedinUrl,
  email,
  headline,
  about,
  postsText,
}: {
  linkedinUrl: string;
  email: string;
  headline: string;
  about: string;
  postsText: string;
}): Promise<AuthorityAnalysisResponse> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.parse({
    model: process.env.OPENAI_MODEL ?? "gpt-5.5",
    input: [
      {
        role: "system",
        content: [
          "You are INConnect's LinkedIn Authority Scoring Engine.",
          "Analyze only the user-provided LinkedIn headline, About section, and recent posts.",
          "Do not scrape LinkedIn, call LinkedIn APIs, infer hidden profile data, or claim access to unavailable context.",
          "Score conservatively and evidence-first. A generic profile should score lower than a specialized expert profile.",
          "The score must be based on the rubric, not randomly assigned.",
          "Write in a professional, executive, LinkedIn-native SaaS tone.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Return strict JSON for an INConnect LinkedIn Authority Assessment.",
          "",
          "User identifiers:",
          `LinkedIn URL: ${linkedinUrl}`,
          `Email: ${email}`,
          "",
          "Analyze these 10 authority dimensions:",
          "1. Professional clarity",
          "2. Industry positioning",
          "3. Authority potential",
          "4. Thought leadership potential",
          "5. Market relevance",
          "6. Content opportunity",
          "7. Trend alignment",
          "8. Niche strength",
          "9. Expertise differentiation",
          "10. Visibility potential",
          "",
          "Scoring logic:",
          "- Reward specialization clarity, niche uniqueness, strategic positioning, industry focus, leadership language, technical depth, future relevance, market alignment, communication quality, and content scalability.",
          "- Penalize broad generic descriptions, weak audience definition, vague claims, unclear industry focus, missing proof points, and low content direction.",
          "- A generic sales profile should score lower.",
          "- A highly specialized airport automation expert with strategic language, technical depth, and market relevance should score higher.",
          "- Use the full 0-100 range when justified, but avoid inflated scores without evidence.",
          "",
          "Required output guidance:",
          "- totalScore: realistic 0-100 authority score.",
          "- primaryIndustry: the clearest industry or professional category.",
          "- topExpertiseAreas: 3-5 concise areas.",
          "- strengths: 3-4 specific strengths grounded in the provided text.",
          "- weaknesses: 3-4 constructive underdeveloped visibility areas.",
          "- contentOpportunities: 4-5 authority topic ideas or content lanes.",
          "- authoritySummary: 2-3 sentence reasoning for the score.",
          "- improvementActions: 4-5 practical actions to improve authority.",
          "- trendPositioning: 3-5 future-facing positioning angles connected to market trends.",
          "- shareText: include the exact first sentence: I just checked my LinkedIn Authority Score using INConnect.",
          "",
          "Use the fields separately:",
          "- Headline: evaluate positioning clarity, specialization, and audience signal.",
          "- About section: evaluate expertise depth, authority signals, proof points, and positioning clarity.",
          "- Recent posts: evaluate content consistency, thought leadership potential, market relevance, trend alignment, and content scalability. If posts are sparse, lower confidence in content consistency.",
          "",
          "LinkedIn headline:",
          headline.slice(0, 1000),
          "",
          "LinkedIn About section:",
          about.slice(0, 7000),
          "",
          "Recent LinkedIn posts:",
          postsText ? postsText.slice(0, 9000) : "No recent posts provided.",
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "inconnect_authority_analysis",
        strict: true,
        schema: responseSchema,
      },
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI response did not include parsed JSON.");
  }

  return normalizeAuthorityAnalysis(
    response.output_parsed as AuthorityAnalysisResponse,
  );
}
