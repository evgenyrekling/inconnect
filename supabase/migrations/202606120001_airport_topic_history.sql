create table if not exists public.airport_topic_history (
  id uuid primary key default gen_random_uuid(),
  title text,
  topic text,
  category text,
  published_at timestamptz default now()
);

create index if not exists airport_topic_history_published_at_idx
  on public.airport_topic_history (published_at desc);

create index if not exists airport_topic_history_category_published_at_idx
  on public.airport_topic_history (category, published_at desc);

notify pgrst, 'reload schema';
