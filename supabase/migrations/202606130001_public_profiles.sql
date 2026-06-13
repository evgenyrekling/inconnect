create table if not exists public.public_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  user_key text,
  slug text unique not null,
  display_name text,
  headline text,
  location text,
  company text,
  professional_role text,
  owner_normalized_email text,
  summary text,
  industries jsonb default '[]'::jsonb,
  expertise jsonb default '[]'::jsonb,
  strengths jsonb default '[]'::jsonb,
  interests jsonb default '[]'::jsonb,
  professional_archetype jsonb,
  authority_score integer,
  sections jsonb,
  visibility text default 'unlisted',
  is_public boolean default false,
  owner_edit_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.public_profiles
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists user_key text,
  add column if not exists slug text,
  add column if not exists display_name text,
  add column if not exists headline text,
  add column if not exists location text,
  add column if not exists company text,
  add column if not exists professional_role text,
  add column if not exists owner_normalized_email text,
  add column if not exists summary text,
  add column if not exists industries jsonb default '[]'::jsonb,
  add column if not exists expertise jsonb default '[]'::jsonb,
  add column if not exists strengths jsonb default '[]'::jsonb,
  add column if not exists interests jsonb default '[]'::jsonb,
  add column if not exists professional_archetype jsonb,
  add column if not exists authority_score integer,
  add column if not exists sections jsonb,
  add column if not exists visibility text default 'unlisted',
  add column if not exists is_public boolean default false,
  add column if not exists owner_edit_token text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists public_profiles_slug_idx
  on public.public_profiles (slug);

create index if not exists public_profiles_user_id_idx
  on public.public_profiles (user_id);

create index if not exists public_profiles_user_key_idx
  on public.public_profiles (user_key);

create index if not exists public_profiles_owner_normalized_email_idx
  on public.public_profiles (owner_normalized_email);

create index if not exists public_profiles_visibility_idx
  on public.public_profiles (visibility);

create index if not exists public_profiles_is_public_idx
  on public.public_profiles (is_public);

comment on table public.public_profiles is
  'Foundation for INConnect Network: business matching, professional discovery, partner discovery, supplier discovery, expert search, mutual connections, and opportunity matching.';

notify pgrst, 'reload schema';
