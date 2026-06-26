create table if not exists public.airport_email_delivery_log (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid references public.airport_briefings(id) on delete set null,
  recipient_email text,
  status text not null,
  provider text default 'resend',
  provider_message_id text,
  error_message text,
  sent_at timestamptz default now()
);

create index if not exists airport_email_delivery_log_briefing_id_idx
  on public.airport_email_delivery_log(briefing_id);

create index if not exists airport_email_delivery_log_recipient_email_idx
  on public.airport_email_delivery_log(recipient_email);

create index if not exists airport_email_delivery_log_status_idx
  on public.airport_email_delivery_log(status);

create index if not exists airport_email_delivery_log_sent_at_idx
  on public.airport_email_delivery_log(sent_at desc);

notify pgrst, 'reload schema';
