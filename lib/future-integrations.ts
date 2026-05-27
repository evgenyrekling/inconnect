import type { DetectedArea, MockUserRecord } from "@/lib/mock-intelligence";

export type VisibilityAnalysisRequest = {
  linkedInUrl: string;
  email: string;
  headline: string;
  about: string;
  postsText?: string;
};

export type VisibilityAnalysisResponse = {
  score: number;
  detectedAreas: DetectedArea[];
  summary: string;
};

export async function analyzeWithOpenAI(
  _request: VisibilityAnalysisRequest,
): Promise<VisibilityAnalysisResponse> {
  throw new Error("OpenAI integration placeholder: replace mock intelligence here.");
}

export async function saveLeadToSupabase(_record: MockUserRecord) {
  throw new Error("Supabase integration placeholder: persist captured free user here.");
}

export async function createStripeCheckoutSession(_plan: "pro") {
  throw new Error("Stripe integration placeholder: create Pro checkout session here.");
}

export async function fetchTrendFeed(_professionalAreas: string[]) {
  throw new Error("Trend feed placeholder: hydrate radar cards from external feeds here.");
}

export async function getAuthenticatedUser() {
  throw new Error("User account placeholder: connect auth provider or Supabase Auth here.");
}
