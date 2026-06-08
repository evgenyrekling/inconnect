create table if not exists public.intelligence_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  user_key text,
  name text,
  email text,
  intelligence_type text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists intelligence_subscriptions_email_idx
  on public.intelligence_subscriptions(email);

create index if not exists intelligence_subscriptions_user_key_idx
  on public.intelligence_subscriptions(user_key);

create index if not exists intelligence_subscriptions_type_idx
  on public.intelligence_subscriptions(intelligence_type);

notify pgrst, 'reload schema';
