alter table public.public_profiles
  add column if not exists linkedin_url text,
  add column if not exists normalized_linkedin_url text,
  add column if not exists current_title text,
  add column if not exists current_company text,
  add column if not exists industry text,
  add column if not exists profile_image_url text,
  add column if not exists source text default 'linkedin_url',
  add column if not exists owner_user_id uuid references public.users(id) on delete set null,
  add column if not exists owner_email text;

create index if not exists public_profiles_linkedin_url_idx
  on public.public_profiles (linkedin_url)
  where linkedin_url is not null;

create unique index if not exists public_profiles_normalized_linkedin_url_unique_idx
  on public.public_profiles (normalized_linkedin_url)
  where normalized_linkedin_url is not null;

create table if not exists public.professional_company_links (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.public_profiles(id) on delete cascade,
  company_id uuid not null references public.accounts(id) on delete cascade,
  relationship_type text default 'employee',
  title text,
  department text,
  seniority text,
  is_primary boolean default false,
  notes text,
  created_by_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists professional_company_links_unique_idx
  on public.professional_company_links (professional_id, company_id, relationship_type);

create index if not exists professional_company_links_professional_id_idx
  on public.professional_company_links (professional_id);

create index if not exists professional_company_links_company_id_idx
  on public.professional_company_links (company_id);

create index if not exists professional_company_links_relationship_type_idx
  on public.professional_company_links (relationship_type);

comment on table public.professional_company_links is
  'Foundation for linking professionals to company accounts for future business matchmaking, account mapping, opportunity discovery, and company network intelligence.';

notify pgrst, 'reload schema';
