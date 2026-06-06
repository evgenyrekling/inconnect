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
};

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
    topic: "How to write a stronger LinkedIn About section without sounding generic",
  },
  {
    category: "Personal Branding",
    topic: "Personal branding for professionals who do not want to become influencers",
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
    topic: "LinkedIn positioning for founders, consultants, engineers, and commercial leaders",
  },
];

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

export async function generateAndStoreBlogPost() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured for blog generation.");
  }

  const supabase = getSupabaseAdminClient();
  const existingPosts = await getExistingBlogPosts(supabase);
  const topic = chooseNextTopic(existingPosts);
  const generatedPost = await generateBlogArticle(topic);
  const slug = ensureUniqueSlug(generatedPost.slug || generatedPost.title, existingPosts);
  const now = new Date().toISOString();
  const shouldPublish = process.env.AUTO_PUBLISH_BLOG === "true";
  const payload = {
    slug,
    title: cleanText(generatedPost.title, 180),
    excerpt: cleanText(generatedPost.excerpt, 320),
    category: cleanText(generatedPost.category || topic.category, 80),
    content: ensureRequiredBlogSections(generatedPost.content),
    seo_title: cleanText(generatedPost.seoTitle || generatedPost.title, 180),
    seo_description: cleanText(
      generatedPost.seoDescription || generatedPost.excerpt,
      320,
    ),
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
    .select("id, slug, title, published, published_at, created_at")
    .single<StoredBlogPost>();

  if (error) {
    console.error("BLOG_POSTS INSERT ERROR", { payload, error });
    throw new Error(error.message || "Blog post insert failed.");
  }

  return {
    autoPublished: shouldPublish,
    post: data,
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
          "Use markdown for the article body.",
          "The article must be 900 to 1,500 words.",
          "Include a FAQ section.",
          "Include internal links to /assessment, /headline-generator, and /about-generator.",
          "End with this CTA sentence: Want to improve your LinkedIn presence? Try INConnect's free tools.",
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
          "- practical examples or checklists",
          "- a FAQ section",
          "- the required internal links",
          "- the required CTA at the end",
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

  const cta = "Want to improve your LinkedIn presence? Try INConnect's free tools.";
  if (!nextContent.includes(cta)) {
    nextContent += `\n\n${cta}`;
  }

  return nextContent;
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
