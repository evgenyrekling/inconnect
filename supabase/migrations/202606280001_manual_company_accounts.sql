alter table public.accounts
  add column if not exists company_type text,
  add column if not exists industry text,
  add column if not exists description text,
  add column if not exists created_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists created_by_email text;

create index if not exists accounts_company_type_idx
  on public.accounts (company_type);

create index if not exists accounts_industry_idx
  on public.accounts (industry);

create index if not exists accounts_created_by_email_idx
  on public.accounts (created_by_email)
  where created_by_email is not null;

notify pgrst, 'reload schema';
