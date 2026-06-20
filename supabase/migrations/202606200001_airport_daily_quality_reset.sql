alter table public.airport_briefings
add column if not exists quality_score integer;

alter table public.airport_briefings
add column if not exists status text default 'published';

alter table public.airport_briefings
add column if not exists is_draft_candidate boolean default false;

alter table public.airport_briefings
add column if not exists auto_send_allowed boolean default false;

alter table public.airport_briefings
add column if not exists quality_rejection_reason text;

alter table public.airport_briefings
add column if not exists source_url_type text;

update public.airport_briefings
set
  status = case when published then coalesce(nullif(status, ''), 'published') else 'draft_candidate' end,
  is_draft_candidate = coalesce(is_draft_candidate, false),
  auto_send_allowed = coalesce(auto_send_allowed, false)
where status is null
   or status = 'published'
   or is_draft_candidate is null
   or auto_send_allowed is null;

update public.airport_briefings
set
  published = false,
  published_at = null,
  status = 'rejected',
  is_draft_candidate = false,
  auto_send_allowed = false,
  quality_score = coalesce(quality_score, 0),
  source_url_type = 'directory',
  quality_rejection_reason = 'Directory/index page source rejected by Airport Daily quality reset.'
where title = 'Overview of Company Categories in Airport Technology'
   or source_url = 'https://www.airport-technology.com/projects-a-z/';

create index if not exists airport_briefings_status_generated_at_idx
  on public.airport_briefings(status, generated_at desc);

create index if not exists airport_briefings_auto_send_allowed_idx
  on public.airport_briefings(auto_send_allowed);

notify pgrst, 'reload schema';
