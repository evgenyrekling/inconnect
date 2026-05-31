export type AuthorityScoreCategory =
  | "Positioning Clarity"
  | "Career Progression"
  | "Industry Specialization"
  | "Leadership Signals"
  | "Commercial Impact"
  | "Authority Potential";

export type AuthorityScoreBreakdownItem = {
  category: AuthorityScoreCategory;
  weight: number;
  score: number;
  explanation: string;
  improvementHint: string;
};

export type PositioningSnapshotItem = {
  label: string;
  percentage: number;
};

export type ProfileIntelligenceAssessment = {
  assessmentId?: string;
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
  profileSnapshot: {
    name: string;
    currentRole: string;
    currentCompany: string;
    location: string;
    estimatedYearsOfExperience: string;
    topSkills: string[];
    topIndustries: string[];
  };
  marketPosition: string;
  positioningSnapshot: PositioningSnapshotItem[];
  whatMakesYouUnique: string;
  totalScore: number;
  scoreLevel: string;
  scoreExplanation: string;
  scoreBreakdown: AuthorityScoreBreakdownItem[];
  positioningGap: {
    currentPosition: string;
    potentialPosition: string;
    gapExplanation: string;
  };
  assessmentConfidence: "HIGH" | "MEDIUM";
  confidenceReason: string;
  corePositioning: string;
  topCompetencies: string[];
  keyExpertiseDomains: string[];
  authorityGrowthAreas: string[];
  profileImprovementRecommendations: {
    headlineImprovement: string;
    aboutSectionImprovement: string;
    keywordsToAdd: string[];
    authoritySignalsToStrengthen: string[];
    missingProfessionalThemes: string[];
    suggestedPositioningAngle: string;
  };
  visibilityGaps: string[];
  positiveHighlights: string[];
  shareText: string;
};

const SCORE_FRAMEWORK: Array<{
  category: AuthorityScoreCategory;
  weight: number;
}> = [
  { category: "Positioning Clarity", weight: 20 },
  { category: "Career Progression", weight: 15 },
  { category: "Industry Specialization", weight: 20 },
  { category: "Leadership Signals", weight: 15 },
  { category: "Commercial Impact", weight: 15 },
  { category: "Authority Potential", weight: 15 },
];

