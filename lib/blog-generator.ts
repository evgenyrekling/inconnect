import OpenAI from "openai";
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
  category: string | null;
  created_at: string;
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
const OPENAI_BLOG_IMAGE_SIZE = "1600x900";

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

  let generatedPost: GeneratedBlogPost;
  try {
    generatedPost = await generateBlogArticle(topic);
    console.info("INConnect OpenAI blog generation success", {
      category: generatedPost.category,
      title: generatedPost.title,
    });
  } catch (error) {
    console.error("INConnect OpenAI blog generation failure", error);
    throw toBlogGenerationError("openai_generation", error);
  }

  const title = ensureUniqueTitle(cleanText(generatedPost.title, 180), existingPosts);
  const slug = ensureUniqueSlug(generatedPost.slug || title, existingPosts);
  const now = new Date().toISOString();
  const heroImage = await generateAndUploadBlogHeroImage({
    category: generatedPost.category || topic.category,
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
    content: ensureRequiredBlogSections(
      stripLeadingTitleHeading(generatedPost.content, generatedPost.title),
    ),
    seo_title: cleanText(generatedPost.seoTitle || title, 180),
    seo_description: cleanText(
      generatedPost.seoDescription || generatedPost.excerpt,
      320,
    ),
    hero_image_prompt: heroImage.prompt,
    hero_image_url: heroImage.url,
    published: shouldPublish,
    auto_generated: true,
    author_name: "INConnect Editorial",
    created_at: now,
    published_at: shouldPublish ? now : null,
  };

  console.info("INConnect blog_posts insert payload", {
    ...payload,
    content: `${payload.content.slice(0, 220)}...`,
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
    .select("slug, title, category, created_at")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<ExistingBlogPost[]>();

  if (error) {
    console.error("BLOG_POSTS EXISTING LOOKUP ERROR", error);
    return [];
  }

  return data ?? [];
}

async function generateBlogArticle(topic: { category: string; topic: string }) {
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
          "Avoid generic filler, keyword stuffing, fake expert claims, fake statistics, spammy language, and hype.",
          "Use clean markdown only for the article body.",
          "Do not repeat the title as a leading # heading inside content.",
          "Use ## for main sections and ### for FAQ questions or short subsections.",
          "Use bullet lists for scannable examples, criteria, and mistakes.",
          "Use numbered lists only for genuine step-by-step sequences.",
          "Avoid long paragraphs; keep most paragraphs to 2-4 sentences.",
          "Avoid inline list paragraphs such as 'Practical Steps: 1... 2... 3...'; use actual markdown lists instead.",
          "Use **bold** sparingly to emphasize key ideas.",
          "Use blockquotes only when they add clarity.",
          "The article must be 900 to 1,500 words.",
          "Include a FAQ section with clear ### question headings.",
          "Include a final CTA section with a ## heading.",
          "Include internal links to /assessment, /headline-generator, and /about-generator.",
          "End with this exact CTA sentence: Want to improve your LinkedIn presence? Try INConnect’s free AI tools.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Topic: ${topic.topic}`,
          `Preferred category: ${topic.category}`,
          "",
          "Return structured JSON only.",
          "The content field must be a complete markdown article with:",
          "- an introduction",
          "- clear H2 sections",
          "- short paragraphs",
          "- bullet lists where useful",
          "- numbered lists only for true sequences",
          "- practical examples or checklists",
          "- a FAQ section using ### question headings",
          "- a CTA section at the end",
          "- the required internal links",
          "- the required CTA at the end",
          "",
          "Do not include a leading # title in content. The title is rendered separately on the page.",
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
  if (!parsed.title || !parsed.content || parsed.content.length < 1800) {
    throw new Error("Generated blog article was too short or incomplete.");
  }

  return parsed;
}

async function generateAndUploadBlogHeroImage({
  category,
  slug,
  supabase,
  title,
  topic,
}: {
  category: string;
  slug: string;
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  title: string;
  topic: string;
}): Promise<BlogHeroImageResult> {
  const prompt = createBlogHeroImagePrompt({ category, title, topic });

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
  title,
  topic,
}: {
  category: string;
  title: string;
  topic: string;
}) {
  return [
    `Create a ${OPENAI_BLOG_IMAGE_SIZE} professional blog banner image for the INConnect article "${title}".`,
    `Article topic: ${topic}.`,
    `Category: ${category}.`,
    getTopicVisualDirection(`${title} ${topic} ${category}`),
    "Premium corporate editorial photography style, LinkedIn-inspired, modern blue technology palette, realistic diverse professionals, business atmosphere, professional lighting, polished magazine-cover composition, subtle depth, no stock-photo feeling.",
    "No text, no letters, no logos, no watermarks, no cartoon style, no mascot style, no gaming or esports look.",
  ].join(" ");
}

function getTopicVisualDirection(value: string) {
  const normalizedValue = value.toLowerCase();

  if (normalizedValue.includes("headline")) {
    return "Visual direction: professional manager reviewing a modern digital profile dashboard, business profile visualization, confident workplace scene.";
  }

  if (normalizedValue.includes("about section") || normalizedValue.includes("story")) {
    return "Visual direction: executive portrait and professional storytelling atmosphere, personal brand narrative, modern office with subtle digital profile elements.";
  }

  if (
    normalizedValue.includes("personal brand") ||
    normalizedValue.includes("thought leadership")
  ) {
    return "Visual direction: thought leader, speaker, or industry expert in a premium business environment with a professional audience or subtle network presence.";
  }

  if (normalizedValue.includes("ai")) {
    return "Visual direction: professional using an AI interface, digital network patterns, clean technology workspace, blue intelligent systems atmosphere.";
  }

  if (normalizedValue.includes("career") || normalizedValue.includes("growth")) {
    return "Visual direction: promotion, leadership, business success, confident professional moving into a senior opportunity.";
  }

  if (normalizedValue.includes("visibility") || normalizedValue.includes("authority")) {
    return "Visual direction: professional spotlight, visible network influence, authority signals, premium blue-lit business environment.";
  }

  return "Visual direction: diverse professionals in a premium modern business setting, digital network and LinkedIn-style profile intelligence atmosphere.";
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
  const internalLinks = [
    { href: "/assessment", label: "Run a free LinkedIn assessment" },
    { href: "/headline-generator", label: "Generate LinkedIn headlines" },
    { href: "/about-generator", label: "Generate a LinkedIn About section" },
  ];
  let nextContent = content.trim();

  const missingLinks = internalLinks.filter((link) => !nextContent.includes(link.href));
  if (missingLinks.length > 0) {
    nextContent += [
      "",
      "## Try INConnect's Free Tools",
      "",
      ...missingLinks.map((link) => `- [${link.label}](${link.href})`),
    ].join("\n");
  }

  const cta = "Want to improve your LinkedIn presence? Try INConnect’s free AI tools.";
  if (!nextContent.includes(cta)) {
    nextContent += `\n\n## Improve Your LinkedIn Presence\n\n${cta}`;
  }

  return nextContent;
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
