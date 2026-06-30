import OpenAI from "openai";

export type SmartEntryDraft = {
  companies: Array<{
    city: string;
    company_type: string;
    confidence?: number;
    country_name: string;
    description: string;
    display_name: string;
    industry: string;
    linkedin_url: string;
    name: string;
    notes: string;
    website: string;
  }>;
  links: Array<{
    company_index: number;
    confidence?: number;
    department: string;
    is_primary: boolean;
    professional_index: number;
    relationship_type: string;
    title: string;
  }>;
  professionals: Array<{
    confidence?: number;
    current_company: string;
    current_title: string;
    education_summary: string;
    experience_summary: string;
    full_name: string;
    headline: string;
    industry: string;
    linkedin_url: string;
    location: string;
    notes: string;
    phone: string;
    professional_email: string;
    profile_image_url: string;
    skills: string[];
  }>;
};

const smartEntrySchema = {
  type: "object",
  additionalProperties: false,
  required: ["professionals", "companies", "links"],
  properties: {
    professionals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "full_name",
          "linkedin_url",
          "professional_email",
          "headline",
          "current_title",
          "current_company",
          "location",
          "industry",
          "profile_image_url",
          "phone",
          "skills",
          "experience_summary",
          "education_summary",
          "notes",
          "confidence",
        ],
        properties: {
          full_name: { type: "string" },
          linkedin_url: { type: "string" },
          professional_email: { type: "string" },
          headline: { type: "string" },
          current_title: { type: "string" },
          current_company: { type: "string" },
          location: { type: "string" },
          industry: { type: "string" },
          profile_image_url: { type: "string" },
          phone: { type: "string" },
          skills: { type: "array", items: { type: "string" } },
          experience_summary: { type: "string" },
          education_summary: { type: "string" },
          notes: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
    companies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "display_name",
          "company_type",
          "industry",
          "country_name",
          "city",
          "website",
          "linkedin_url",
          "description",
          "notes",
          "confidence",
        ],
        properties: {
          name: { type: "string" },
          display_name: { type: "string" },
          company_type: { type: "string" },
          industry: { type: "string" },
          country_name: { type: "string" },
          city: { type: "string" },
          website: { type: "string" },
          linkedin_url: { type: "string" },
          description: { type: "string" },
          notes: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
    links: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "professional_index",
          "company_index",
          "title",
          "department",
          "relationship_type",
          "is_primary",
          "confidence",
        ],
        properties: {
          professional_index: { type: "number" },
          company_index: { type: "number" },
          title: { type: "string" },
          department: { type: "string" },
          relationship_type: { type: "string" },
          is_primary: { type: "boolean" },
          confidence: { type: "number" },
        },
      },
    },
  },
};

export async function parseUniversalSmartEntryTextToDraft({
  inputText,
  inputType,
}: {
  inputText: string;
  inputType: string;
}) {
  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    input: [
      {
        content: [
          "You are INConnect Smart Entry.",
          "Extract companies, private professionals/contacts, and relationships from one mixed input.",
          "The input may be a LinkedIn URL, LinkedIn PDF text, email signature, copied text, company website text, meeting notes, screenshot OCR text, TXT file, or general PDF text.",
          "Do not ask questions. Do not invent missing data. Use empty strings or empty arrays when data is not present.",
          "Companies are public/global. Professionals are private contacts owned by the current user.",
          "Create relationships only when the input clearly connects a professional to a company.",
          "Use relationship_type employee unless another relationship is clearly indicated.",
          "Company company_type examples: Airport Operator, Airline, Technology Supplier, System Integrator, Ground Handler, Cargo Operator, Consultant, Authority, OEM, Other.",
          "Set confidence from 0 to 1 for each extracted company, professional, and relationship.",
          `Detected input type: ${inputType}`,
          "",
          inputText.slice(0, 30000),
        ].join("\n"),
        role: "user",
      },
    ],
    max_output_tokens: 2600,
    model: "gpt-4o-mini",
    temperature: 0.1,
    text: {
      format: {
        name: "smart_entry_draft",
        schema: smartEntrySchema,
        strict: true,
        type: "json_schema",
      },
    },
  });

  return normalizeDraft(response.output_parsed as SmartEntryDraft | null);
}

