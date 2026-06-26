alter table public.users
  add column if not exists email_verified boolean default false,
  add column if not exists email_verified_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists auth_provider text default 'email_otp',
  add column if not exists supabase_auth_user_id uuid;

create unique index if not exists users_normalized_email_unique_idx
  on public.users (normalized_email)
  where normalized_email is not null;

create unique index if not exists users_supabase_auth_user_id_unique_idx
  on public.users (supabase_auth_user_id)
  where supabase_auth_user_id is not null;

alter table public.users enable row level security;
alter table public.accounts enable row level security;
alter table public.public_profiles enable row level security;
alter table public.professional_company_links enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "users_owner_select" on public.users;
create policy "users_owner_select"
  on public.users
  for select
  to authenticated
  using (
    supabase_auth_user_id = auth.uid()
    or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "users_owner_update" on public.users;
create policy "users_owner_update"
  on public.users
  for update
  to authenticated
  using (
    supabase_auth_user_id = auth.uid()
    or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    supabase_auth_user_id = auth.uid()
    or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

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
    visibility = 'public'
    or is_public = true
    or owner_user_id = auth.uid()
    or user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "public_profiles_owner_insert" on public.public_profiles;
create policy "public_profiles_owner_insert"
  on public.public_profiles
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    or user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "public_profiles_owner_update" on public.public_profiles;
create policy "public_profiles_owner_update"
  on public.public_profiles
  for update
  to authenticated
  using (
    owner_user_id = auth.uid()
    or user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    owner_user_id = auth.uid()
    or user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_select" on public.professional_company_links;
create policy "professional_company_links_owner_select"
  on public.professional_company_links
  for select
  to authenticated
  using (
    owner_user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_insert" on public.professional_company_links;
create policy "professional_company_links_owner_insert"
  on public.professional_company_links
  for insert
  to authenticated
  with check (
    owner_user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_update" on public.professional_company_links;
create policy "professional_company_links_owner_update"
  on public.professional_company_links
  for update
  to authenticated
  using (
    owner_user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    owner_user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_delete" on public.professional_company_links;
create policy "professional_company_links_owner_delete"
  on public.professional_company_links
  for delete
  to authenticated
  using (
    owner_user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "subscriptions_owner_select" on public.subscriptions;
create policy "subscriptions_owner_select"
  on public.subscriptions
  for select
  to authenticated
  using (
    user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "subscriptions_owner_update" on public.subscriptions;
create policy "subscriptions_owner_update"
  on public.subscriptions
  for update
  to authenticated
  using (
    user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

notify pgrst, 'reload schema';
