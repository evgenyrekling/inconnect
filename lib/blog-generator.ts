import OpenAI from "openai";
import {
  getResearchBackedArticleQuality,
  researchBlogTopic,
  type BlogResearchResult,
} from "@/lib/blog-research";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type GeneratedBlogPost = {
  category: string;
  content: string;
  excerpt: string;
  seoDescription: string;
  seoTitle: string;
  slug: string;
  title: string;
};

type ExistingBlogPost = {
  article_angle: string | null;
  category: string | null;
  created_at: string;
  hero_image_prompt: string | null;
  slug: string | null;
  title: string | null;
};

type StoredBlogPost = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
  hero_image_url: string | null;
};

type BlogHeroImageResult = {
  prompt: string;
  url: string;
};

type BlogImageVisualCandidate = {
  camera: string;
  composition: string;
  hook: string;
  keywords: string[];
  lighting: string;
  profession: string;
  sceneType: string;
  setting: string;
  subject: string;
};

export class BlogGenerationError extends Error {
  constructor(
    public readonly stage: string,
    message: string,
  ) {
    super(message);
    this.name = "BlogGenerationError";
  }
}

const BLOG_TOPICS = [
  {
    category: "LinkedIn",
    topic: "LinkedIn profile optimization for professionals who want clearer market positioning",
  },
  {
    category: "LinkedIn",
    topic: "LinkedIn headline examples for managers, directors, and senior specialists",
  },
  {
    category: "Personal Branding",
    topic: "LinkedIn About section writing for professionals who want a clearer positioning story",
  },
  {
    category: "Personal Branding",
    topic: "Personal branding for professionals who do not want to become influencers",
  },
  {
    category: "Personal Branding",
    topic: "Professional visibility on LinkedIn for experts who want better opportunities",
  },
  {
    category: "Leadership",
    topic: "Thought leadership on LinkedIn for managers, directors, founders, and consultants",
  },
  {
    category: "AI",
    topic: "AI for LinkedIn profile improvement, content planning, and professional visibility",
  },
  {
    category: "Career Growth",
    topic: "Career growth through clearer professional positioning on LinkedIn",
  },
  {
    category: "Sales",
    topic: "B2B sales visibility on LinkedIn without spammy outreach",
  },
  {
    category: "Industrial Professionals",
    topic: "LinkedIn for industrial professionals, engineers, automation leaders, and technical sales teams",
  },
  {
    category: "Leadership",
    topic: "LinkedIn for managers who want stronger authority and clearer leadership positioning",
  },
  {
    category: "Leadership",
    topic: "LinkedIn for founders who need trust, visibility, and category authority",
  },
  {
    category: "Career Growth",
    topic: "LinkedIn for engineers who want to make technical expertise easier to understand",
  },
  {
    category: "Career Growth",
    topic: "LinkedIn for consultants who need sharper positioning and stronger credibility signals",
  },
];

const BLOG_IMAGE_BUCKET = "blog-images";
const DEFAULT_BLOG_HERO_IMAGE_URL = "/hero-professionals-collage.png";
const OPENAI_IMAGE_MODEL = "gpt-image-2";
const OPENAI_BLOG_IMAGE_SIZE = "1536x864";

const blogArticleSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "slug",
    "excerpt",
    "category",
    "seoTitle",
    "seoDescription",
    "content",
  ],
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    excerpt: { type: "string" },
    category: { type: "string" },
    seoTitle: { type: "string" },
    seoDescription: { type: "string" },
    content: { type: "string" },
  },
} as const;

const blogArticleExpansionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["content"],
  properties: {
    content: { type: "string" },
  },
} as const;

export async function generateAndStoreBlogPost(options?: {
  publish?: boolean;
  source?: "admin-manual" | "admin-api" | "cron";
}) {
  const source = options?.source ?? "cron";
  const shouldPublish = options?.publish ?? true;

  console.info("INConnect blog generation started", {
    publish: shouldPublish,
    source,
  });

  if (!process.env.OPENAI_API_KEY) {
    throw new BlogGenerationError(
      "configuration",
      "OpenAI is not configured for blog generation.",
    );
  }

  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    throw toBlogGenerationError("supabase_configuration", error);
  }

  const existingPosts = await getExistingBlogPosts(supabase);
  const topic = chooseNextTopic(existingPosts);
  console.info("INConnect blog topic selected", topic);

  let research: BlogResearchResult;
  try {
    research = await researchBlogTopic(topic, existingPosts);
  } catch (error) {
    console.error("INConnect blog web research failure", error);
    throw toBlogGenerationError("web_research", error);
  }

  let generatedPost: GeneratedBlogPost;
  try {
    generatedPost = await generateBlogArticle(topic, research);
    console.info("INConnect OpenAI blog generation success", {
      category: generatedPost.category,
      researchSourceCount: research.researchSources.length,
      title: generatedPost.title,
    });
  } catch (error) {
    console.error("INConnect OpenAI blog generation failure", error);
    throw toBlogGenerationError("openai_generation", error);
  }

  const title = ensureUniqueTitle(cleanText(generatedPost.title, 180), existingPosts);
  const slug = ensureUniqueSlug(generatedPost.slug || title, existingPosts);
  const now = new Date().toISOString();
  const { content, quality } = await prepareQualityCheckedBlogContent({
    generatedPost,
    research,
    title,
    topic,
  });

  const heroImage = await generateAndUploadBlogHeroImage({
    category: generatedPost.category || topic.category,
    recentPosts: existingPosts.slice(0, 10),
    slug,
    supabase,
    title,
    topic: topic.topic,
  });
  const payload = {
    slug,
    title,
    excerpt: cleanText(generatedPost.excerpt, 320),
    category: cleanText(generatedPost.category || topic.category, 80),
    content,
    seo_title: cleanText(generatedPost.seoTitle || title, 180),
    seo_description: cleanText(
      generatedPost.seoDescription || generatedPost.excerpt,
      320,
    ),
    hero_image_prompt: heroImage.prompt,
    hero_image_url: heroImage.url,
    research_sources: research.researchSources,
    research_summary: research.researchSummary,
    article_angle: research.articleAngle,
    published: shouldPublish,
    auto_generated: true,
    author_name: "INConnect Editorial",
    created_at: now,
    published_at: shouldPublish ? now : null,
  };

  console.info("INConnect blog_posts insert payload", {
    ...payload,
    content: `${payload.content.slice(0, 220)}...`,
    quality,
  });

  const { data, error } = await supabase
    .from("blog_posts")
    .insert(payload)
    .select("id, slug, title, published, published_at, created_at, hero_image_url")
    .single<StoredBlogPost>();

  if (error) {
    console.error("INConnect Supabase blog_posts insert failure", {
      error,
      slug,
      title,
    });
    throw new BlogGenerationError(
      "supabase_insert",
      error.message || "Blog post insert failed.",
    );
  }

  console.info("INConnect Supabase blog_posts insert success", {
    heroImageUrl: data.hero_image_url,
    id: data.id,
    published: data.published,
    slug: data.slug,
  });
  console.info("INConnect blog published slug", { slug: data.slug });

  return {
    post: data,
    published: shouldPublish,
    topic,
  };
}

