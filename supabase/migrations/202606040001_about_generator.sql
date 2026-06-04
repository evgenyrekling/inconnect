create table if not exists public.about_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text,
  email text not null,
  name text,
  inputs jsonb not null,
  outputs jsonb not null,
  selected_version text,
  created_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists professional_identity jsonb not null default '[]'::jsonb,
  add column if not exists writing_preferences jsonb not null default '[]'::jsonb,
  add column if not exists about_generator_inputs jsonb,
  add column if not exists about_generator_outputs jsonb;

create index if not exists about_generations_user_key_created_at_idx
  on public.about_generations (user_key, created_at desc);

create index if not exists about_generations_email_created_at_idx
  on public.about_generations (email, created_at desc);

notify pgrst, 'reload schema';
