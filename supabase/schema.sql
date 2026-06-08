create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  user_key text unique not null,
  email text not null,
  linkedin_url text,
  normalized_email text not null,
  normalized_linkedin_url text,
  is_admin boolean not null default false,
  plan_type text not null default 'free',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text not null,
  pdf_storage_path text,
  pdf_file_name text,
  pdf_file_size integer,
  extracted_text text,
  extracted_character_count integer,
  authority_score integer,
  assessment_confidence text,
  market_position text,
  core_positioning text,
  professional_archetype jsonb,
  positioning_snapshot jsonb,
  what_makes_unique text,
  score_breakdown jsonb,
  positioning_gap jsonb,
  top_competencies jsonb,
  expertise_domains jsonb,
  authority_growth_areas jsonb,
  profile_improvements jsonb,
  visibility_gaps jsonb,
  share_text text,
  ai_response jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.usage_limits (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  period_start date not null,
  period_end date not null,
  assessment_count integer not null default 0,
  plan_type text not null default 'free',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_key, period_start, period_end)
);

create table if not exists public.assessment_feedback (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  user_key text not null,
  feedback_type text not null check (feedback_type in ('positive', 'negative')),
  feedback_text text,
  created_at timestamp with time zone not null default now(),
  constraint assessment_feedback_negative_text_check
    check (feedback_type <> 'negative' or nullif(trim(feedback_text), '') is not null)
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text,
  name text,
  email text not null,
  linkedin_url text,
  professional_role text,
  seniority_level text,
  current_company text,
  location text,
  industries jsonb not null default '[]'::jsonb,
  sub_industries jsonb not null default '[]'::jsonb,
  interests jsonb not null default '[]'::jsonb,
  top_skills jsonb not null default '[]'::jsonb,
  expertise_domains jsonb not null default '[]'::jsonb,
  business_goals jsonb not null default '[]'::jsonb,
  professional_identity jsonb not null default '[]'::jsonb,
  writing_preferences jsonb not null default '[]'::jsonb,
  desired_perception text,
  professional_archetype jsonb,
  latest_authority_score integer,
  latest_assessment_id uuid,
  last_assessment_date timestamptz,
  headline_generator_inputs jsonb,
  headline_generator_outputs jsonb,
  about_generator_inputs jsonb,
  about_generator_outputs jsonb,
  article_generator_inputs jsonb,
  article_generator_outputs jsonb,
  profile_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.about_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text,
  email text not null,
  name text,
  inputs jsonb not null,
  outputs jsonb not null,
  selected_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.article_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text,
  email text not null,
  topic text,
  inputs jsonb,
  outputs jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text,
  excerpt text,
  category text,
  content text,
  hero_image_prompt text,
  hero_image_url text,
  research_sources jsonb,
  research_summary text,
  article_angle text,
  seo_title text,
  seo_description text,
  published boolean not null default true,
  auto_generated boolean not null default true,
  author_name text not null default 'INConnect Editorial',
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.intelligence_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  user_key text,
  name text,
  email text,
  intelligence_type text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists users_user_key_idx on public.users (user_key);
create index if not exists users_normalized_email_idx on public.users (normalized_email);
create index if not exists assessments_user_key_created_at_idx
  on public.assessments (user_key, created_at desc);
create index if not exists usage_limits_user_key_period_idx
  on public.usage_limits (user_key, period_start, period_end);
create unique index if not exists assessment_feedback_assessment_id_idx
  on public.assessment_feedback (assessment_id);
create index if not exists assessment_feedback_user_key_created_at_idx
  on public.assessment_feedback (user_key, created_at desc);
create unique index if not exists user_profiles_email_idx
  on public.user_profiles (email);
create index if not exists user_profiles_user_key_idx
  on public.user_profiles (user_key);
create index if not exists user_profiles_user_id_idx
  on public.user_profiles (user_id);
create index if not exists about_generations_user_key_created_at_idx
  on public.about_generations (user_key, created_at desc);
create index if not exists about_generations_email_created_at_idx
  on public.about_generations (email, created_at desc);
create index if not exists article_generations_user_key_created_at_idx
  on public.article_generations (user_key, created_at desc);
create index if not exists article_generations_email_created_at_idx
  on public.article_generations (email, created_at desc);
create unique index if not exists blog_posts_slug_idx
  on public.blog_posts (slug);
create index if not exists blog_posts_published_published_at_idx
  on public.blog_posts (published, published_at desc);
create index if not exists blog_posts_auto_generated_created_at_idx
  on public.blog_posts (auto_generated, created_at desc);
create index if not exists intelligence_subscriptions_email_idx
  on public.intelligence_subscriptions (email);
create index if not exists intelligence_subscriptions_user_key_idx
  on public.intelligence_subscriptions (user_key);
create index if not exists intelligence_subscriptions_type_idx
  on public.intelligence_subscriptions (intelligence_type);

insert into storage.buckets (id, name, public)
values ('profile-pdfs', 'profile-pdfs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update
set public = true;
