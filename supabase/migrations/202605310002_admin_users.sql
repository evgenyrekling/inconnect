alter table public.users
add column if not exists is_admin boolean default false;
