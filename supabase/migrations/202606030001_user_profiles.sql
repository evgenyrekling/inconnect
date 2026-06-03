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

alter table public.user_profiles
  add column if not exists user_id uuid references public.users(id),
  add column if not exists user_key text,
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists linkedin_url text,
  add column if not exists professional_role text,
  add column if not exists seniority_level text,
  add column if not exists current_company text,
  add column if not exists location text,
  add column if not exists industries jsonb not null default '[]'::jsonb,
  add column if not exists sub_industries jsonb not null default '[]'::jsonb,
  add column if not exists interests jsonb not null default '[]'::jsonb,
  add column if not exists top_skills jsonb not null default '[]'::jsonb,
  add column if not exists expertise_domains jsonb not null default '[]'::jsonb,
  add column if not exists business_goals jsonb not null default '[]'::jsonb,
  add column if not exists desired_perception text,
  add column if not exists professional_archetype jsonb,
  add column if not exists latest_authority_score integer,
  add column if not exists latest_assessment_id uuid,
  add column if not exists last_assessment_date timestamptz,
  add column if not exists headline_generator_inputs jsonb,
  add column if not exists headline_generator_outputs jsonb,
  add column if not exists profile_source text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_profiles
  alter column email set not null;

do $$
declare
  old_role_column text := 'current' || '_role';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = old_role_column
  ) then
    execute format(
      'update public.user_profiles set professional_role = coalesce(professional_role, %I)',
      old_role_column
    );
    execute format(
      'alter table public.user_profiles drop column if exists %I',
      old_role_column
    );
  end if;
end $$;

create unique index if not exists user_profiles_email_idx
  on public.user_profiles (email);

create index if not exists user_profiles_user_key_idx
  on public.user_profiles (user_key);

create index if not exists user_profiles_user_id_idx
  on public.user_profiles (user_id);

create index if not exists users_normalized_email_idx
  on public.users (normalized_email);