async function getExistingBlogPosts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, title, category, created_at, hero_image_prompt, article_angle")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<ExistingBlogPost[]>();

  if (error) {
    console.error("BLOG_POSTS EXISTING LOOKUP ERROR", error);
    return [];
  }

  return data ?? [];
}

async function generateBlogArticle(
  topic: { category: string; topic: string },
  research: BlogResearchResult,
) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    temperature: 0.72,
    max_output_tokens: 5200,
    input: [
      {
        role: "system",
        content: [
          "You are INConnect Editorial, writing SEO blog drafts for an AI LinkedIn Intelligence Platform.",
          "Write practical, useful articles for professionals, managers, directors, founders, consultants, engineers, industrial professionals, and B2B teams.",
          "Use the provided web research as context for original INConnect analysis.",
          "Synthesize across multiple sources; do not rewrite one source, do not copy source structure, and do not copy source wording.",
          "Do not quote source text unless a very short quote is necessary, and avoid quotes by default.",
          "Avoid generic filler, keyword stuffing, fake expert claims, fake statistics, spammy language, and hype.",
          "Do not invent statistics, dates, survey findings, product claims, or platform changes that are not supported by the research context.",
          "Include a current trend or problem, why it matters, practical steps, examples, and a clear INConnect point of view.",
          "Use clean markdown only for the article body.",
          "Do not repeat the title as a leading # heading inside content.",
          "Use ## for main sections and ### for FAQ questions or short subsections.",
          "Use bullet lists for scannable examples, criteria, and mistakes.",
          "Use numbered lists only for genuine step-by-step sequences.",
          "Avoid long paragraphs; keep most paragraphs to 2-4 sentences.",
          "Avoid inline list paragraphs such as 'Practical Steps: 1... 2... 3...'; use actual markdown lists instead.",
          "Use **bold** sparingly to emphasize key ideas.",
          "Use blockquotes only when they add clarity.",
          "Generate a practical, detailed article between 1,100 and 1,500 words.",
          "Do not produce short summaries.",
          "Each main section should include an explanation, a concrete example, and a practical action step.",
          "Include a section with this exact heading: ## INConnect Point of View.",
          "Include at least three practical recommendation bullet points.",
          "Include a FAQ section with clear ### question headings.",
          "Do not include a Further Reading section.",
          "Do not include external source lists.",
          "Do not include source URLs in the article body.",
          "Do not include external Markdown links.",
          "Never write raw URLs as plain text.",
          "Always use Markdown links for internal INConnect tools.",
          "Use this exact conversion section at the end:",
          "## Next Steps",
          "- [Run Free Assessment](/assessment)",
          "- [Generate LinkedIn Headline](/headline-generator)",
          "- [Generate LinkedIn About Section](/about-generator)",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Topic: ${topic.topic}`,
          `Preferred category: ${topic.category}`,
          `Article angle: ${research.articleAngle}`,
          "",
          "Web research context:",
          research.researchSummary,
          "",
          "Source references to use as context only:",
          ...research.researchSources.map(
            (source, index) =>
              `${index + 1}. ${source.title} | ${source.domain} | ${source.url} | ${source.excerpt}`,
          ),
          "",
          "Return structured JSON only.",
          "The content field must be a complete markdown article with:",
          "- an introduction",
          "- clear H2 sections",
          "- each main section must include explanation, example, and practical action step",
          "- a current trend or problem",
          "- why it matters",
          "- a section titled 'INConnect Point of View'",
          "- practical steps with at least three bullet recommendations",
          "- concrete examples for professionals",
          "- short paragraphs",
          "- bullet lists where useful",
          "- numbered lists only for true sequences",
          "- practical examples or checklists",
          "- a FAQ section using ### question headings",
          "- a Next Steps section at the end",
          "- the required internal links as Markdown links, never raw URLs",
          "- no Further Reading section",
          "- no external source list",
          "- no external Markdown links",
          "",
          "Do not include a leading # title in content. The title is rendered separately on the page.",
          "Do not copy or closely paraphrase any source wording.",
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "inconnect_blog_article",
        strict: true,
        schema: blogArticleSchema,
      },
    },
  });

  if (!response.output_parsed) {
    throw new Error("Blog article response format error.");
  }

  const parsed = response.output_parsed as GeneratedBlogPost;
  if (!parsed.title || !parsed.content || parsed.content.trim().length < 400) {
    throw new Error("Generated blog article was empty or incomplete.");
  }

  return parsed;
}

async function prepareQualityCheckedBlogContent({
  generatedPost,
  research,
  title,
  topic,
}: {
  generatedPost: GeneratedBlogPost;
  research: BlogResearchResult;
  title: string;
  topic: { category: string; topic: string };
}) {
  let articleCoreContent = stripLeadingTitleHeading(
    generatedPost.content,
    generatedPost.title,
  );
  let content = ensureRequiredBlogSections(articleCoreContent);
  let quality = getResearchBackedArticleQuality(content, research.researchSources);

  console.info("INConnect blog initial quality check", {
    issues: quality.issues,
    practicalRecommendationCount: quality.practicalRecommendationCount,
    sectionCount: quality.sectionCount,
    title,
    wordCount: quality.wordCount,
  });

  for (
    let expansionAttempt = 1;
    quality.wordCount < 900 && expansionAttempt <= 2;
    expansionAttempt += 1
  ) {
    console.info("INConnect blog expansion started", {
      expansionAttempt,
      title,
      wordCount: quality.wordCount,
    });

    try {
      articleCoreContent = await expandBlogArticle({
        articleCoreContent,
        expansionAttempt,
        research,
        title,
        topic,
      });
    } catch (error) {
      console.error("INConnect blog expansion failure", {
        error: error instanceof Error ? error.message : String(error),
        expansionAttempt,
        title,
      });
      throw toBlogGenerationError("openai_expansion", error);
    }

    content = ensureRequiredBlogSections(articleCoreContent);
    quality = getResearchBackedArticleQuality(content, research.researchSources);

    console.info("INConnect blog expansion quality check", {
      expansionAttempt,
      issues: quality.issues,
      practicalRecommendationCount: quality.practicalRecommendationCount,
      sectionCount: quality.sectionCount,
      title,
      wordCount: quality.wordCount,
    });
  }

  console.info("INConnect blog final quality check result", {
    issues: quality.issues,
    passed: quality.issues.length === 0,
    practicalRecommendationCount: quality.practicalRecommendationCount,
    sectionCount: quality.sectionCount,
    title,
    wordCount: quality.wordCount,
  });

  if (quality.issues.length > 0) {
    console.error("INConnect blog quality check failed", {
      finalWordCount: quality.wordCount,
      issues: quality.issues,
      title,
    });
    throw new BlogGenerationError(
      "quality_check",
      `Blog article failed quality checks: ${quality.issues.join(" ")}`,
    );
  }

  return {
    content,
    quality,
  };
}

async function expandBlogArticle({
  articleCoreContent,
  expansionAttempt,
  research,
  title,
  topic,
}: {
  articleCoreContent: string;
  expansionAttempt: number;
  research: BlogResearchResult;
  title: string;
  topic: { category: string; topic: string };
}) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    temperature: 0.58,
    max_output_tokens: 5600,
    input: [
      {
        role: "system",
        content: [
          "You are INConnect Editorial expanding a researched LinkedIn intelligence article that was too short.",
          "Preserve the original structure, headings, argument, and INConnect point of view.",
          "Expand the article to 1,000-1,300 words.",
          "Do not add filler text, generic repetition, invented statistics, fake claims, or unsupported trends.",
          "Add more practical examples, industry context, and actionable steps.",
          "Every main section should include explanation, example, and practical action step.",
          "Use the research context only as background; do not copy source wording and do not quote unless short and necessary.",
          "Use clean Markdown only.",
          "Do not include raw source URLs.",
          "Do not include a Further Reading section.",
          "Do not include external source lists.",
          "Do not include external Markdown links.",
          "Keep the Next Steps section if present, but do not add source links.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Expansion attempt: ${expansionAttempt}`,
          `Title: ${title}`,
          `Topic: ${topic.topic}`,
          `Category: ${topic.category}`,
          `Article angle: ${research.articleAngle}`,
          "",
          "Research context:",
          research.researchSummary,
          "",
          "Current article markdown to expand:",
          articleCoreContent,
          "",
          "Return structured JSON only with the expanded markdown in the content field.",
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "inconnect_blog_article_expansion",
        strict: true,
        schema: blogArticleExpansionSchema,
      },
    },
  });

  if (!response.output_parsed) {
    throw new Error("Expanded blog article response format error.");
  }

  const parsed = response.output_parsed as { content: string };
  if (!parsed.content || parsed.content.trim().length < 400) {
    throw new Error("Expanded blog article was empty or incomplete.");
  }

  return stripLeadingTitleHeading(parsed.content, title);
}

