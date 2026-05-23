export type ProfessionalArea =
  | "Industrial Automation"
  | "Hospitality & Hotels"
  | "Logistics & Supply Chain"
  | "Robotics"
  | "Smart Mobility"
  | "Manufacturing"
  | "Technology"
  | "SaaS"
  | "Consulting"
  | "Finance"
  | "Healthcare"
  | "Education"
  | "Real Estate"
  | "Marketing"
  | "Sales"
  | "HR & Recruiting"
  | "Legal"
  | "Construction"
  | "Energy"
  | "Tourism"
  | "Food & Beverage"
  | "Other Professional Area";

export type DetectedArea = {
  id: string;
  name: ProfessionalArea | string;
  confidence: number;
};

export type TopicIdea = {
  title: string;
  hook: string;
  whyNow: string;
  cta: string;
  hashtags: string[];
};

export type TrendInsight = {
  title: string;
  momentum: "Emerging" | "Accelerating" | "High signal" | "Executive priority";
  summary: string;
};

export type AreaProfile = {
  score: number;
  primaryArea: ProfessionalArea;
  detectedAreas: DetectedArea[];
  authorityPotential: string[];
  strongAuthorityPotential: string[];
  strengths: string[];
  opportunities: string[];
  trends: TrendInsight[];
  topic: TopicIdea;
};

export type MockUserRecord = {
  email: string;
  linkedInUrl: string;
  timestamp: string;
  planType: "free";
};

export const professionalAreas: ProfessionalArea[] = [
  "Industrial Automation",
  "Hospitality & Hotels",
  "Logistics & Supply Chain",
  "Robotics",
  "Smart Mobility",
  "Manufacturing",
  "Technology",
  "SaaS",
  "Consulting",
  "Finance",
  "Healthcare",
  "Education",
  "Real Estate",
  "Marketing",
  "Sales",
  "HR & Recruiting",
  "Legal",
  "Construction",
  "Energy",
  "Tourism",
  "Food & Beverage",
  "Other Professional Area",
];

const hospitalityProfile: AreaProfile = {
  score: 74,
  primaryArea: "Hospitality & Hotels",
  detectedAreas: [
    { id: "hospitality", name: "Hospitality & Hotels", confidence: 92 },
    { id: "customer-experience", name: "Customer Experience", confidence: 88 },
    { id: "tourism", name: "Tourism", confidence: 84 },
  ],
  authorityPotential: [
    "Customer experience insights",
    "Hospitality operations",
    "Guest journey discussions",
  ],
  strongAuthorityPotential: [
    "Customer Experience",
    "Hotel Operations",
    "Guest Experience",
  ],
  strengths: [
    "Clear professional specialization",
    "Strong industry relevance",
    "High thought leadership potential",
  ],
  opportunities: [
    "Your profile could communicate executive-level authority more clearly.",
    "Industry insights could be emphasized more than job responsibilities.",
    "Thought leadership consistency could improve visibility with hospitality decision-makers.",
  ],
  trends: [
    {
      title: "AI in guest experience",
      momentum: "Accelerating",
      summary:
        "Hotels are using AI to personalize service moments while keeping human hospitality visible.",
    },
    {
      title: "Personalized hotel services",
      momentum: "High signal",
      summary:
        "Guest expectations are moving from standard service tiers to contextual, preference-aware experiences.",
    },
    {
      title: "Sustainable hospitality operations",
      momentum: "Executive priority",
      summary:
        "Operational efficiency, energy use, and brand trust are converging in hospitality leadership conversations.",
    },
    {
      title: "Loyalty journey redesign",
      momentum: "Emerging",
      summary:
        "Professionals can stand out by explaining how loyalty becomes an experience system, not only a points program.",
    },
    {
      title: "Workforce experience",
      momentum: "Accelerating",
      summary:
        "Guest outcomes increasingly depend on technology that reduces friction for frontline teams.",
    },
  ],
  topic: {
    title: "Why guest experience is becoming an operating system",
    hook:
      "The strongest hospitality brands are no longer competing only on rooms, rates, or amenities.",
    whyNow:
      "AI, staffing pressure, and rising guest expectations are forcing hotels to connect operations, personalization, and trust.",
    cta:
      "What is one guest journey moment your industry should redesign next?",
    hashtags: [
      "#Hospitality",
      "#CustomerExperience",
      "#Tourism",
      "#LinkedInAuthority",
    ],
  },
};

