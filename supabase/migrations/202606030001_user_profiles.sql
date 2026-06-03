create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text,
  name text,
  email text not null,
  linkedin_url text,
  current_role text,
  seniority_level text,
  current_company text,
  location text,
  industries jsonb not null default '[]'::jsonb,
  sub_industries jsonb not null default '[]'::jsonb,
  interests jsonb not null default '[]'::jsonb,
  top_skills jsonb not null default '[]'::jsonb,
  expertise_domains jsonb not null default '[]'::jsonb,
  business_goals jsonb not null default '[]'::jsonb,
  desired_perception text,
  professional_archetype jsonb,
  latest_authority_score integer,
  latest_assessment_id uuid,
  last_assessment_date timestamptz,
  headline_generator_inputs jsonb,
  headline_generator_outputs jsonb,
  profile_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  alter column linkedin_url drop not null,
  alter column normalized_linkedin_url drop not null;

create unique index if not exists user_profiles_email_idx
  on public.user_profiles (email);

create index if not exists user_profiles_user_key_idx
  on public.user_profiles (user_key);

create index if not exists user_profiles_user_id_idx
  on public.user_profiles (user_id);

create index if not exists users_normalized_email_idx
  on public.users (normalized_email);
