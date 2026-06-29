alter table public.public_profiles
  add column if not exists profile_type text default 'professional';

update public.public_profiles
set profile_type = 'professional'
where profile_type is null;

create index if not exists public_profiles_profile_type_idx
  on public.public_profiles (profile_type);

create unique index if not exists public_profiles_owner_professional_email_unique_idx
  on public.public_profiles (
    (coalesce(owner_user_id::text, lower(owner_email))),
    normalized_professional_email
  )
  where normalized_professional_email is not null
    and (owner_user_id is not null or owner_email is not null)
    and profile_type = 'professional';

notify pgrst, 'reload schema';