async function generateAndUploadBlogHeroImage({
  category,
  recentPosts,
  slug,
  supabase,
  title,
  topic,
}: {
  category: string;
  recentPosts: ExistingBlogPost[];
  slug: string;
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  title: string;
  topic: string;
}): Promise<BlogHeroImageResult> {
  const prompt = createBlogHeroImagePrompt({ category, recentPosts, slug, title, topic });

  try {
    console.info("INConnect blog hero image generation started", {
      slug,
      title,
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const imagesResponse = await openai.images.generate({
      model: OPENAI_IMAGE_MODEL,
      n: 1,
      output_format: "webp",
      prompt,
      quality: "medium",
      size: OPENAI_BLOG_IMAGE_SIZE,
      stream: false,
    });
    const imageBase64 = imagesResponse.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("OpenAI image response did not include base64 image data.");
    }

    console.info("INConnect blog hero image generation success", { slug });
    await ensureBlogImagesBucket(supabase);

    const objectPath = createBlogImageObjectPath(slug);
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const { error: uploadError } = await supabase.storage
      .from(BLOG_IMAGE_BUCKET)
      .upload(objectPath, imageBuffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) {
      console.error("INConnect blog hero image upload failure", {
        error: uploadError,
        objectPath,
        slug,
      });
      throw new Error(uploadError.message || "Blog hero image upload failed.");
    }

    const { data } = supabase.storage.from(BLOG_IMAGE_BUCKET).getPublicUrl(objectPath);
    console.info("INConnect blog hero image upload success", {
      slug,
      url: data.publicUrl,
    });

    return {
      prompt,
      url: data.publicUrl || DEFAULT_BLOG_HERO_IMAGE_URL,
    };
  } catch (error) {
    console.error("INConnect blog hero image fallback used", {
      error: error instanceof Error ? error.message : String(error),
      slug,
    });
    return {
      prompt,
      url: DEFAULT_BLOG_HERO_IMAGE_URL,
    };
  }
}

async function ensureBlogImagesBucket(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { error: getBucketError } = await supabase.storage.getBucket(BLOG_IMAGE_BUCKET);
  if (!getBucketError) return;

  const { error: createBucketError } = await supabase.storage.createBucket(
    BLOG_IMAGE_BUCKET,
    {
      allowedMimeTypes: ["image/webp"],
      fileSizeLimit: 10 * 1024 * 1024,
      public: true,
    },
  );

  if (createBucketError) {
    throw new Error(createBucketError.message || "Blog images bucket could not be created.");
  }
}

function createBlogHeroImagePrompt({
  category,
  recentPosts,
  slug,
  title,
  topic,
}: {
  category: string;
  recentPosts: ExistingBlogPost[];
  slug: string;
  title: string;
  topic: string;
}) {
  const visual = chooseBlogImageVisual({
    category,
    recentPosts,
    title,
    topic,
  });
  const recentPatternSummary = describeRecentVisualPatterns(recentPosts);

  return [
    `Create a ${OPENAI_BLOG_IMAGE_SIZE} professional blog banner image for the INConnect article "${title}".`,
    `Article topic: ${topic}.`,
    `Category: ${category}.`,
    `Article-specific uniqueness key: ${slug}. Use this only to vary the scene, camera angle, setting, cast, wardrobe, and lighting; do not render the key as text.`,
    `Visual concept: ${visual.hook}.`,
    `Composition: ${visual.composition}.`,
    `Scene type: ${visual.sceneType}.`,
    `Profession focus: ${visual.profession}.`,
    `Main subject: ${visual.subject}.`,
    `Setting: ${visual.setting}.`,
    `Camera: ${visual.camera}.`,
    `Lighting: ${visual.lighting}.`,
    recentPatternSummary
      ? `Avoid repeating these recent INConnect image patterns: ${recentPatternSummary}.`
      : "Create a distinct image that does not look like a generic office meeting or a repeated blue corporate stock scene.",
    "Make the image curiosity-driven and editorial, with a specific professional moment rather than a generic group of professionals.",
    "Use a fresh cast, varied age range, different pose language, and a clearly different location from recent articles.",
    "Premium corporate editorial photography style, LinkedIn-inspired, modern and trustworthy, realistic diverse professionals, polished business atmosphere, professional lighting, subtle blue brand accents balanced with neutral materials and natural skin tones.",
    "No text, no letters, no logos, no watermarks, no cartoon style, no mascot style, no gaming or esports look.",
  ].join(" ");
}

function chooseBlogImageVisual({
  category,
  recentPosts,
  title,
  topic,
}: {
  category: string;
  recentPosts: ExistingBlogPost[];
  title: string;
  topic: string;
}) {
  const candidates = getBlogImageVisualCandidates(category, `${title} ${topic}`);
  const offset = hashString(`${category} ${title} ${topic}`) % candidates.length;
  const rotatedCandidates = [
    ...candidates.slice(offset),
    ...candidates.slice(0, offset),
  ];

  return rotatedCandidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: scoreVisualCandidate(candidate, recentPosts),
    }))
    .sort((left, right) => left.score - right.score || left.index - right.index)[0]
    .candidate;
}

