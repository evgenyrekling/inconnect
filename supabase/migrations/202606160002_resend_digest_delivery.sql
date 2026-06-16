alter table public.subscriptions
add column if not exists unsubscribe_token text;

alter table public.subscriptions
add column if not exists unsubscribed_at timestamptz;

create unique index if not exists subscriptions_unsubscribe_token_unique_idx
  on public.subscriptions(unsubscribe_token)
  where unsubscribe_token is not null;

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  digest_type text not null,
  email text not null,
  briefing_id uuid,
  status text not null default 'sent',
  resend_email_id text,
  error_message text,
  sent_at timestamptz default now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists email_deliveries_subscription_id_idx
  on public.email_deliveries(subscription_id);

create index if not exists email_deliveries_digest_type_idx
  on public.email_deliveries(digest_type);

create index if not exists email_deliveries_email_idx
  on public.email_deliveries(email);

create index if not exists email_deliveries_status_idx
  on public.email_deliveries(status);

create index if not exists email_deliveries_sent_at_idx
  on public.email_deliveries(sent_at desc);

create index if not exists email_deliveries_resend_email_id_idx
  on public.email_deliveries(resend_email_id);

notify pgrst, 'reload schema';
