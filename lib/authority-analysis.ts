import type {
  AreaProfile,
  DetectedArea,
  TopicIdea,
  TrendInsight,
} from "@/lib/mock-intelligence";

export type AuthorityAnalysisResponse = {
  totalScore: number;
  primaryIndustry: string;
  topExpertiseAreas: string[];
  strengths: string[];
  weaknesses: string[];
  contentOpportunities: string[];
  authoritySummary: string;
  improvementActions: string[];
  trendPositioning: string[];
  shareText: string;
};

export function normalizeAuthorityAnalysis(
  analysis: AuthorityAnalysisResponse,
): AuthorityAnalysisResponse {
  const totalScore = clampScore(analysis.totalScore);
  const normalized: AuthorityAnalysisResponse = {
    totalScore,
    primaryIndustry: normalizeText(analysis.primaryIndustry, "Professional Growth"),
    topExpertiseAreas: normalizeList(analysis.topExpertiseAreas).slice(0, 5),
    strengths: normalizeList(analysis.strengths).slice(0, 4),
    weaknesses: normalizeList(analysis.weaknesses).slice(0, 4),
    contentOpportunities: normalizeList(analysis.contentOpportunities).slice(0, 5),
    authoritySummary: normalizeText(
      analysis.authoritySummary,
      "Your LinkedIn positioning shows professional authority potential, with clearer specialization and content direction creating the strongest next step.",
    ),
    improvementActions: normalizeList(analysis.improvementActions).slice(0, 5),
    trendPositioning: normalizeList(analysis.trendPositioning).slice(0, 5),
    shareText: normalizeText(analysis.shareText, ""),
  };

  if (normalized.topExpertiseAreas.length === 0) {
    normalized.topExpertiseAreas = [normalized.primaryIndustry];
  }

  normalized.shareText = createShareTextForAnalysis(normalized);

  return normalized;
}

export function analysisToDetectedAreas(
  analysis: AuthorityAnalysisResponse,
): DetectedArea[] {
  return analysis.topExpertiseAreas.slice(0, 5).map((name, index) => ({
    id: slugify(name) || `expertise-${index + 1}`,
    name,
    confidence: Math.max(72, 94 - index * 5),
  }));
}

export function analysisToProfile(analysis: AuthorityAnalysisResponse): AreaProfile {
  const detectedAreas = analysisToDetectedAreas(analysis);

  return {
    score: analysis.totalScore,
    primaryArea: analysis.primaryIndustry as AreaProfile["primaryArea"],
    detectedAreas,
    authorityPotential: analysis.topExpertiseAreas.slice(0, 3),
    strongAuthorityPotential: analysis.topExpertiseAreas.slice(0, 3),
    strengths: analysis.strengths,
    opportunities: analysis.weaknesses,
    trends: analysis.trendPositioning.map(toTrendInsight),
    topic: toTopicIdea(analysis),
  };
}

export function createShareTextForAnalysis(analysis: AuthorityAnalysisResponse) {
  return [
    "I just checked my LinkedIn Authority Score using INConnect.",
    "",
    `My score: ${analysis.totalScore}/100`,
    "",
    "Primary professional area:",
    analysis.primaryIndustry,
    "",
    "My strongest professional positioning areas:",
    ...analysis.topExpertiseAreas.slice(0, 3).map((area) => `• ${area}`),
    "",
    "Authority potential:",
    ...analysis.topExpertiseAreas.slice(0, 3).map((area) => `• ${area}`),
    "",
    createPositiveShareSummary(analysis),
    "",
    "Check your own LinkedIn Authority Score:",
    "https://in-connect.app",
    "",
    "#INConnect #LinkedIn #PersonalBranding #ProfessionalGrowth",
  ].join("\n");
}

function createPositiveShareSummary(analysis: AuthorityAnalysisResponse) {
  const leadingArea = analysis.topExpertiseAreas[0] ?? analysis.primaryIndustry;

  return `INConnect describes my profile as having strong professional expertise and clear positioning around ${analysis.primaryIndustry}, with authority potential in ${leadingArea}.`;
}

export function clampScore(score: number) {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function toTrendInsight(item: string, index: number): TrendInsight {
  const [title, ...summaryParts] = item.split(":");

  return {
    title: normalizeText(title, `Positioning angle ${index + 1}`),
    momentum:
      index === 0
        ? "Executive priority"
        : index === 1
          ? "High signal"
          : index === 2
            ? "Accelerating"
            : "Emerging",
    summary: normalizeText(
      summaryParts.join(":"),
      "A relevant market conversation that can strengthen professional authority when connected to specific expertise.",
    ),
  };
}

function toTopicIdea(analysis: AuthorityAnalysisResponse): TopicIdea {
  const firstOpportunity =
    analysis.contentOpportunities[0] ??
    `How ${analysis.primaryIndustry} professionals can build clearer authority`;

  return {
    title: firstOpportunity,
    hook:
      analysis.contentOpportunities[1] ??
      "The professionals who become easiest to trust are usually the clearest about the problems they understand.",
    whyNow:
      analysis.trendPositioning[0] ??
      "LinkedIn rewards useful, specific expertise more than broad professional updates.",
    cta:
      analysis.improvementActions[0] ??
      "What professional topic should more people in your industry be discussing?",
    hashtags: ["#LinkedIn", "#ProfessionalBranding", "#ThoughtLeadership", "#INConnect"],
  };
}

function normalizeList(value: string[]) {
  return Array.isArray(value)
    ? value.map((item) => item.trim()).filter((item) => item.length > 0)
    : [];
}

function normalizeText(value: string, fallback: string) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
