alter table public.airport_briefings
  add column if not exists category text,
  add column if not exists keywords jsonb default '[]'::jsonb,
  add column if not exists airport_name text,
  add column if not exists reading_time text default '1 Minute Read';

alter table public.airport_topic_history
  add column if not exists keywords jsonb default '[]'::jsonb,
  add column if not exists airport_name text;

create index if not exists airport_briefings_category_generated_at_idx
  on public.airport_briefings(category, generated_at desc);

create index if not exists airport_topic_history_airport_name_published_at_idx
  on public.airport_topic_history(airport_name, published_at desc);

notify pgrst, 'reload schema';
