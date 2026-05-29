export type ProfileIntelligenceAssessment = {
  userKey: string;
  extractionStatus?: {
    message: string;
    warning?: string;
  };
  diagnostics?: {
    fileName: string;
    fileSize: number;
    pageCount: number;
    characterCount: number;
    first1000Characters: string;
  };
  totalScore: number;
  assessmentConfidence: "HIGH";
  confidenceReason: string;
  corePositioning: string;
  profileClarity: {
    externalReaderView: string;
    professionalImage: string;
    positioningClarity: string;
    positioningFocus: string;
  };
  topCompetencies: string[];
  keyExpertiseDomains: string[];
  authorityGrowthAreas: string[];
  profileImprovementRecommendations: {
    currentHeadline: string;
    suggestedHeadline: string;
    currentPositioning: string;
    recommendedPositioning: string;
    headlineImprovements: string[];
    aboutSectionImprovements: string[];
    positioningImprovements: string[];
    missingAuthoritySignals: string[];
    missingKeywords: string[];
    missingIndustryThemes: string[];
  };
  visibilityGaps: string[];
  positiveHighlights: string[];
  shareText: string;
};

export function normalizeProfileAssessment(
  assessment: ProfileIntelligenceAssessment,
  userKey: string,
  metadata?: Pick<ProfileIntelligenceAssessment, "diagnostics" | "extractionStatus">,
): ProfileIntelligenceAssessment {
  const normalized: ProfileIntelligenceAssessment = {
    userKey,
    extractionStatus: metadata?.extractionStatus,
    diagnostics: metadata?.diagnostics,
    totalScore: clampScore(assessment.totalScore),
    assessmentConfidence: "HIGH",
    confidenceReason: "Based on comprehensive LinkedIn Profile PDF analysis.",
    corePositioning: cleanText(assessment.corePositioning, "Professional authority profile"),
    profileClarity: {
      externalReaderView: cleanText(
        assessment.profileClarity?.externalReaderView,
        "The profile communicates a credible professional background with room to sharpen the authority narrative.",
      ),
      professionalImage: cleanText(
        assessment.profileClarity?.professionalImage,
        "A professional with relevant experience and visible market expertise.",
      ),
      positioningClarity: cleanText(
        assessment.profileClarity?.positioningClarity,
        "The positioning is understandable, with opportunities to make the niche clearer.",
      ),
      positioningFocus: cleanText(
        assessment.profileClarity?.positioningFocus,
        "The profile can benefit from a more focused authority lane.",
      ),
    },
    topCompetencies: normalizeList(assessment.topCompetencies).slice(0, 5),
    keyExpertiseDomains: normalizeList(assessment.keyExpertiseDomains).slice(0, 5),
    authorityGrowthAreas: uniqueWithoutOverlap(
      normalizeList(assessment.authorityGrowthAreas),
      normalizeList(assessment.keyExpertiseDomains),
    ).slice(0, 5),
    profileImprovementRecommendations: {
      currentHeadline: cleanText(
        assessment.profileImprovementRecommendations?.currentHeadline,
        "Not clearly extracted from the PDF.",
      ),
      suggestedHeadline: cleanText(
        assessment.profileImprovementRecommendations?.suggestedHeadline,
        "Clarify your primary expertise, audience, and authority theme.",
      ),
      currentPositioning: cleanText(
        assessment.profileImprovementRecommendations?.currentPositioning,
        "The current positioning shows experience but can communicate authority more directly.",
      ),
      recommendedPositioning: cleanText(
        assessment.profileImprovementRecommendations?.recommendedPositioning,
        "Position the profile around a specific market, expertise domain, and business outcome.",
      ),
      headlineImprovements: normalizeList(
        assessment.profileImprovementRecommendations?.headlineImprovements,
      ).slice(0, 4),
      aboutSectionImprovements: normalizeList(
        assessment.profileImprovementRecommendations?.aboutSectionImprovements,
      ).slice(0, 4),
      positioningImprovements: normalizeList(
        assessment.profileImprovementRecommendations?.positioningImprovements,
      ).slice(0, 4),
      missingAuthoritySignals: normalizeList(
        assessment.profileImprovementRecommendations?.missingAuthoritySignals,
      ).slice(0, 4),
      missingKeywords: normalizeList(
        assessment.profileImprovementRecommendations?.missingKeywords,
      ).slice(0, 6),
      missingIndustryThemes: normalizeList(
        assessment.profileImprovementRecommendations?.missingIndustryThemes,
      ).slice(0, 6),
    },
    visibilityGaps: normalizeList(assessment.visibilityGaps).slice(0, 6),
    positiveHighlights: normalizeList(assessment.positiveHighlights).slice(0, 4),
    shareText: "",
  };

  if (normalized.topCompetencies.length === 0) {
    normalized.topCompetencies = ["Professional Expertise"];
  }
  if (normalized.keyExpertiseDomains.length === 0) {
    normalized.keyExpertiseDomains = [normalized.corePositioning];
  }
  if (normalized.authorityGrowthAreas.length === 0) {
    normalized.authorityGrowthAreas = [
      "Industry Thought Leadership",
      "Executive Visibility",
      "Market Education",
    ];
  }
  if (normalized.positiveHighlights.length === 0) {
    normalized.positiveHighlights = [
      "Clear professional credibility",
      "Strong authority-building potential",
      "Relevant expertise for LinkedIn visibility",
    ];
  }

  normalized.shareText = createProfileShareText(normalized);
  return normalized;
}

export function createProfileShareText(assessment: ProfileIntelligenceAssessment) {
  return [
    "I just checked my LinkedIn Authority Score using INConnect.",
    "",
    `My score: ${assessment.totalScore}/100`,
    "",
    "Core positioning:",
    assessment.corePositioning,
    "",
    "Key expertise areas:",
    ...assessment.keyExpertiseDomains.slice(0, 3).map((area) => `- ${area}`),
    "",
    "Positive highlights:",
    ...assessment.positiveHighlights.slice(0, 3).map((item) => `- ${item}`),
    "",
    "Check your own LinkedIn Profile Intelligence Assessment:",
    "https://in-connect.app",
    "",
    "#INConnect #LinkedIn #PersonalBranding #ProfessionalGrowth",
  ].join("\n");
}

export function getPositioningLevel(score: number) {
  if (score >= 88) return "Global Thought Leader Potential";
  if (score >= 76) return "Strategic Industry Expert";
  if (score >= 62) return "Industry Specialist";
  return "Emerging Specialist";
}

export function clampScore(score: number) {
  return Math.min(100, Math.max(0, Math.round(Number.isFinite(score) ? score : 0)));
}

function normalizeList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => cleanText(item, ""))
        .filter(Boolean)
    : [];
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0
    ? value.replace(/\s+/g, " ").trim()
    : fallback;
}

function uniqueWithoutOverlap(items: string[], comparisonItems: string[]) {
  const comparison = comparisonItems.map((item) => item.toLowerCase());
  const seen = new Set<string>();

  return items.filter((item) => {
    const normalized = item.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return !comparison.some((other) => normalized.includes(other) || other.includes(normalized));
  });
}
