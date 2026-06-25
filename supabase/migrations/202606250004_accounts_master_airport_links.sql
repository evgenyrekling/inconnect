alter table public.accounts
add column if not exists website text;

alter table public.accounts
add column if not exists linkedin_url text;

create index if not exists accounts_website_idx
  on public.accounts (website)
  where website is not null;

create index if not exists accounts_linkedin_url_idx
  on public.accounts (linkedin_url)
  where linkedin_url is not null;

comment on column public.accounts.website is
  'Account website URL imported from master account data.';

comment on column public.accounts.linkedin_url is
  'Account LinkedIn URL imported from master account data.';

notify pgrst, 'reload schema';
