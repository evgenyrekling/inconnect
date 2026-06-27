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
  add column if not exists linkedin_url text,
  add column if not exists normalized_linkedin_url text,
  add column if not exists professional_email text,
  add column if not exists normalized_professional_email text,
  add column if not exists location text,
  add column if not exists company text,
  add column if not exists professional_role text,
  add column if not exists current_title text,
  add column if not exists current_company text,
  add column if not exists industry text,
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
  add column if not exists profile_photo_url text,
  add column if not exists profile_photo_storage_path text,
  add column if not exists profile_image_url text,
  add column if not exists source text default 'linkedin_url',
  add column if not exists owner_user_id uuid references public.users(id) on delete set null,
  add column if not exists owner_email text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists public_profiles_slug_idx
  on public.public_profiles (slug);

create index if not exists public_profiles_user_id_idx
  on public.public_profiles (user_id);

create index if not exists public_profiles_user_key_idx
  on public.public_profiles (user_key);

create index if not exists public_profiles_visibility_idx
  on public.public_profiles (visibility);

create index if not exists public_profiles_is_public_idx
  on public.public_profiles (is_public);

create index if not exists public_profiles_linkedin_url_idx
  on public.public_profiles (linkedin_url)
  where linkedin_url is not null;

create index if not exists public_profiles_normalized_professional_email_idx
  on public.public_profiles (normalized_professional_email)
  where normalized_professional_email is not null;

do $$
begin
  if not exists (
    select 1
    from (
      select
        coalesce(owner_user_id::text, lower(owner_email)) as owner_key,
        normalized_linkedin_url
      from public.public_profiles
      where normalized_linkedin_url is not null
        and (owner_user_id is not null or owner_email is not null)
      group by 1, 2
      having count(*) > 1
    ) duplicates
  ) then
    create unique index if not exists public_profiles_owner_linkedin_unique_idx
      on public.public_profiles (
        (coalesce(owner_user_id::text, lower(owner_email))),
        normalized_linkedin_url
      )
      where normalized_linkedin_url is not null
        and (owner_user_id is not null or owner_email is not null);
  else
    raise notice 'Skipped public_profiles_owner_linkedin_unique_idx because duplicate owner/linkedin rows already exist.';
  end if;
end $$;

create index if not exists public_profiles_owner_user_id_idx
  on public.public_profiles (owner_user_id)
  where owner_user_id is not null;

create index if not exists public_profiles_owner_email_idx
  on public.public_profiles (owner_email)
  where owner_email is not null;

notify pgrst, 'reload schema';
