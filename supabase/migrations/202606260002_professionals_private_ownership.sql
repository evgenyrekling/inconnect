alter table public.professional_company_links
  add column if not exists owner_user_id uuid references public.users(id) on delete cascade,
  add column if not exists owner_email text;

drop index if exists public.public_profiles_normalized_linkedin_url_unique_idx;

create unique index if not exists public_profiles_owner_linkedin_unique_idx
  on public.public_profiles (
    (coalesce(owner_user_id::text, lower(owner_email))),
    normalized_linkedin_url
  )
  where normalized_linkedin_url is not null
    and (owner_user_id is not null or owner_email is not null);

create index if not exists public_profiles_owner_user_id_idx
  on public.public_profiles (owner_user_id)
  where owner_user_id is not null;

create index if not exists public_profiles_owner_email_idx
  on public.public_profiles (owner_email)
  where owner_email is not null;

create index if not exists professional_company_links_owner_user_id_idx
  on public.professional_company_links (owner_user_id)
  where owner_user_id is not null;

create index if not exists professional_company_links_owner_email_idx
  on public.professional_company_links (owner_email)
  where owner_email is not null;

alter table public.accounts enable row level security;
alter table public.public_profiles enable row level security;
alter table public.professional_company_links enable row level security;

drop policy if exists "accounts_read_authenticated" on public.accounts;
create policy "accounts_read_authenticated"
  on public.accounts
  for select
  to authenticated
  using (true);

drop policy if exists "public_profiles_owner_select" on public.public_profiles;
create policy "public_profiles_owner_select"
  on public.public_profiles
  for select
  to authenticated
  using (
    is_public = true
    or owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "public_profiles_owner_insert" on public.public_profiles;
create policy "public_profiles_owner_insert"
  on public.public_profiles
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "public_profiles_owner_update" on public.public_profiles;
create policy "public_profiles_owner_update"
  on public.public_profiles
  for update
  to authenticated
  using (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_select" on public.professional_company_links;
create policy "professional_company_links_owner_select"
  on public.professional_company_links
  for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_insert" on public.professional_company_links;
create policy "professional_company_links_owner_insert"
  on public.professional_company_links
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_update" on public.professional_company_links;
create policy "professional_company_links_owner_update"
  on public.professional_company_links
  for update
  to authenticated
  using (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_delete" on public.professional_company_links;
create policy "professional_company_links_owner_delete"
  on public.professional_company_links
  for delete
  to authenticated
  using (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

notify pgrst, 'reload schema';