function getBlogImageVisualCandidates(category: string, context: string) {
  const visualGroup = getBlogImageVisualGroup(category, context);

  const candidatesByGroup: Record<string, BlogImageVisualCandidate[]> = {
    ai: [
      {
        camera: "over-the-shoulder view with the AI assistant interface reflected on glass",
        composition: "single professional action shot",
        hook: "marketing leader collaborating with a calm AI assistant interface to improve a professional profile",
        keywords: ["ai assistant", "human ai collaboration", "glass interface", "profile intelligence"],
        lighting: "cool blue interface glow balanced with warm office lighting",
        profession: "marketing leader",
        sceneType: "human and AI collaboration",
        setting: "future workplace studio with transparent displays and real desk materials",
        subject: "professional using AI recommendations on a laptop and wall display",
      },
      {
        camera: "wide cinematic angle with layered screens and a visible human decision maker",
        composition: "wide scene",
        hook: "senior professional reviewing digital intelligence signals before updating LinkedIn positioning",
        keywords: ["digital intelligence", "future workplace", "decision maker", "signals"],
        lighting: "soft natural daylight with precise blue accent reflections",
        profession: "senior professional",
        sceneType: "digital intelligence review",
        setting: "modern strategy room with data screens and notebooks",
        subject: "professional comparing AI insights with handwritten positioning notes",
      },
      {
        camera: "tight three-quarter portrait with shallow depth of field",
        composition: "close-up portrait",
        hook: "founder studying AI-generated audience insights with a focused expression",
        keywords: ["founder", "audience insights", "ai workspace", "portrait"],
        lighting: "directional side light with subtle blue screen reflections",
        profession: "founder",
        sceneType: "AI insight review",
        setting: "minimal private office with laptop and abstract intelligence display",
        subject: "founder leaning toward a laptop with AI insight cards visible as abstract shapes",
      },
      {
        camera: "medium shot from table height with hands, tablet, and collaborative screen in frame",
        composition: "team scene",
        hook: "small team using AI to map professional visibility opportunities",
        keywords: ["team", "ai workshop", "visibility map", "collaboration"],
        lighting: "balanced conference lighting with crisp blue UI accents",
        profession: "cross-functional strategy team",
        sceneType: "AI planning workshop",
        setting: "glass meeting room with tablet, laptop, and clean visual network graphics",
        subject: "three professionals discussing AI-generated visibility recommendations",
      },
      {
        camera: "dynamic angle from the side of a workstation",
        composition: "workspace shot",
        hook: "technical professional testing AI profile recommendations in a quiet late-afternoon workspace",
        keywords: ["technical professional", "ai recommendations", "workspace", "late afternoon"],
        lighting: "late-afternoon window light with restrained blue monitor glow",
        profession: "technical professional",
        sceneType: "AI recommendation testing",
        setting: "focused workstation with laptop, tablet, and clean desk details",
        subject: "professional reviewing AI suggestions beside a digital network visualization",
      },
    ],
    b2bSales: [
      {
        camera: "medium-wide angle across the table with dashboard reflections",
        composition: "sales meeting",
        hook: "B2B director reviewing a growth dashboard before an investor or customer meeting",
        keywords: ["b2b director", "growth dashboard", "investor meeting", "sales"],
        lighting: "morning boardroom light with polished navy and steel accents",
        profession: "B2B director",
        sceneType: "growth dashboard review",
        setting: "executive boardroom with laptop, printed notes, and city view",
        subject: "commercial leader studying growth signals before a high-stakes meeting",
      },
      {
        camera: "close side angle focused on expressions and hands rather than a staged handshake",
        composition: "negotiation scene",
        hook: "two business leaders finalizing a partnership conversation after reviewing market data",
        keywords: ["negotiation", "partnership", "business leaders", "market data"],
        lighting: "soft professional lighting with natural highlights",
        profession: "partnership leaders",
        sceneType: "partnership negotiation",
        setting: "private meeting room with market charts on a screen",
        subject: "leaders discussing terms with laptops open and confident body language",
      },
      {
        camera: "overhead editorial shot of people, notes, and account maps",
        composition: "team scene",
        hook: "sales team mapping strategic accounts and relationship pathways",
        keywords: ["sales team", "account map", "relationship pathways", "strategy"],
        lighting: "bright but controlled workshop lighting",
        profession: "enterprise sales team",
        sceneType: "account strategy workshop",
        setting: "collaborative workspace with table maps, tablets, and blue marker accents",
        subject: "team arranging account strategy notes around a central dashboard",
      },
      {
        camera: "wide shot with foreground dashboard and background client conversation",
        composition: "wide scene",
        hook: "commercial leader connecting customer conversations with business growth signals",
        keywords: ["commercial leader", "customer conversation", "business growth", "dashboard"],
        lighting: "premium event lighting with restrained blue highlights",
        profession: "commercial leader",
        sceneType: "client growth discussion",
        setting: "industry event lounge with screens and professional networking energy",
        subject: "leader explaining growth insights to a client while dashboard visuals glow nearby",
      },
      {
        camera: "cinematic action shot from behind a laptop screen",
        composition: "action shot",
        hook: "sales executive preparing a personalized LinkedIn credibility pitch before outreach",
        keywords: ["sales executive", "credibility pitch", "outreach", "linkedin"],
        lighting: "focused desk lamp with clean blue technology accents",
        profession: "sales executive",
        sceneType: "outreach preparation",
        setting: "quiet executive workspace with CRM-like dashboard shapes and profile cards",
        subject: "executive tailoring a credibility narrative before a client call",
      },
    ],
    careerGrowth: [
      {
        camera: "low-angle wide shot emphasizing movement and professional confidence",
        composition: "wide scene",
        hook: "professional climbing clean architectural steps toward a brighter leadership floor",
        keywords: ["climbing steps", "leadership journey", "promotion", "career path"],
        lighting: "optimistic morning light with subtle navy shadows",
        profession: "rising professional",
        sceneType: "leadership journey",
        setting: "modern business atrium with steps and glass architecture",
        subject: "professional walking upward with laptop bag and focused posture",
      },
      {
        camera: "over-the-shoulder shot of a career path visualization",
        composition: "workspace shot",
        hook: "manager mapping the next career move through skills, visibility, and authority signals",
        keywords: ["career map", "skills", "visibility", "authority"],
        lighting: "calm daylight with blue pen and dashboard accents",
        profession: "manager",
        sceneType: "career path visualization",
        setting: "desk with tablet, notebook, and clean career path graphic",
        subject: "professional drawing connections between expertise and future roles",
      },
      {
        camera: "medium portrait through glass with boardroom visible behind",
        composition: "close-up portrait",
        hook: "new leader preparing to enter a senior meeting with clear professional confidence",
        keywords: ["new leader", "senior meeting", "confidence", "promotion"],
        lighting: "clean directional light with premium navy background depth",
        profession: "new leader",
        sceneType: "promotion moment",
        setting: "corridor outside a boardroom with understated executive atmosphere",
        subject: "professional pausing before a leadership meeting",
      },
      {
        camera: "warm medium shot across a small table",
        composition: "two-person mentoring scene",
        hook: "mentor and professional reviewing a positioning plan for the next career chapter",
        keywords: ["mentor", "career chapter", "positioning plan", "growth"],
        lighting: "warm human light with understated blue brand details",
        profession: "mentor and ambitious professional",
        sceneType: "career coaching",
        setting: "quiet cafe-style business lounge with laptop and notebook",
        subject: "two professionals discussing a career positioning roadmap",
      },
      {
        camera: "dynamic side angle with motion blur kept subtle and realistic",
        composition: "action shot",
        hook: "professional moving through a business campus while reviewing opportunity signals",
        keywords: ["business campus", "opportunity signals", "movement", "career growth"],
        lighting: "late morning outdoor light with modern glass reflections",
        profession: "career-focused specialist",
        sceneType: "opportunity transition",
        setting: "modern business campus walkway",
        subject: "professional walking with tablet showing abstract opportunity indicators",
      },
    ],
    industrial: [
      {
        camera: "wide industrial scene with a clear human subject in the foreground",
        composition: "wide scene",
        hook: "automation engineer reviewing a smart factory digital twin beside a production line",
        keywords: ["automation engineer", "smart factory", "digital twin", "production line"],
        lighting: "clean industrial light with blue sensor indicators and realistic factory ambience",
        profession: "automation engineer",
        sceneType: "factory automation",
        setting: "smart factory floor with robots, sensors, and safety markings",
        subject: "engineer holding a tablet while machines operate in the background",
      },
      {
        camera: "cinematic control-room angle with runway or terminal screens in the distance",
        composition: "workspace shot",
        hook: "airport operations leader analyzing live infrastructure and mobility data",
        keywords: ["airport operations", "infrastructure data", "mobility", "control room"],
        lighting: "dim control room lighting with crisp blue operational displays",
        profession: "airport operations leader",
        sceneType: "airport operations",
        setting: "airport operations control room with maps and logistics screens",
        subject: "operations leader studying a tablet in front of live airport dashboards",
      },
      {
        camera: "high-angle logistics scene with one planner sharply in focus",
        composition: "team scene",
        hook: "logistics professional coordinating supply chain visibility in a modern distribution center",
        keywords: ["logistics professional", "supply chain", "distribution center", "visibility"],
        lighting: "bright warehouse daylight with blue digital route overlays",
        profession: "logistics professional",
        sceneType: "logistics center",
        setting: "modern logistics center with conveyors, pallets, and route planning screens",
        subject: "planner coordinating warehouse movement with a handheld device",
      },
      {
        camera: "close-up portrait with industrial background softly blurred",
        composition: "close-up portrait",
        hook: "technical sales specialist translating complex industrial technology into customer value",
        keywords: ["technical sales", "industrial technology", "customer value", "portrait"],
        lighting: "controlled industrial lighting with warm skin tones and blue equipment accents",
        profession: "technical sales specialist",
        sceneType: "industrial customer conversation",
        setting: "industrial site walkway near automation equipment",
        subject: "specialist speaking with confidence while holding safety glasses and tablet",
      },
      {
        camera: "action shot from beside an infrastructure display",
        composition: "action shot",
        hook: "infrastructure expert inspecting sensor data for a connected transport system",
        keywords: ["infrastructure expert", "sensor data", "transport system", "inspection"],
        lighting: "natural field lighting with subtle digital blue highlights",
        profession: "infrastructure expert",
        sceneType: "smart infrastructure inspection",
        setting: "transport infrastructure site with control tablet and equipment",
        subject: "expert reviewing sensor intelligence while standing near modern infrastructure",
      },
    ],
    linkedin: [
      {
        camera: "close laptop-level angle with the professional's focused expression visible",
        composition: "close-up portrait",
        hook: "senior specialist improving a LinkedIn profile while profile analytics glow on a nearby screen",
        keywords: ["linkedin profile", "profile analytics", "senior specialist", "laptop"],
        lighting: "bright professional workspace light with controlled blue screen reflections",
        profession: "senior specialist",
        sceneType: "profile optimization",
        setting: "modern workspace with laptop, tablet, and abstract social network graphics",
        subject: "professional refining profile positioning on a laptop",
      },
      {
        camera: "wide editorial view with a profile dashboard wall behind the subject",
        composition: "wide scene",
        hook: "senior executive studying digital profile analytics on a wall display",
        keywords: ["executive", "digital profile analytics", "wall display", "linkedin"],
        lighting: "premium boardroom lighting with navy and white contrast",
        profession: "senior executive",
        sceneType: "profile analytics review",
        setting: "executive strategy room with large abstract profile dashboard",
        subject: "executive reviewing profile visibility and authority signals",
      },
      {
        camera: "over-the-shoulder action shot with hands, laptop, and profile cards in view",
        composition: "action shot",
        hook: "manager comparing headline options and profile sections across laptop and tablet",
        keywords: ["headline options", "profile sections", "manager", "tablet"],
        lighting: "clean desk lighting with subtle blue interface accents",
        profession: "manager",
        sceneType: "headline and profile review",
        setting: "focused desk setup with laptop, tablet, and profile card visuals",
        subject: "manager choosing the strongest profile positioning option",
      },
      {
        camera: "medium-wide shot from behind a glass board",
        composition: "team scene",
        hook: "small team mapping LinkedIn visibility signals and professional network paths",
        keywords: ["team", "visibility signals", "professional network", "glass board"],
        lighting: "soft collaborative workspace lighting with blue marker accents",
        profession: "positioning team",
        sceneType: "social network strategy",
        setting: "meeting room with glass board, laptops, and network graphics",
        subject: "team connecting profile, content, and audience signals",
      },
      {
        camera: "single-person remote-work shot with depth from window and screen reflections",
        composition: "single professional",
        hook: "consultant optimizing a professional profile before an important discovery call",
        keywords: ["consultant", "profile optimization", "discovery call", "remote workspace"],
        lighting: "natural window light with restrained blue laptop glow",
        profession: "consultant",
        sceneType: "pre-call profile refinement",
        setting: "premium home office or studio workspace",
        subject: "consultant preparing profile positioning before a video meeting",
      },
    ],
    personalBranding: [
      {
        camera: "wide conference angle with the speaker framed by stage light",
        composition: "conference shot",
        hook: "thought leader speaking on stage while the audience listens closely",
        keywords: ["speaker", "stage", "thought leadership", "conference"],
        lighting: "professional stage lighting with subtle blue rim light",
        profession: "thought leader",
        sceneType: "conference keynote",
        setting: "premium business conference stage with audience silhouettes",
        subject: "speaker presenting an industry insight without visible text",
      },
      {
        camera: "tight editorial portrait with confident eye line",
        composition: "close-up portrait",
        hook: "executive portrait that communicates trust, authority, and clear market positioning",
        keywords: ["executive portrait", "authority", "market positioning", "personal brand"],
        lighting: "soft directional portrait light with navy background depth",
        profession: "executive",
        sceneType: "authority portrait",
        setting: "modern glass atrium or premium office corridor",
        subject: "executive facing the camera with understated confidence",
      },
      {
        camera: "medium shot with microphone and audience context visible",
        composition: "action shot",
        hook: "industry expert answering a question during a panel discussion",
        keywords: ["industry expert", "panel discussion", "q and a", "audience"],
        lighting: "conference lighting with crisp blue accent reflections",
        profession: "industry expert",
        sceneType: "panel discussion",
        setting: "conference environment with chairs, microphones, and audience depth",
        subject: "professional responding thoughtfully during a live discussion",
      },
      {
        camera: "side-angle editorial shot through studio glass",
        composition: "workspace shot",
        hook: "founder recording a professional insight in a podcast studio",
        keywords: ["founder", "podcast studio", "professional insight", "personal branding"],
        lighting: "warm studio key light with restrained blue equipment accents",
        profession: "founder",
        sceneType: "thought leadership recording",
        setting: "premium podcast or media studio with microphones and acoustic panels",
        subject: "founder speaking into a microphone with notes nearby",
      },
      {
        camera: "dramatic but realistic spotlight portrait from a slight low angle",
        composition: "single professional",
        hook: "professional stepping into a spotlight before presenting a strong point of view",
        keywords: ["spotlight", "point of view", "leadership", "professional"],
        lighting: "single soft spotlight with dark navy background and natural skin tones",
        profession: "senior professional",
        sceneType: "professional spotlight",
        setting: "minimal presentation space with abstract audience presence",
        subject: "professional holding notes and preparing to speak",
      },
    ],
  };

  return candidatesByGroup[visualGroup] ?? candidatesByGroup.linkedin;
}

