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

create index if not exists airport_daily_candidates_status_idx
on public.airport_daily_candidates(status);

create index if not exists airport_daily_candidates_priority_idx
on public.airport_daily_candidates(priority);

notify pgrst, 'reload schema';
