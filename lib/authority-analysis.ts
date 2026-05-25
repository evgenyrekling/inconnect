import {
  createShareText,
  type AreaProfile,
  type DetectedArea,
  inferProfile,
  type TopicIdea,
  type TrendInsight,
} from "@/lib/mock-intelligence";

export type ScoreCategory =
  | "profileClarity"
  | "professionalPositioning"
  | "authoritySignals"
  | "contentPotential"
  | "networkRelevance"
  | "growthOpportunity";

export type ScoreCategoryResult = {
  score: number;
  explanation: string;
  improvementHint: string;
};

export type ScoreBreakdown = Record<ScoreCategory, ScoreCategoryResult>;

export type AuthorityAnalysisResponse = {
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  detectedProfessionalAreas: DetectedArea[];
  topStrengths: string[];
  visibilityPotential: string[];
  visibilityOpportunities: string[];
  trendAngles: TrendInsight[];
  personalizedTopicIdea: TopicIdea;
  shareText: string;
  analysisMode: "ai" | "demo_fallback";
};

const scoreWeights: Record<ScoreCategory, number> = {
  profileClarity: 0.2,
  professionalPositioning: 0.2,
  authoritySignals: 0.2,
  contentPotential: 0.15,
  networkRelevance: 0.15,
  growthOpportunity: 0.1,
};

export function calculateWeightedScore(scoreBreakdown: ScoreBreakdown) {
  return Math.round(
    Object.entries(scoreWeights).reduce((total, [category, weight]) => {
      return total + scoreBreakdown[category as ScoreCategory].score * weight;
    }, 0),
  );
}

export function createDemoFallbackAnalysis(linkedInUrl: string): AuthorityAnalysisResponse {
  const profile = inferProfile(linkedInUrl);
  const scoreBreakdown = createFallbackScoreBreakdown(profile.score);
  const totalScore = calculateWeightedScore(scoreBreakdown);
  const normalizedProfile = { ...profile, score: totalScore };

  return {
    totalScore,
    scoreBreakdown,
    detectedProfessionalAreas: profile.detectedAreas,
    topStrengths: profile.strengths,
    visibilityPotential: profile.authorityPotential,
    visibilityOpportunities: profile.opportunities,
    trendAngles: profile.trends,
    personalizedTopicIdea: profile.topic,
    shareText: createShareText(totalScore, profile.detectedAreas, normalizedProfile),
    analysisMode: "demo_fallback",
  };
}

export function analysisToProfile(analysis: AuthorityAnalysisResponse): AreaProfile {
  const primaryArea = analysis.detectedProfessionalAreas[0]?.name ?? "Technology";

  return {
    score: analysis.totalScore,
    primaryArea: primaryArea as AreaProfile["primaryArea"],
    detectedAreas: analysis.detectedProfessionalAreas,
    authorityPotential: analysis.visibilityPotential,
    strongAuthorityPotential: analysis.visibilityPotential.slice(0, 3),
    strengths: analysis.topStrengths,
    opportunities: analysis.visibilityOpportunities,
    trends: analysis.trendAngles,
    topic: analysis.personalizedTopicIdea,
  };
}

function createFallbackScoreBreakdown(baseScore: number): ScoreBreakdown {
  const bounded = clampScore(baseScore);

  return {
    profileClarity: {
      score: clampScore(bounded - 2),
      explanation: "The profile presents a recognizable professional direction.",
      improvementHint: "Make the headline and About section more specific to one authority lane.",
    },
    professionalPositioning: {
      score: clampScore(bounded + 1),
      explanation: "The positioning suggests a clear market or industry context.",
      improvementHint: "Connect expertise to measurable business or industry outcomes.",
    },
    authoritySignals: {
      score: clampScore(bounded - 4),
      explanation: "There are signals of credible professional experience.",
      improvementHint: "Add proof points, examples, and stronger evidence of impact.",
    },
    contentPotential: {
      score: clampScore(bounded + 3),
      explanation: "The profile has strong potential for useful LinkedIn content themes.",
      improvementHint: "Turn recurring work themes into repeatable insight-led posts.",
    },
    networkRelevance: {
      score: clampScore(bounded),
      explanation: "The expertise can map to relevant professional conversations.",
      improvementHint: "Name the audience, ecosystem, and decision-makers more directly.",
    },
    growthOpportunity: {
      score: clampScore(bounded + 5),
      explanation: "There is meaningful room to grow visibility with clearer thought leadership.",
      improvementHint: "Publish more consistently around a narrow set of authority themes.",
    },
  };
}

export function clampScore(score: number) {
  return Math.min(100, Math.max(0, Math.round(score)));
}
