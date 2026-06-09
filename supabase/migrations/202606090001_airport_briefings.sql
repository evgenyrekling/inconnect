create table if not exists public.airport_briefings (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text,
  excerpt text,
  content text,
  hero_image_url text,
  hero_image_prompt text,
  seo_title text,
  seo_description text,
  published boolean default true,
  generated_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.airport_briefings
  add column if not exists slug text,
  add column if not exists title text,
  add column if not exists excerpt text,
  add column if not exists content text,
  add column if not exists hero_image_url text,
  add column if not exists hero_image_prompt text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists published boolean default true,
  add column if not exists generated_at timestamptz default now(),
  add column if not exists created_at timestamptz default now();

create unique index if not exists airport_briefings_slug_idx
  on public.airport_briefings(slug);

create index if not exists airport_briefings_published_generated_at_idx
  on public.airport_briefings(published, generated_at desc);

insert into storage.buckets (id, name, public)
values ('airport-briefing-images', 'airport-briefing-images', true)
on conflict (id) do update
set public = true;

notify pgrst, 'reload schema';
