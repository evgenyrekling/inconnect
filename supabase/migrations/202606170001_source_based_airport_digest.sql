alter table public.airport_briefings
add column if not exists source_name text;

alter table public.airport_briefings
add column if not exists source_url text;

alter table public.airport_briefings
add column if not exists source_domain text;

alter table public.airport_briefings
add column if not exists source_image_url text;

alter table public.airport_briefings
add column if not exists source_image_domain text;

alter table public.airport_briefings
add column if not exists image_attribution text;

alter table public.airport_briefings
add column if not exists summary text;

alter table public.airport_briefings
add column if not exists inconnect_view text;

alter table public.airport_briefings
add column if not exists reading_time text default '1 Minute Read';

alter table public.airport_briefings
add column if not exists is_source_based boolean default true;

alter table public.airport_briefings
add column if not exists sent_at timestamptz;

create index if not exists airport_briefings_source_url_idx
  on public.airport_briefings(source_url);

create index if not exists airport_briefings_sent_at_idx
  on public.airport_briefings(sent_at);

create index if not exists airport_briefings_is_source_based_idx
  on public.airport_briefings(is_source_based);

notify pgrst, 'reload schema';
