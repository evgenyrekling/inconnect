alter table public.airport_briefings
  add column if not exists research_sources jsonb default '[]'::jsonb,
  add column if not exists research_summary text,
  add column if not exists published_at timestamptz;

notify pgrst, 'reload schema';
