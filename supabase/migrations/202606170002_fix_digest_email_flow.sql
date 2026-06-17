alter table public.subscriptions
add column if not exists normalized_email text;

alter table public.subscriptions
add column if not exists name text;

update public.subscriptions
set normalized_email = lower(trim(email))
where normalized_email is null
  and email is not null;

create index if not exists subscriptions_normalized_email_idx
  on public.subscriptions(normalized_email);

alter table public.email_deliveries
add column if not exists content_id uuid;

alter table public.email_deliveries
add column if not exists content_type text;

update public.email_deliveries
set content_id = briefing_id
where content_id is null
  and briefing_id is not null;

update public.email_deliveries
set content_type = digest_type
where content_type is null
  and digest_type is not null;

create index if not exists email_deliveries_content_idx
  on public.email_deliveries(content_type, content_id);

create index if not exists email_deliveries_digest_content_email_idx
  on public.email_deliveries(digest_type, content_type, content_id, email);

notify pgrst, 'reload schema';
