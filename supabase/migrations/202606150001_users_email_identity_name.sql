alter table public.users
  add column if not exists name text;

update public.users u
set name = up.name
from public.user_profiles up
where u.id = up.user_id
  and u.name is null
  and up.name is not null;

create unique index if not exists users_normalized_email_unique_idx
  on public.users(normalized_email)
  where normalized_email is not null;

notify pgrst, 'reload schema';
