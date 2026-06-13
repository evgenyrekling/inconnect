alter table public.public_profiles
  add column if not exists profile_photo_url text,
  add column if not exists profile_photo_storage_path text;

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update
set public = true;

notify pgrst, 'reload schema';