const industrialProfile: AreaProfile = {
  score: 78,
  primaryArea: "Industrial Automation",
  detectedAreas: [
    { id: "industrial-automation", name: "Industrial Automation", confidence: 92 },
    { id: "smart-mobility", name: "Smart Mobility", confidence: 88 },
    { id: "logistics", name: "Logistics & Supply Chain", confidence: 82 },
  ],
  authorityPotential: [
    "Airport automation",
    "Smart infrastructure",
    "Industrial AI discussions",
  ],
  strongAuthorityPotential: [
    "Airport Automation",
    "Smart Infrastructure",
    "Industrial AI",
  ],
  strengths: [
    "Strong technical authority",
    "Clear industrial specialization",
    "High thought leadership potential",
  ],
  opportunities: [
    "Your profile could make strategic business outcomes more visible alongside technical credibility.",
    "Industry insights could be framed for executives as well as specialist peers.",
    "A more consistent content rhythm could increase recognition across the industrial ecosystem.",
  ],
  trends: [
    {
      title: "Industrial AI + sensor fusion",
      momentum: "High signal",
      summary:
        "Operational teams are pairing AI with richer sensor context to improve decisions in complex environments.",
    },
    {
      title: "Smart infrastructure modernization",
      momentum: "Executive priority",
      summary:
        "Airports, logistics hubs, and plants are upgrading infrastructure without stopping live operations.",
    },
    {
      title: "Robotics in logistics",
      momentum: "Accelerating",
      summary:
        "Robotics adoption is moving from isolated pilots to workflow-level automation and resilience.",
    },
    {
      title: "Digital reliability operations",
      momentum: "Emerging",
      summary:
        "Reliability teams are turning field signals into earlier decisions and clearer maintenance priorities.",
    },
    {
      title: "Human-machine collaboration",
      momentum: "Accelerating",
      summary:
        "The strongest industrial transformations improve operator judgment rather than replacing it.",
    },
  ],
  topic: {
    title: "Why smart infrastructure needs more than automation",
    hook:
      "Automation alone does not make infrastructure intelligent. Context does.",
    whyNow:
      "Industrial operators are under pressure to modernize critical systems while improving reliability, safety, and uptime.",
    cta:
      "Where do you see the biggest gap between automation investment and operational intelligence?",
    hashtags: [
      "#IndustrialAutomation",
      "#SmartInfrastructure",
      "#IndustrialAI",
      "#LinkedInAuthority",
    ],
  },
};

const consultingProfile: AreaProfile = {
  score: 76,
  primaryArea: "Consulting",
  detectedAreas: [
    { id: "consulting", name: "Consulting", confidence: 90 },
    { id: "technology", name: "Technology", confidence: 86 },
    { id: "finance", name: "Finance", confidence: 78 },
  ],
  authorityPotential: [
    "Digital transformation strategy",
    "Executive decision-making",
    "Operating model modernization",
  ],
  strongAuthorityPotential: [
    "Transformation Strategy",
    "Executive Advisory",
    "Operating Models",
  ],
  strengths: [
    "Strong cross-functional perspective",
    "Clear relevance to executive transformation topics",
    "High credibility for strategic insight content",
  ],
  opportunities: [
    "Your profile could make the outcomes of your advisory work more concrete.",
    "Strategic insights could be organized into repeatable themes.",
    "Thought leadership could connect market change to practical executive decisions.",
  ],
  trends: [
    {
      title: "AI operating models",
      momentum: "Executive priority",
      summary:
        "Companies are moving beyond AI pilots toward governance, workflow redesign, and adoption discipline.",
    },
    {
      title: "Productivity transformation",
      momentum: "High signal",
      summary:
        "Leaders want clearer proof that technology investment changes how work actually gets done.",
    },
    {
      title: "Decision intelligence",
      momentum: "Accelerating",
      summary:
        "Executives are seeking faster, higher-quality decisions supported by better data and process clarity.",
    },
    {
      title: "Industry cloud strategy",
      momentum: "Emerging",
      summary:
        "Specialized cloud platforms are shaping how organizations modernize regulated and complex sectors.",
    },
    {
      title: "Change adoption systems",
      momentum: "High signal",
      summary:
        "Transformation credibility now depends on behavior change, not only delivery plans.",
    },
  ],
  topic: {
    title: "Why AI strategy fails without an operating model",
    hook:
      "The question is no longer whether a company has AI pilots. The question is whether AI changes how decisions get made.",
    whyNow:
      "Executives are under pressure to turn AI interest into durable operating advantage.",
    cta:
      "What operating model change do you think matters most before AI can scale?",
    hashtags: [
      "#Consulting",
      "#DigitalTransformation",
      "#AI",
      "#ProfessionalGrowth",
    ],
  },
};