function getBlogImageVisualGroup(category: string, context: string) {
  const normalizedValue = `${category} ${context}`.toLowerCase();

  if (
    normalizedValue.includes("industrial") ||
    normalizedValue.includes("engineer") ||
    normalizedValue.includes("automation") ||
    normalizedValue.includes("airport") ||
    normalizedValue.includes("logistics") ||
    normalizedValue.includes("infrastructure")
  ) {
    return "industrial";
  }

  if (normalizedValue.includes("ai") || normalizedValue.includes("artificial intelligence")) {
    return "ai";
  }

  if (
    normalizedValue.includes("sales") ||
    normalizedValue.includes("b2b") ||
    normalizedValue.includes("customer") ||
    normalizedValue.includes("partnership")
  ) {
    return "b2bSales";
  }

  if (
    normalizedValue.includes("career") ||
    normalizedValue.includes("growth") ||
    normalizedValue.includes("promotion") ||
    normalizedValue.includes("consultant")
  ) {
    return "careerGrowth";
  }

  if (
    normalizedValue.includes("personal brand") ||
    normalizedValue.includes("about section") ||
    normalizedValue.includes("thought leadership") ||
    normalizedValue.includes("leadership") ||
    normalizedValue.includes("founder")
  ) {
    return "personalBranding";
  }

  return "linkedin";
}

