export type BlogResearchSource = {
  domain: string;
  excerpt: string;
  publishedAt?: string;
  title: string;
  url: string;
};

export type BlogResearchResult = {
  articleAngle: string;
  researchSources: BlogResearchSource[];
  researchSummary: string;
};

export type BlogResearchTopic = {
  category: string;
  topic: string;
};

export type BlogResearchExistingPost = {
  article_angle: string | null;
  category: string | null;
  created_at: string;
  title: string | null;
};

export type BlogArticleQualityResult = {
  issues: string[];
  practicalRecommendationCount: number;
  sectionCount: number;
  wordCount: number;
};

const MIN_RESEARCH_SOURCES = 3;
const MAX_RESEARCH_SOURCES = 5;
const RESEARCH_TIMEOUT_MS = 8000;

const PREFERRED_SOURCE_DOMAINS = [
  "business.linkedin.com",
  "linkedin.com",
  "developers.google.com",
  "blog.google",
  "thinkwithgoogle.com",
  "blog.hubspot.com",
  "hubspot.com",
  "hootsuite.com",
  "sproutsocial.com",
  "gartner.com",
  "mckinsey.com",
  "deloitte.com",
  "contentmarketinginstitute.com",
];

export async function researchBlogTopic(
  topic: BlogResearchTopic,
  existingPosts: BlogResearchExistingPost[],
): Promise<BlogResearchResult> {
  console.info("INConnect blog web research started", {
    category: topic.category,
    topic: topic.topic,
  });

  const queries = createResearchQueries(topic);
  const discoveredSources: BlogResearchSource[] = [];

  for (const query of queries) {
    const sources = await searchWebForResearchSources(query).catch((error) => {
      console.warn("INConnect blog research query failed", {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      return [];
    });

    addUniqueResearchSources(discoveredSources, sources);
    if (discoveredSources.length >= MAX_RESEARCH_SOURCES * 3) break;
  }

  const selectedSources = await selectResearchSources(discoveredSources, topic);

  if (selectedSources.length < MIN_RESEARCH_SOURCES) {
    throw new Error(
      `Web research found ${selectedSources.length} usable sources; at least ${MIN_RESEARCH_SOURCES} are required.`,
    );
  }

  const articleAngle = chooseArticleAngle(topic, selectedSources, existingPosts);
  const researchSummary = createResearchSummary(topic, selectedSources, articleAngle);

  console.info("INConnect blog web research success", {
    angle: articleAngle,
    sourceCount: selectedSources.length,
    sources: selectedSources.map((source) => ({
      domain: source.domain,
      title: source.title,
      url: source.url,
    })),
  });

  return {
    articleAngle,
    researchSources: selectedSources,
    researchSummary,
  };
}

export function buildFurtherReadingSection(sources: BlogResearchSource[]) {
  return [
    "## Further Reading",
    "",
    ...sources.slice(0, MAX_RESEARCH_SOURCES).map((source) => {
      const title = source.title.replace(/\]/g, ")");
      return `- ${title}, ${source.domain}, [read source](${source.url})`;
    }),
  ].join("\n");
}

export function validateResearchBackedArticle(
  content: string,
  sources: BlogResearchSource[],
) {
  return getResearchBackedArticleQuality(content, sources).issues;
}

export function getResearchBackedArticleQuality(
  content: string,
  sources: BlogResearchSource[],
): BlogArticleQualityResult {
  const issues: string[] = [];
  const wordCount = countWords(stripMarkdown(content));
  const sectionCount = countNonUtilitySections(content);
  const practicalRecommendationCount = countPracticalRecommendations(content);

  if (wordCount < 900) {
    issues.push(`Article has ${wordCount} words; minimum is 900.`);
  }

  if (sectionCount < 3) {
    issues.push(`Article has ${sectionCount} non-utility sections; minimum is 3.`);
  }

  if (practicalRecommendationCount < 3) {
    issues.push(
      `Article has ${practicalRecommendationCount} practical recommendation bullets; minimum is 3.`,
    );
  }

  if (hasRawUrlInsideParagraph(content)) {
    issues.push("Article includes a raw URL inside a paragraph.");
  }

  if (!hasRequiredInternalCtaLinks(content)) {
    issues.push("Article is missing required internal CTA links.");
  }

  if (!/##\s+Further Reading/i.test(content)) {
    issues.push("Article is missing the Further Reading source section.");
  }

  if (sources.length < MIN_RESEARCH_SOURCES) {
    issues.push(`Article has ${sources.length} research sources; minimum is 3.`);
  }

  if (!/##\s+INConnect Point of View/i.test(content)) {
    issues.push("Article is missing an INConnect Point of View section.");
  }

  return {
    issues,
    practicalRecommendationCount,
    sectionCount,
    wordCount,
  };
}

function createResearchQueries(topic: BlogResearchTopic) {
  const currentYear = new Date().getUTCFullYear();
  const baseTopic = topic.topic;
  const preferredDomains = getPreferredDomainsForTopic(topic);
  const baseQueries = [
    `${baseTopic} latest ${currentYear} LinkedIn professional visibility`,
    `${baseTopic} current trends ${currentYear} professionals`,
    `${topic.category} LinkedIn strategy ${currentYear} professional positioning`,
  ];

  return [
    ...baseQueries,
    ...preferredDomains.map((domain) => `site:${domain} ${baseTopic} ${currentYear}`),
  ].slice(0, 10);
}

function getPreferredDomainsForTopic(topic: BlogResearchTopic) {
  const normalizedValue = `${topic.category} ${topic.topic}`.toLowerCase();

  if (normalizedValue.includes("ai")) {
    return [
      "business.linkedin.com",
      "developers.google.com",
      "mckinsey.com",
      "deloitte.com",
      "gartner.com",
      "blog.hubspot.com",
      "sproutsocial.com",
    ];
  }

  if (
    normalizedValue.includes("sales") ||
    normalizedValue.includes("b2b") ||
    normalizedValue.includes("founder")
  ) {
    return [
      "business.linkedin.com",
      "blog.hubspot.com",
      "gartner.com",
      "mckinsey.com",
      "deloitte.com",
      "hootsuite.com",
      "sproutsocial.com",
    ];
  }

  if (
    normalizedValue.includes("industrial") ||
    normalizedValue.includes("engineer") ||
    normalizedValue.includes("automation")
  ) {
    return [
      "business.linkedin.com",
      "deloitte.com",
      "mckinsey.com",
      "gartner.com",
      "blog.hubspot.com",
      "hootsuite.com",
      "sproutsocial.com",
    ];
  }

  return [
    "business.linkedin.com",
    "blog.hubspot.com",
    "hootsuite.com",
    "sproutsocial.com",
    "developers.google.com",
    "contentmarketinginstitute.com",
    "mckinsey.com",
  ];
}

async function searchWebForResearchSources(query: string) {
  const searchUrls = [
    `https://www.bing.com/search?${new URLSearchParams({
      format: "rss",
      q: query,
    }).toString()}`,
    `https://www.bing.com/news/search?${new URLSearchParams({
      format: "rss",
      q: query,
    }).toString()}`,
  ];

  const sourceGroups = await Promise.all(
    searchUrls.map(async (url) => {
      const response = await fetchWithTimeout(url, {
        headers: {
          accept: "application/rss+xml, application/xml, text/xml, */*",
          "user-agent":
            "INConnectBot/1.0 (+https://in-connect.app; blog research)",
        },
      });

      if (!response.ok) {
        throw new Error(`Search request failed with ${response.status}`);
      }

      return parseRssResearchSources(await response.text());
    }),
  );

  return sourceGroups.flat();
}

async function selectResearchSources(
  sources: BlogResearchSource[],
  topic: BlogResearchTopic,
) {
  const rankedSources = sources
    .map((source, index) => ({
      index,
      score: scoreResearchSource(source, topic, index),
      source,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((result) => result.source);

  const selected: BlogResearchSource[] = [];
  const domainCounts = new Map<string, number>();

  for (const source of rankedSources) {
    const domainCount = domainCounts.get(source.domain) ?? 0;
    if (domainCount >= 2) continue;

    selected.push(source);
    domainCounts.set(source.domain, domainCount + 1);
    if (selected.length >= MAX_RESEARCH_SOURCES) break;
  }

  const enrichedSources = await Promise.all(
    selected.map((source) => enrichResearchSource(source)),
  );

  return enrichedSources;
}

async function enrichResearchSource(source: BlogResearchSource) {
  const pageContext = await fetchSourcePageContext(source.url).catch(() => "");
  if (!pageContext) return source;

  return {
    ...source,
    excerpt: cleanWhitespace(`${source.excerpt} ${pageContext}`).slice(0, 900),
  };
}

async function fetchSourcePageContext(url: string) {
  const response = await fetchWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": "INConnectBot/1.0 (+https://in-connect.app; blog research)",
    },
  });

  if (!response.ok) return "";

  const html = await response.text();
  const description = extractMetaDescription(html);
  const bodyText = htmlToReadableText(html);
  return cleanWhitespace([description, bodyText].filter(Boolean).join(" ")).slice(0, 700);
}

function parseRssResearchSources(xml: string) {
  const sources: BlogResearchSource[] = [];
  const itemMatches = xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi);

  for (const match of itemMatches) {
    const item = match[1];
    const title = cleanText(extractXmlTag(item, "title"), 180);
    const url = normalizeResearchUrl(extractXmlTag(item, "link"));
    const domain = getDomain(url);
    const excerpt = cleanText(stripHtml(extractXmlTag(item, "description")), 420);
    const publishedAt = parsePublishedDate(extractXmlTag(item, "pubDate"));

    if (!title || !url || !domain || !excerpt || shouldSkipResearchDomain(domain)) {
      continue;
    }

    sources.push({
      domain,
      excerpt,
      publishedAt,
      title,
      url,
    });
  }

  return sources;
}

function scoreResearchSource(
  source: BlogResearchSource,
  topic: BlogResearchTopic,
  index: number,
) {
  const preferredIndex = PREFERRED_SOURCE_DOMAINS.findIndex((domain) =>
    source.domain.endsWith(domain),
  );
  const preferredScore = preferredIndex >= 0 ? 120 - preferredIndex * 6 : 20;
  const recencyScore = scoreRecency(source.publishedAt);
  const topicText = `${topic.category} ${topic.topic}`.toLowerCase();
  const sourceText = `${source.title} ${source.excerpt}`.toLowerCase();
  const relevanceScore = topicText
    .split(/\s+/)
    .filter((word) => word.length > 5 && sourceText.includes(word))
    .length * 8;

  return preferredScore + recencyScore + relevanceScore - index;
}

function scoreRecency(value?: string) {
  if (!value) return 0;
  const publishedTime = new Date(value).getTime();
  if (Number.isNaN(publishedTime)) return 0;

  const ageDays = (Date.now() - publishedTime) / (1000 * 60 * 60 * 24);
  if (ageDays <= 30) return 30;
  if (ageDays <= 180) return 18;
  if (ageDays <= 365) return 10;
  return 0;
}

function chooseArticleAngle(
  topic: BlogResearchTopic,
  sources: BlogResearchSource[],
  existingPosts: BlogResearchExistingPost[],
) {
  const candidates = createArticleAngleCandidates(topic, sources);
  const recentAngles = getRecentAngles(existingPosts);

  for (const candidate of candidates) {
    if (!recentAngles.has(normalizeAngle(candidate))) {
      return candidate;
    }
  }

  const leadDomain = sources[0]?.domain ?? "current market research";
  return `${candidates[0]} with a fresh ${leadDomain} research lens for ${getUtcDateSuffix()}`;
}

function createArticleAngleCandidates(
  topic: BlogResearchTopic,
  sources: BlogResearchSource[],
) {
  const normalizedValue = `${topic.category} ${topic.topic}`.toLowerCase();
  const leadSignal = extractLeadResearchSignal(sources);

  if (normalizedValue.includes("headline")) {
    return [
      `How professionals can write clearer LinkedIn headlines as ${leadSignal}`,
      "Why headline clarity matters more than keyword stuffing for professional positioning",
      "How managers and specialists can turn role, proof, and market value into a stronger headline",
    ];
  }

  if (normalizedValue.includes("about section")) {
    return [
      `How LinkedIn About sections can turn experience into trust as ${leadSignal}`,
      "Why professional storytelling needs proof, specificity, and a clear audience",
      "How to structure a LinkedIn About section around credibility and commercial value",
    ];
  }

  if (normalizedValue.includes("sales") || normalizedValue.includes("b2b")) {
    return [
      `Why B2B sales visibility depends on trust signals as ${leadSignal}`,
      "How sales leaders can make LinkedIn credibility visible without spammy outreach",
      "How B2B professionals can turn profile positioning into warmer business conversations",
    ];
  }

  if (normalizedValue.includes("ai")) {
    return [
      `How professionals can use AI on LinkedIn without losing credibility as ${leadSignal}`,
      "Why AI-assisted LinkedIn work still needs human judgment, proof, and positioning",
      "How AI can support profile clarity, content planning, and professional visibility",
    ];
  }

  if (
    normalizedValue.includes("industrial") ||
    normalizedValue.includes("engineer") ||
    normalizedValue.includes("automation")
  ) {
    return [
      `How industrial professionals can make complex expertise visible as ${leadSignal}`,
      "Why technical credibility needs clearer business translation on LinkedIn",
      "How engineers and industrial leaders can connect expertise to market outcomes",
    ];
  }

  if (normalizedValue.includes("career") || normalizedValue.includes("growth")) {
    return [
      `How clearer LinkedIn positioning supports career growth as ${leadSignal}`,
      "Why career opportunities depend on visible proof, not only experience",
      "How professionals can make their next role easier for the market to understand",
    ];
  }

  return [
    `How professionals can improve LinkedIn visibility as ${leadSignal}`,
    "Why authority on LinkedIn depends on clarity, consistency, and useful proof",
    "How professional positioning turns experience into recognizable market value",
  ];
}

function extractLeadResearchSignal(sources: BlogResearchSource[]) {
  const leadSource = sources[0];
  if (!leadSource) return "professional visibility expectations keep changing";

  const words = `${leadSource.title} ${leadSource.excerpt}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 5)
    .slice(0, 7);

  if (words.length < 3) return "professional visibility expectations keep changing";
  return `${words.slice(0, 5).join(" ")} keeps shaping buyer and career attention`;
}

function getRecentAngles(existingPosts: BlogResearchExistingPost[]) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Set(
    existingPosts
      .filter((post) => new Date(post.created_at).getTime() >= cutoff)
      .map((post) => normalizeAngle(post.article_angle ?? ""))
      .filter(Boolean),
  );
}

function createResearchSummary(
  topic: BlogResearchTopic,
  sources: BlogResearchSource[],
  articleAngle: string,
) {
  return [
    `Topic: ${topic.topic}`,
    `Category: ${topic.category}`,
    `Article angle: ${articleAngle}`,
    "Research signals:",
    ...sources.map((source, index) =>
      [
        `${index + 1}. ${source.title}`,
        `Domain: ${source.domain}`,
        source.publishedAt ? `Published: ${source.publishedAt}` : "Published: not provided",
        `Insight context: ${source.excerpt}`,
      ].join(" | "),
    ),
  ].join("\n");
}

function addUniqueResearchSources(
  target: BlogResearchSource[],
  sources: BlogResearchSource[],
) {
  const knownUrls = new Set(target.map((source) => source.url));

  for (const source of sources) {
    if (knownUrls.has(source.url)) continue;
    target.push(source);
    knownUrls.add(source.url);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEARCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extractXmlTag(value: string, tag: string) {
  const match = value.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeHtmlEntities(match?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, "") ?? "").trim();
}

function extractMetaDescription(html: string) {
  const match = html.match(
    /<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  );
  return decodeHtmlEntities(match?.[1] ?? "");
}

function htmlToReadableText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "));
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function cleanText(value: string, maxLength: number) {
  return cleanWhitespace(value).slice(0, maxLength);
}

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeResearchUrl(value: string) {
  try {
    const url = new URL(value.trim());
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ].forEach((parameter) => url.searchParams.delete(parameter));
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function getDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function parsePublishedDate(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
}

function shouldSkipResearchDomain(domain: string) {
  return (
    domain.includes("bing.com") ||
    domain.includes("google.com/search") ||
    domain.includes("youtube.com") ||
    domain.includes("facebook.com") ||
    domain.includes("x.com") ||
    domain.includes("twitter.com") ||
    domain.includes("reddit.com")
  );
}

function normalizeAngle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMarkdown(content: string) {
  return content
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/[`*_>#-]/g, " ");
}

function countWords(value: string) {
  return value.split(/\s+/).filter((word) => /[a-z0-9]/i.test(word)).length;
}

function countNonUtilitySections(content: string) {
  return (content.match(/^##\s+(.+)$/gm) ?? [])
    .map((heading) => heading.replace(/^##\s+/, "").trim().toLowerCase())
    .filter(
      (heading) =>
        ![
          "faq",
          "improve your linkedin presence",
          "further reading",
        ].includes(heading),
    ).length;
}

function countPracticalRecommendations(content: string) {
  const beforeCta = content.split(/^##\s+Improve Your LinkedIn Presence/im)[0] ?? content;
  return (beforeCta.match(/^[-*]\s+/gm) ?? []).length;
}

function hasRawUrlInsideParagraph(content: string) {
  return content.split(/\r?\n/).some((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || /^#{1,3}\s+/.test(trimmedLine) || /^[-*]\s+/.test(trimmedLine)) {
      return false;
    }

    const withoutMarkdownLinks = trimmedLine.replace(
      /\[[^\]]+\]\(https?:\/\/[^)]+\)/g,
      "",
    );
    return /https?:\/\//i.test(withoutMarkdownLinks);
  });
}

function hasRequiredInternalCtaLinks(content: string) {
  return ["/assessment", "/headline-generator", "/about-generator"].every((path) =>
    content.includes(`](${path})`),
  );
}

function getUtcDateSuffix() {
  return new Date().toISOString().slice(0, 10);
}
