create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  email text not null,
  digest_type text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint subscriptions_digest_type_check
    check (
      digest_type in (
        'airport_automation_daily',
        'linkedin_daily',
        'smart_mobility_daily',
        'industrial_automation_daily'
      )
    )
);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions(user_id);

create index if not exists subscriptions_email_idx
  on public.subscriptions(email);

create index if not exists subscriptions_digest_type_idx
  on public.subscriptions(digest_type);

create index if not exists subscriptions_is_active_idx
  on public.subscriptions(is_active);

create unique index if not exists subscriptions_email_digest_type_unique_idx
  on public.subscriptions(lower(email), digest_type);

notify pgrst, 'reload schema';
