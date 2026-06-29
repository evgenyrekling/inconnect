alter table public.accounts
  add column if not exists normalized_name text,
  add column if not exists normalized_website_domain text;

create index if not exists accounts_normalized_name_idx
  on public.accounts (normalized_name)
  where normalized_name is not null;

create index if not exists accounts_normalized_website_domain_idx
  on public.accounts (normalized_website_domain)
  where normalized_website_domain is not null;

alter table public.public_profiles
  add column if not exists phone text,
  add column if not exists experience_summary text,
  add column if not exists education_summary text,
  add column if not exists skills jsonb default '[]'::jsonb,
  add column if not exists notes text;

create index if not exists public_profiles_phone_idx
  on public.public_profiles (phone)
  where phone is not null;

notify pgrst, 'reload schema';
