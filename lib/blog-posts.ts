export type BlogPost = {
  author: string;
  category: string;
  content: Array<{
    heading: string;
    paragraphs: string[];
  }>;
  date: string;
  excerpt: string;
  featured: boolean;
  slug: string;
  title: string;
};

export const blogPosts: BlogPost[] = [
  {
    author: "INConnect Editorial",
    category: "LinkedIn",
    date: "June 6, 2026",
    excerpt:
      "A practical starting point for writing a LinkedIn headline that communicates role, expertise, and market value without keyword stuffing.",
    featured: true,
    slug: "how-to-write-linkedin-headline",
    title: "How to Write a LinkedIn Headline",
    content: [
      {
        heading: "Start With Positioning",
        paragraphs: [
          "A strong LinkedIn headline is not just a job title. It should tell people what you do, who you help, and what professional value you are known for.",
          "For now, this demo article uses placeholder content while the INConnect blog system is being prepared for full editorial publishing.",
        ],
      },
      {
        heading: "Keep It Specific",
        paragraphs: [
          "The best headlines are concise, specific, and easy to understand at a glance. Combine your role, industry context, and core expertise in a way that sounds human.",
          "Avoid adding your name, too many buzzwords, or a long list of disconnected skills.",
        ],
      },
    ],
  },
  {
    author: "INConnect Editorial",
    category: "Industrial Professionals",
    date: "June 6, 2026",
    excerpt:
      "Industrial professionals can use LinkedIn to make operational expertise, technical credibility, and market knowledge easier to recognize.",
    featured: true,
    slug: "personal-branding-industrial-professionals",
    title: "Personal Branding for Industrial Professionals",
    content: [
      {
        heading: "Make Expertise Visible",
        paragraphs: [
          "Industrial experience is often deep, practical, and highly valuable, but it can be difficult to communicate clearly on a public profile.",
          "This placeholder article introduces the direction of the INConnect blog: helping professionals turn complex expertise into clear positioning.",
        ],
      },
      {
        heading: "Connect Work to Outcomes",
        paragraphs: [
          "A stronger personal brand connects technical work to business outcomes such as reliability, efficiency, safety, growth, and innovation.",
          "That connection helps peers, customers, recruiters, and partners understand why your experience matters.",
        ],
      },
    ],
  },
  {
    author: "INConnect Editorial",
    category: "Leadership",
    date: "June 6, 2026",
    excerpt:
      "Authority on LinkedIn grows when your profile, content, and professional signals consistently reinforce a clear market position.",
    featured: false,
    slug: "how-to-build-authority-on-linkedin",
    title: "How to Build Authority on LinkedIn",
    content: [
      {
        heading: "Authority Comes From Consistency",
        paragraphs: [
          "LinkedIn authority is built through repeated signals: a clear profile, relevant expertise, credible proof, and useful contributions to your professional market.",
          "This demo article is placeholder content for Blog V1 and will later be replaced with deeper guidance.",
        ],
      },
      {
        heading: "Turn Experience Into Signals",
        paragraphs: [
          "Your headline, About section, experience descriptions, and content topics should all support the same professional story.",
          "When those elements work together, visitors can quickly understand what you stand for and why they should pay attention.",
        ],
      },
    ],
  },
];

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

export function getFeaturedBlogPosts() {
  return blogPosts.filter((post) => post.featured);
}

export function getLatestBlogPosts() {
  return [...blogPosts].sort((left, right) => {
    return new Date(right.date).getTime() - new Date(left.date).getTime();
  });
}