const technologyProfile: AreaProfile = {
  score: 75,
  primaryArea: "Technology",
  detectedAreas: [
    { id: "technology", name: "Technology", confidence: 89 },
    { id: "saas", name: "SaaS", confidence: 84 },
    { id: "marketing", name: "Marketing", confidence: 78 },
  ],
  authorityPotential: [
    "Product strategy",
    "AI-enabled workflows",
    "Market education",
  ],
  strongAuthorityPotential: [
    "Product Strategy",
    "AI Workflows",
    "Market Education",
  ],
  strengths: [
    "Strong relevance to current technology conversations",
    "Clear potential for practical insight content",
    "Good foundation for professional visibility",
  ],
  opportunities: [
    "Your profile could express a sharper point of view on the category you serve.",
    "Product expertise could be connected more directly to customer outcomes.",
    "More consistent educational content could increase recognition across your market.",
  ],
  trends: [
    {
      title: "AI workflow redesign",
      momentum: "Executive priority",
      summary:
        "Teams are shifting from AI features to redesigned workflows that create measurable business lift.",
    },
    {
      title: "Vertical SaaS intelligence",
      momentum: "Accelerating",
      summary:
        "Software markets are rewarding products that understand industry-specific context and decisions.",
    },
    {
      title: "Trust-centered automation",
      momentum: "High signal",
      summary:
        "Professionals are looking for automation that improves quality without hiding accountability.",
    },
    {
      title: "Buyer education ecosystems",
      momentum: "Emerging",
      summary:
        "The best B2B brands are teaching markets before asking them to buy.",
    },
    {
      title: "Human-in-the-loop AI",
      momentum: "Accelerating",
      summary:
        "Adoption improves when AI supports expert judgment instead of trying to replace it.",
    },
  ],
  topic: {
    title: "Why the next SaaS advantage is professional context",
    hook:
      "The most useful software no longer just manages data. It understands the work behind the data.",
    whyNow:
      "AI is raising expectations for products that adapt to industry language, workflows, and decisions.",
    cta:
      "Where should software become more context-aware in your industry?",
    hashtags: ["#SaaS", "#Technology", "#AI", "#LinkedInAuthority"],
  },
};

export function inferProfile(linkedInUrl: string): AreaProfile {
  const source = linkedInUrl.toLowerCase();

  if (
    source.includes("marriott") ||
    source.includes("hilton") ||
    source.includes("hotel") ||
    source.includes("tourism") ||
    source.includes("hospitality")
  ) {
    return hospitalityProfile;
  }

  if (
    source.includes("sick") ||
    source.includes("siemens") ||
    source.includes("automation") ||
    source.includes("logistics") ||
    source.includes("mobility") ||
    source.includes("manufacturing")
  ) {
    return industrialProfile;
  }

  if (
    source.includes("deloitte") ||
    source.includes("consult") ||
    source.includes("finance") ||
    source.includes("advisory")
  ) {
    return consultingProfile;
  }

  return technologyProfile;
}

export function profileForPrimaryArea(
  areaName: string,
  fallback: AreaProfile,
): AreaProfile {
  const normalized = areaName.toLowerCase();

  if (
    normalized.includes("hospitality") ||
    normalized.includes("hotel") ||
    normalized.includes("tourism") ||
    normalized.includes("food")
  ) {
    return hospitalityProfile;
  }

  if (
    normalized.includes("industrial") ||
    normalized.includes("automation") ||
    normalized.includes("robotics") ||
    normalized.includes("mobility") ||
    normalized.includes("logistics") ||
    normalized.includes("manufacturing") ||
    normalized.includes("energy") ||
    normalized.includes("construction")
  ) {
    return industrialProfile;
  }

  if (
    normalized.includes("consulting") ||
    normalized.includes("finance") ||
    normalized.includes("legal") ||
    normalized.includes("real estate") ||
    normalized.includes("hr")
  ) {
    return consultingProfile;
  }

  if (
    normalized.includes("technology") ||
    normalized.includes("saas") ||
    normalized.includes("marketing") ||
    normalized.includes("sales") ||
    normalized.includes("healthcare") ||
    normalized.includes("education")
  ) {
    return technologyProfile;
  }

  return fallback;
}

export function createShareText(score: number, areas: DetectedArea[]) {
  const primaryArea = areas[0]?.name ?? "Professional Growth";

  return [
    "I just checked my LinkedIn Authority Score using INConnect.",
    "",
    `My score: ${score}/100`,
    "",
    "Primary professional area:",
    primaryArea,
    "",
    "Check your professional authority:",
    "https://inconnect.app",
    "",
    "#LinkedIn #ProfessionalBranding #PersonalBranding",
  ].join("\n");
}
