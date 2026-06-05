alter table public.users
  alter column linkedin_url drop not null,
  alter column normalized_linkedin_url drop not null;

create index if not exists users_normalized_email_idx
  on public.users (normalized_email);

notify pgrst, 'reload schema';