export function normalizeProfileAssessment(
  assessment: ProfileIntelligenceAssessment,
  userKey: string,
  metadata?: Pick<ProfileIntelligenceAssessment, "diagnostics" | "extractionStatus" | "assessmentId">,
): ProfileIntelligenceAssessment {
  const scoreBreakdown = normalizeScoreBreakdown(assessment.scoreBreakdown);
  const rawTotalScore =
    scoreBreakdown.length > 0
      ? calculateWeightedScore(scoreBreakdown)
      : clampScore(assessment.totalScore);
  const totalScore = calibrateAuthorityScore(rawTotalScore, assessment);

  const normalized: ProfileIntelligenceAssessment = {
    assessmentId: metadata?.assessmentId,
    userKey,
    extractionStatus: metadata?.extractionStatus,
    diagnostics: metadata?.diagnostics,
    profileSnapshot: {
      name: cleanText(assessment.profileSnapshot?.name, "Not clearly extracted"),
      currentRole: cleanText(assessment.profileSnapshot?.currentRole, "Not clearly extracted"),
      currentCompany: cleanText(
        assessment.profileSnapshot?.currentCompany,
        "Not clearly extracted",
      ),
      location: cleanText(assessment.profileSnapshot?.location, "Not clearly extracted"),
      estimatedYearsOfExperience: cleanText(
        assessment.profileSnapshot?.estimatedYearsOfExperience,
        "Not clearly estimated",
      ),
      topSkills: normalizeList(assessment.profileSnapshot?.topSkills).slice(0, 5),
      topIndustries: normalizeList(assessment.profileSnapshot?.topIndustries).slice(0, 3),
    },
    marketPosition: cleanText(
      assessment.marketPosition,
      "Professional with visible expertise and room to sharpen market authority.",
    ),
    positioningSnapshot: normalizePositioningSnapshot(assessment.positioningSnapshot),
    whatMakesYouUnique: cleanText(
      assessment.whatMakesYouUnique,
      "The profile combines professional experience, domain knowledge, and authority-building potential.",
    ),
    totalScore,
    scoreLevel: getAuthorityScoreLevel(totalScore),
    scoreExplanation: cleanText(
      assessment.scoreExplanation,
      getAuthorityScoreExplanation(totalScore),
    ),
    scoreBreakdown,
    positioningGap: {
      currentPosition: cleanText(
        assessment.positioningGap?.currentPosition,
        "Experienced professional",
      ),
      potentialPosition: cleanText(
        assessment.positioningGap?.potentialPosition,
        "Recognized authority in a focused professional niche",
      ),
      gapExplanation: cleanText(
        assessment.positioningGap?.gapExplanation,
        "The profile shows relevant expertise and can communicate market influence more directly.",
      ),
    },
    assessmentConfidence: assessment.assessmentConfidence === "MEDIUM" ? "MEDIUM" : "HIGH",
    confidenceReason: cleanText(
      assessment.confidenceReason,
      "Based on comprehensive LinkedIn Profile PDF analysis.",
    ),
    corePositioning: cleanText(assessment.corePositioning, "Professional authority profile"),
    topCompetencies: normalizeList(assessment.topCompetencies).slice(0, 5),
    keyExpertiseDomains: normalizeList(assessment.keyExpertiseDomains).slice(0, 5),
    authorityGrowthAreas: uniqueWithoutOverlap(
      normalizeList(assessment.authorityGrowthAreas),
      normalizeList(assessment.keyExpertiseDomains),
    ).slice(0, 5),
    profileImprovementRecommendations: {
      headlineImprovement: cleanText(
        assessment.profileImprovementRecommendations?.headlineImprovement,
        "Use the headline to communicate your niche, audience, and market outcome more clearly.",
      ),
      aboutSectionImprovement: cleanText(
        assessment.profileImprovementRecommendations?.aboutSectionImprovement,
        "Use the About section to connect expertise, proof, and professional point of view.",
      ),
      keywordsToAdd: normalizeList(
        assessment.profileImprovementRecommendations?.keywordsToAdd,
      ).slice(0, 8),
      authoritySignalsToStrengthen: normalizeList(
        assessment.profileImprovementRecommendations?.authoritySignalsToStrengthen,
      ).slice(0, 5),
      missingProfessionalThemes: normalizeList(
        assessment.profileImprovementRecommendations?.missingProfessionalThemes,
      ).slice(0, 5),
      suggestedPositioningAngle: cleanText(
        assessment.profileImprovementRecommendations?.suggestedPositioningAngle,
        "Position around a specific expertise domain, business impact, and market conversation.",
      ),
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
  if (normalized.profileSnapshot.topSkills.length === 0) {
    normalized.profileSnapshot.topSkills = normalized.topCompetencies.slice(0, 5);
  }
  if (normalized.profileSnapshot.topIndustries.length === 0) {
    normalized.profileSnapshot.topIndustries = normalized.keyExpertiseDomains.slice(0, 3);
  }
  if (normalized.positioningSnapshot.length === 0) {
    normalized.positioningSnapshot = normalized.keyExpertiseDomains
      .slice(0, 5)
      .map((label, index) => ({
        label,
        percentage: [40, 25, 15, 12, 8][index] ?? 5,
      }));
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
  if (normalized.profileImprovementRecommendations.keywordsToAdd.length === 0) {
    normalized.profileImprovementRecommendations.keywordsToAdd =
      normalized.keyExpertiseDomains.slice(0, 5);
  }
  if (normalized.profileImprovementRecommendations.authoritySignalsToStrengthen.length === 0) {
    normalized.profileImprovementRecommendations.authoritySignalsToStrengthen = [
      "Thought leadership proof",
      "Commercial impact examples",
      "Industry-specific point of view",
    ];
  }
  if (normalized.profileImprovementRecommendations.missingProfessionalThemes.length === 0) {
    normalized.profileImprovementRecommendations.missingProfessionalThemes =
      normalized.authorityGrowthAreas.slice(0, 4);
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
    "Market position:",
    assessment.marketPosition,
    "",
    "Key expertise areas:",
    ...assessment.keyExpertiseDomains.slice(0, 3).map((area) => `- ${area}`),
    "",
    "Top authority areas:",
    ...assessment.authorityGrowthAreas.slice(0, 3).map((area) => `- ${area}`),
    "",
    "Check your own LinkedIn Profile Intelligence Assessment:",
    "https://in-connect.app",
    "",
    "#INConnect #LinkedIn #PersonalBranding #ProfessionalGrowth",
  ].join("\n");
}

export function getPositioningLevel(score: number) {
  return getAuthorityScoreLevel(score);
}

export function getAuthorityScoreLevel(score: number) {
  if (score >= 95) return "Exceptional Global Authority";
  if (score >= 85) return "Established Thought Leader";
  if (score >= 75) return "Recognized Industry Authority";
  if (score >= 60) return "Strong Industry Professional";
  if (score >= 40) return "Experienced Specialist";
  if (score >= 20) return "Early Career Professional";
  return "Incomplete Profile";
}

export function getAuthorityScoreExplanation(score: number) {
  if (score >= 95) {
    return "Exceptional global authority signals across specialization, leadership, commercial impact, and international market relevance.";
  }
  if (score >= 85) {
    return "Established thought leadership potential supported by deep expertise, senior responsibility, and strong market authority signals.";
  }
  if (score >= 75) {
    return "Recognized industry authority potential with strong specialization, career proof, and credible leadership or commercial impact.";
  }
  if (score >= 60) {
    return "Strong industry professional profile with clear expertise and meaningful authority-building potential.";
  }
  if (score >= 40) {
    return "Experienced specialist profile with relevant expertise that can be positioned more clearly for authority.";
  }
  if (score >= 20) {
    return "Early career or lightly evidenced professional profile with room to build stronger authority signals.";
  }
  return "Incomplete profile data or limited readable evidence available for authority assessment.";
}

export function clampScore(score: number) {
  return Math.min(100, Math.max(0, Math.round(Number.isFinite(score) ? score : 0)));
}

function normalizeScoreBreakdown(value: unknown) {
  const source = Array.isArray(value) ? value : [];

  return SCORE_FRAMEWORK.map(({ category, weight }) => {
    const match = source.find(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "category" in item &&
        String(item.category).toLowerCase() === category.toLowerCase(),
    ) as Partial<AuthorityScoreBreakdownItem> | undefined;

    return {
      category,
      weight,
      score: clampScore(Number(match?.score ?? 0)),
      explanation: cleanText(
        match?.explanation,
        `${category} has visible evidence and can be strengthened with clearer proof.`,
      ),
      improvementHint: cleanText(
        match?.improvementHint,
        "Make this signal more explicit in the headline, About section, and experience descriptions.",
      ),
    };
  });
}

function calculateWeightedScore(items: AuthorityScoreBreakdownItem[]) {
  const weightedTotal = items.reduce(
    (total, item) => total + clampScore(item.score) * (item.weight / 100),
    0,
  );
  return clampScore(weightedTotal);
}

function calibrateAuthorityScore(score: number, assessment: ProfileIntelligenceAssessment) {
  const evidence = [
    assessment.profileSnapshot?.estimatedYearsOfExperience,
    assessment.profileSnapshot?.currentRole,
    assessment.profileSnapshot?.currentCompany,
    assessment.marketPosition,
    assessment.whatMakesYouUnique,
    assessment.corePositioning,
    ...(assessment.topCompetencies ?? []),
    ...(assessment.keyExpertiseDomains ?? []),
    ...(assessment.authorityGrowthAreas ?? []),
    ...(assessment.positiveHighlights ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const hasSeniorExperience =
    /20\+|20\s*\+|2[0-9]\s*(years|yrs)|3[0-9]\s*(years|yrs)|two decades|decades/.test(
      evidence,
    );
  const hasLeadershipScope =
    /\b(global|international|regional|worldwide|emea|apac|americas|director|head of|lead|leader|leadership|executive|vp|vice president|chief|manager)\b/.test(
      evidence,
    );
  const hasSpecializationDepth =
    /\b(specialist|expert|authority|specialization|deep domain|industrial|automation|infrastructure|mobility|sensing|lidar|robotics|ai|certified|certification)\b/.test(
      evidence,
    );
  const hasCommercialImpact =
    /\b(commercial|revenue|sales|business development|market expansion|growth|partnership|strategy|strategic|enterprise|customer|portfolio)\b/.test(
      evidence,
    );

  if (hasSeniorExperience && hasLeadershipScope && hasSpecializationDepth && hasCommercialImpact) {
    return Math.max(score, 75);
  }
  if (hasSeniorExperience && hasSpecializationDepth && (hasLeadershipScope || hasCommercialImpact)) {
    return Math.max(score, 68);
  }
  if (hasSeniorExperience && hasSpecializationDepth) {
    return Math.max(score, 60);
  }
  return score;
}

function normalizePositioningSnapshot(value: unknown) {
  const items = Array.isArray(value) ? value : [];
  return items
    .filter(
      (item): item is PositioningSnapshotItem =>
        typeof item === "object" &&
        item !== null &&
        "label" in item &&
        "percentage" in item,
    )
    .map((item) => ({
      label: cleanText(item.label, ""),
      percentage: Math.min(100, Math.max(0, Math.round(Number(item.percentage) || 0))),
    }))
    .filter((item) => item.label && item.percentage > 0)
    .slice(0, 5);
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
