create table if not exists public.article_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text,
  email text not null,
  topic text,
  inputs jsonb,
  outputs jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists article_generator_inputs jsonb,
  add column if not exists article_generator_outputs jsonb;

create index if not exists article_generations_user_key_created_at_idx
  on public.article_generations (user_key, created_at desc);

create index if not exists article_generations_email_created_at_idx
  on public.article_generations (email, created_at desc);

notify pgrst, 'reload schema';
