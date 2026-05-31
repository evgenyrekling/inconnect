create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  user_key text unique not null,
  email text not null,
  linkedin_url text not null,
  normalized_email text,
  normalized_linkedin_url text,
  is_admin boolean default false,
  plan_type text default 'free',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text,
  pdf_storage_path text,
  pdf_file_name text,
  pdf_file_size integer,
  extracted_text text,
  extracted_character_count integer,
  authority_score integer,
  assessment_confidence text,
  market_position text,
  core_positioning text,
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
  created_at timestamptz default now()
);

create table if not exists public.usage_limits (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  period_start date,
  period_end date,
  assessment_count integer default 0,
  plan_type text default 'free',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists users_user_key_idx
  on public.users (user_key);

create index if not exists assessments_user_key_idx
  on public.assessments (user_key);

create index if not exists usage_limits_user_key_idx
  on public.usage_limits (user_key);

create unique index if not exists usage_limits_user_key_period_idx
  on public.usage_limits (user_key, period_start, period_end);
