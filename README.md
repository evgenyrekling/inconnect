# INConnect Freemium SaaS Prototype

INConnect is an AI LinkedIn Growth Assistant for professionals and companies
that want clearer LinkedIn authority, trend relevance, and content direction.

## Included

- Next.js App Router project with TypeScript and Tailwind CSS
- Premium SaaS landing page and official INConnect falcon brand assets
- Assessment form with LinkedIn profile URL, email address, and optional pasted LinkedIn profile text
- `POST /api/analyze-profile` authority scoring route
- OpenAI structured JSON analysis when profile text is provided
- Clear prompt to paste LinkedIn About section or recent content when profile text is empty
- Authority scoring across professional clarity, industry positioning, authority potential, thought leadership potential, market relevance, content opportunity, trend alignment, niche strength, expertise differentiation, and visibility potential
- Shareable LinkedIn Authority Score card and generated share text
- AI-generated strengths, visibility gaps, authority topics, content directions, and future positioning angles
- Free and Pro pricing section
- Future integration placeholders for Supabase, Stripe, trend feeds, and accounts
- Responsive layout ready for Vercel deployment

## Environment

Create `.env.local` from `.env.example` and add your OpenAI API key:

```bash
OPENAI_API_KEY=sk-...
```

Optional:

```bash
OPENAI_MODEL=gpt-5.5
```

## Local development

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js.

## Verification

```bash
npm run typecheck
npm run build
```

Vercel can deploy the repository with the default Next.js preset. Add
`OPENAI_API_KEY` in Vercel project environment variables before using real
profile-text analysis in production.
