create table if not exists public.airport_briefings (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text,
  airport_name text,
  category text,
  excerpt text,
  content text,
  hero_image_url text,
  hero_image_prompt text,
  source_name text,
  source_url text,
  source_domain text,
  source_image_url text,
  source_image_domain text,
  image_attribution text,
  keywords jsonb default '[]'::jsonb,
  research_sources jsonb default '[]'::jsonb,
  research_summary text,
  summary text,
  inconnect_view text,
  reading_time text default '1 Minute Read',
  is_source_based boolean default true,
  quality_score integer,
  status text default 'published',
  is_draft_candidate boolean default false,
  auto_send_allowed boolean default false,
  quality_rejection_reason text,
  source_url_type text,
  seo_title text,
  seo_description text,
  published boolean default true,
  published_at timestamptz,
  sent_at timestamptz,
  generated_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.airport_briefings
  add column if not exists slug text,
  add column if not exists title text,
  add column if not exists airport_name text,
  add column if not exists category text,
  add column if not exists excerpt text,
  add column if not exists content text,
  add column if not exists hero_image_url text,
  add column if not exists hero_image_prompt text,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists source_domain text,
  add column if not exists source_image_url text,
  add column if not exists source_image_domain text,
  add column if not exists image_attribution text,
  add column if not exists keywords jsonb default '[]'::jsonb,
  add column if not exists research_sources jsonb default '[]'::jsonb,
  add column if not exists research_summary text,
  add column if not exists summary text,
  add column if not exists inconnect_view text,
  add column if not exists reading_time text default '1 Minute Read',
  add column if not exists is_source_based boolean default true,
  add column if not exists quality_score integer,
  add column if not exists status text default 'published',
  add column if not exists is_draft_candidate boolean default false,
  add column if not exists auto_send_allowed boolean default false,
  add column if not exists quality_rejection_reason text,
  add column if not exists source_url_type text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists published boolean default true,
  add column if not exists published_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists generated_at timestamptz default now(),
  add column if not exists created_at timestamptz default now();

create table if not exists public.airport_daily_candidates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text not null,
  source_name text,
  source_image_url text,
  category text,
  notes text,
  status text default 'pending',
  priority text default 'medium',
  selected_for_digest boolean default false,
  used_at timestamptz,
  created_by_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.airport_daily_candidates
  add column if not exists title text,
  add column if not exists source_url text,
  add column if not exists source_name text,
  add column if not exists source_image_url text,
  add column if not exists category text,
  add column if not exists notes text,
  add column if not exists status text default 'pending',
  add column if not exists priority text default 'medium',
  add column if not exists selected_for_digest boolean default false,
  add column if not exists used_at timestamptz,
  add column if not exists created_by_email text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists airport_briefings_slug_idx
  on public.airport_briefings(slug);

create index if not exists airport_briefings_published_generated_at_idx
  on public.airport_briefings(published, generated_at desc);

create index if not exists airport_briefings_category_generated_at_idx
  on public.airport_briefings(category, generated_at desc);

create index if not exists airport_briefings_source_url_idx
  on public.airport_briefings(source_url);

create index if not exists airport_briefings_sent_at_idx
  on public.airport_briefings(sent_at);

create index if not exists airport_briefings_is_source_based_idx
  on public.airport_briefings(is_source_based);

create index if not exists airport_briefings_status_generated_at_idx
  on public.airport_briefings(status, generated_at desc);

create index if not exists airport_briefings_auto_send_allowed_idx
  on public.airport_briefings(auto_send_allowed);

create index if not exists airport_daily_candidates_status_idx
  on public.airport_daily_candidates(status);

create index if not exists airport_daily_candidates_priority_idx
  on public.airport_daily_candidates(priority);

notify pgrst, 'reload schema';