function scoreVisualCandidate(
  candidate: BlogImageVisualCandidate,
  recentPosts: ExistingBlogPost[],
) {
  return recentPosts.reduce((score, post, index) => {
    const recencyWeight = Math.max(1, 10 - index);
    const recentText = [
      post.category,
      post.title,
      post.hero_image_prompt,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    let nextScore = score;
    nextScore += includesVisualTerm(recentText, candidate.composition) ? 7 * recencyWeight : 0;
    nextScore += includesVisualTerm(recentText, candidate.sceneType) ? 7 * recencyWeight : 0;
    nextScore += includesVisualTerm(recentText, candidate.profession) ? 5 * recencyWeight : 0;
    nextScore += includesVisualTerm(recentText, candidate.setting) ? 4 * recencyWeight : 0;
    nextScore += includesVisualTerm(recentText, candidate.hook) ? 4 * recencyWeight : 0;

    candidate.keywords.forEach((keyword) => {
      if (includesVisualTerm(recentText, keyword)) {
        nextScore += 2 * recencyWeight;
      }
    });

    return nextScore;
  }, 0);
}

function describeRecentVisualPatterns(recentPosts: ExistingBlogPost[]) {
  return recentPosts
    .slice(0, 10)
    .map((post) => extractPromptVisualSummary(post.hero_image_prompt))
    .filter(Boolean)
    .slice(0, 6)
    .join("; ");
}

function extractPromptVisualSummary(prompt: string | null) {
  if (!prompt) return "";

  const labels = [
    "Composition",
    "Scene type",
    "Profession focus",
    "Setting",
  ];

  return labels
    .map((label) => {
      const match = prompt.match(new RegExp(`${label}:\\s*([^\\.]+)`, "i"));
      return match ? `${label.toLowerCase()} ${match[1].trim()}` : "";
    })
    .filter(Boolean)
    .join(", ");
}

function includesVisualTerm(value: string, term: string) {
  const normalizedTerm = term.toLowerCase().trim();
  if (normalizedTerm.length < 4) return false;
  return value.includes(normalizedTerm);
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function createBlogImageObjectPath(slug: string) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${slug}.webp`;
}

function chooseNextTopic(existingPosts: ExistingBlogPost[]) {
  const recentText = existingPosts
    .slice(0, 14)
    .map((post) => `${post.title ?? ""} ${post.slug ?? ""}`.toLowerCase())
    .join(" ");
  const offset = existingPosts.length % BLOG_TOPICS.length;

  for (let index = 0; index < BLOG_TOPICS.length; index += 1) {
    const candidate = BLOG_TOPICS[(offset + index) % BLOG_TOPICS.length];
    const candidateKey = candidate.topic
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 5)
      .slice(0, 4);

    if (!candidateKey.every((word) => recentText.includes(word))) {
      return candidate;
    }
  }

  return BLOG_TOPICS[offset];
}

function ensureUniqueSlug(value: string, existingPosts: ExistingBlogPost[]) {
  const existingSlugs = new Set(
    existingPosts
      .map((post) => post.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );
  const baseSlug = slugify(value) || `inconnect-blog-${getUtcDateSuffix()}`;

  if (!existingSlugs.has(baseSlug)) return baseSlug;

  const datedSlug = `${baseSlug}-${getUtcDateSuffix()}`;
  if (!existingSlugs.has(datedSlug)) return datedSlug;

  let suffix = 2;
  while (existingSlugs.has(`${datedSlug}-${suffix}`)) {
    suffix += 1;
  }
  return `${datedSlug}-${suffix}`;
}

function ensureUniqueTitle(value: string, existingPosts: ExistingBlogPost[]) {
  const existingTitles = new Set(
    existingPosts
      .map((post) => post.title?.trim().toLowerCase())
      .filter((title): title is string => Boolean(title)),
  );
  if (!existingTitles.has(value.trim().toLowerCase())) return value;
  return `${value} (${getUtcDateSuffix()})`;
}

function ensureRequiredBlogSections(content: string) {
  const canonicalCta = [
    "## Next Steps",
    "",
    "- [Run Free Assessment](/assessment)",
    "- [Generate LinkedIn Headline](/headline-generator)",
    "- [Generate LinkedIn About Section](/about-generator)",
  ].join("\n");
  const contentWithoutManagedSections = removeManagedBlogSections(content.trim());
  return [
    contentWithoutManagedSections,
    canonicalCta,
  ].join("\n\n");
}

function removeManagedBlogSections(content: string) {
  return content
    .replace(
      /\n*##\s+Further Reading[\s\S]*$/i,
      "",
    )
    .replace(
      /\n*##\s+(?:Improve Your LinkedIn Presence|Next Steps|Try INConnect's Free Tools)[\s\S]*$/i,
      "",
    )
    .replace(
      /\n*Want to improve your LinkedIn presence\? Try INConnect's free AI tools(?:\s+at\s+\/assessment,\s+\/headline-generator,\s+and\s+\/about-generator)?\.?[\s\S]*$/i,
      "",
    )
    .trim();
}

function stripLeadingTitleHeading(content: string, title: string) {
  const trimmedContent = content.trim();
  const lines = trimmedContent.split(/\r?\n/);
  const firstLine = lines[0]?.trim() ?? "";

  if (!firstLine.startsWith("# ")) return trimmedContent;

  const heading = firstLine.replace(/^#\s+/, "").trim().toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();
  if (heading === normalizedTitle || normalizedTitle.includes(heading)) {
    return lines.slice(1).join("\n").trim();
  }

  return trimmedContent;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 86)
    .replace(/-+$/g, "");
}

function cleanText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function getUtcDateSuffix() {
  return new Date().toISOString().slice(0, 10);
}

function toBlogGenerationError(stage: string, error: unknown) {
  if (error instanceof BlogGenerationError) return error;
  return new BlogGenerationError(
    stage,
    error instanceof Error ? error.message : String(error),
  );
}
