alter table public.public_profiles
  add column if not exists professional_email text,
  add column if not exists normalized_professional_email text;

create index if not exists public_profiles_normalized_professional_email_idx
  on public.public_profiles (normalized_professional_email)
  where normalized_professional_email is not null;

create table if not exists public.professional_invitations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references public.public_profiles(id) on delete cascade,
  owner_user_id uuid references public.users(id) on delete cascade,
  professional_email text not null,
  normalized_professional_email text not null,
  invitation_token text unique not null,
  status text default 'sent',
  sent_at timestamptz,
  claimed_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists professional_invitations_professional_id_idx
  on public.professional_invitations (professional_id);

create index if not exists professional_invitations_owner_user_id_idx
  on public.professional_invitations (owner_user_id);

create index if not exists professional_invitations_normalized_email_idx
  on public.professional_invitations (normalized_professional_email);

create index if not exists professional_invitations_recent_idx
  on public.professional_invitations (owner_user_id, normalized_professional_email, sent_at desc);

create table if not exists public.professional_invitation_events (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.professional_invitations(id) on delete cascade,
  event_type text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists professional_invitation_events_invitation_id_idx
  on public.professional_invitation_events (invitation_id);

alter table public.professional_invitations enable row level security;
alter table public.professional_invitation_events enable row level security;

drop policy if exists "professional_invitations_owner_select" on public.professional_invitations;
create policy "professional_invitations_owner_select"
  on public.professional_invitations
  for select
  to authenticated
  using (
    owner_user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(normalized_professional_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_invitations_owner_update" on public.professional_invitations;
create policy "professional_invitations_owner_update"
  on public.professional_invitations
  for update
  to authenticated
  using (
    owner_user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(normalized_professional_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    owner_user_id in (
      select id
      from public.users
      where supabase_auth_user_id = auth.uid()
        or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or lower(normalized_professional_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

notify pgrst, 'reload schema';