export async function parseUniversalSmartEntryImageToDraft({
  dataUrl,
  mimeType,
}: {
  dataUrl: string;
  mimeType: string;
}) {
  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    input: [
      {
        content: [
          {
            text: [
              "You are INConnect Smart Entry.",
              "Read the image and extract visible companies, private professionals/contacts, and relationships.",
              "The image may be a business card, screenshot, badge, slide, or document photo.",
              "Do not invent missing data. Use empty strings or empty arrays when data is not visible.",
              "Create relationships only when the image clearly connects a professional to a company.",
              "Set confidence from 0 to 1 for each extracted company, professional, and relationship.",
              `Image MIME type: ${mimeType}`,
              "Return JSON only.",
            ].join("\n"),
            type: "input_text",
          },
          {
            detail: "high",
            image_url: dataUrl,
            type: "input_image",
          },
        ],
        role: "user",
      },
    ],
    max_output_tokens: 2200,
    model: "gpt-4o-mini",
    temperature: 0.1,
    text: {
      format: {
        name: "smart_entry_draft",
        schema: smartEntrySchema,
        strict: true,
        type: "json_schema",
      },
    },
  } as Parameters<typeof openai.responses.parse>[0]);

  return normalizeDraft(response.output_parsed as SmartEntryDraft | null);
}

export async function parseLinkedInPdfTextToSmartDraft(pdfText: string) {
  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    input: [
      {
        content: [
          "Extract a normalized INConnect Smart Entry draft from this LinkedIn profile PDF text.",
          "Do not invent missing data. Use empty strings or empty arrays when data is not found.",
          "Create one professional for the profile owner.",
          "Create company drafts for the current company and clearly present past experience companies.",
          "Create a primary employee link to the current company. Past company links should use relationship_type former_employee.",
          "Set confidence from 0 to 1 for each extracted company, professional, and relationship.",
          "Return JSON only.",
          "",
          pdfText.slice(0, 30000),
        ].join("\n"),
        role: "user",
      },
    ],
    max_output_tokens: 2200,
    model: "gpt-4o-mini",
    temperature: 0.1,
    text: {
      format: {
        name: "smart_entry_draft",
        schema: smartEntrySchema,
        strict: true,
        type: "json_schema",
      },
    },
  });

  return normalizeDraft(response.output_parsed as SmartEntryDraft | null);
}

export async function parseBusinessCardImageToSmartDraft({
  dataUrl,
  mimeType,
}: {
  dataUrl: string;
  mimeType: string;
}) {
  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    input: [
      {
        content: [
          {
            text: [
              "Extract a normalized INConnect Smart Entry draft from this business card image.",
              "Read visible text only. Do not invent missing data.",
              "Extract one professional and one company if visible.",
              "Use relationship_type employee and is_primary true when both professional and company are visible.",
              "Set confidence from 0 to 1 for each extracted company, professional, and relationship.",
              `Image MIME type: ${mimeType}`,
              "Return JSON only.",
            ].join("\n"),
            type: "input_text",
          },
          {
            detail: "high",
            image_url: dataUrl,
            type: "input_image",
          },
        ],
        role: "user",
      },
    ],
    max_output_tokens: 1800,
    model: "gpt-4o-mini",
    temperature: 0.1,
    text: {
      format: {
        name: "smart_entry_draft",
        schema: smartEntrySchema,
        strict: true,
        type: "json_schema",
      },
    },
  } as Parameters<typeof openai.responses.parse>[0]);

  return normalizeDraft(response.output_parsed as SmartEntryDraft | null);
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function normalizeDraft(draft: SmartEntryDraft | null): SmartEntryDraft {
  return {
    companies: (draft?.companies ?? []).map((company) => ({
      city: clean(company.city),
      company_type: clean(company.company_type) || "Other",
      confidence: normalizeConfidence(company.confidence),
      country_name: clean(company.country_name),
      description: clean(company.description),
      display_name: clean(company.display_name || company.name),
      industry: clean(company.industry),
      linkedin_url: clean(company.linkedin_url),
      name: clean(company.name || company.display_name),
      notes: clean(company.notes),
      website: clean(company.website),
    })),
    links: (draft?.links ?? []).map((link) => ({
      company_index: Number.isFinite(link.company_index) ? link.company_index : 0,
      confidence: normalizeConfidence(link.confidence),
      department: clean(link.department),
      is_primary: Boolean(link.is_primary),
      professional_index: Number.isFinite(link.professional_index) ? link.professional_index : 0,
      relationship_type: clean(link.relationship_type) || "employee",
      title: clean(link.title),
    })),
    professionals: (draft?.professionals ?? []).map((professional) => ({
      confidence: normalizeConfidence(professional.confidence),
      current_company: clean(professional.current_company),
      current_title: clean(professional.current_title),
      education_summary: clean(professional.education_summary, 1200),
      experience_summary: clean(professional.experience_summary, 1200),
      full_name: clean(professional.full_name),
      headline: clean(professional.headline),
      industry: clean(professional.industry),
      linkedin_url: clean(professional.linkedin_url),
      location: clean(professional.location),
      notes: clean(professional.notes, 1200),
      phone: clean(professional.phone),
      professional_email: clean(professional.professional_email),
      profile_image_url: clean(professional.profile_image_url),
      skills: (professional.skills ?? []).map((skill) => clean(skill)).filter(Boolean).slice(0, 30),
    })),
  };
}

function clean(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function normalizeConfidence(value: unknown) {
  const confidence = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(1, confidence));
}
