alter table public.accounts
add column if not exists status text default 'prospect';

update public.accounts
set status = 'prospect'
where status is null;

create index if not exists accounts_status_idx
  on public.accounts (status);

create index if not exists accounts_airport_status_idx
  on public.accounts (status)
  where account_type = 'airport';

comment on column public.accounts.status is
  'Generic CRM account status. Supported values: support, prospect, customer, partner, competitor, inactive.';

notify pgrst, 'reload schema';
