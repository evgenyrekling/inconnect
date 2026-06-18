create table if not exists public.airport_daily_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text not null,
  source_type text,
  category text,
  priority text default 'medium',
  is_active boolean default true,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_successful_story_title text,
  last_successful_story_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists airport_daily_sources_active_idx
  on public.airport_daily_sources(is_active);

create index if not exists airport_daily_sources_priority_idx
  on public.airport_daily_sources(priority);

notify pgrst, 'reload schema';
