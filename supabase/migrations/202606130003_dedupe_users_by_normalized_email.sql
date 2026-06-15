alter table public.users
  add column if not exists normalized_email text;

update public.users
set normalized_email = lower(trim(email))
where email is not null
  and (normalized_email is null or normalized_email <> lower(trim(email)));

create temporary table if not exists tmp_inconnect_user_canonical as
with user_scores as (
  select
    u.id,
    u.user_key,
    u.normalized_email,
    (
      (select count(*) from public.public_profiles pp where pp.user_id = u.id or pp.user_key = u.user_key) +
      (select count(*) from public.user_profiles up where up.user_id = u.id or up.user_key = u.user_key) +
      (select count(*) from public.assessments a where a.user_id = u.id or a.user_key = u.user_key) +
      (select count(*) from public.about_generations ag where ag.user_id = u.id or ag.user_key = u.user_key) +
      (select count(*) from public.article_generations ar where ar.user_id = u.id or ar.user_key = u.user_key) +
      (select count(*) from public.intelligence_subscriptions ins where ins.user_id = u.id or ins.user_key = u.user_key)
    ) as history_count,
    row_number() over (
      partition by u.normalized_email
      order by
        (
          (select count(*) from public.public_profiles pp where pp.user_id = u.id or pp.user_key = u.user_key) +
          (select count(*) from public.user_profiles up where up.user_id = u.id or up.user_key = u.user_key) +
          (select count(*) from public.assessments a where a.user_id = u.id or a.user_key = u.user_key) +
          (select count(*) from public.about_generations ag where ag.user_id = u.id or ag.user_key = u.user_key) +
          (select count(*) from public.article_generations ar where ar.user_id = u.id or ar.user_key = u.user_key) +
          (select count(*) from public.intelligence_subscriptions ins where ins.user_id = u.id or ins.user_key = u.user_key)
        ) desc,
        u.updated_at desc nulls last,
        u.created_at desc nulls last
    ) as rank
  from public.users u
  where u.normalized_email is not null
)
select
  duplicate.id as duplicate_id,
  duplicate.user_key as duplicate_user_key,
  canonical.id as canonical_id,
  canonical.user_key as canonical_user_key,
  duplicate.normalized_email
from user_scores duplicate
join user_scores canonical
  on canonical.normalized_email = duplicate.normalized_email
 and canonical.rank = 1
where duplicate.rank > 1;

update public.assessments a
set user_id = c.canonical_id,
    user_key = c.canonical_user_key
from tmp_inconnect_user_canonical c
where a.user_id = c.duplicate_id
   or a.user_key = c.duplicate_user_key;

update public.user_profiles up
set user_id = c.canonical_id,
    user_key = c.canonical_user_key,
    email = c.normalized_email
from tmp_inconnect_user_canonical c
where up.user_id = c.duplicate_id
   or up.user_key = c.duplicate_user_key
   or lower(trim(up.email)) = c.normalized_email;

update public.about_generations ag
set user_id = c.canonical_id,
    user_key = c.canonical_user_key
from tmp_inconnect_user_canonical c
where ag.user_id = c.duplicate_id
   or ag.user_key = c.duplicate_user_key;

update public.article_generations ar
set user_id = c.canonical_id,
    user_key = c.canonical_user_key
from tmp_inconnect_user_canonical c
where ar.user_id = c.duplicate_id
   or ar.user_key = c.duplicate_user_key;

update public.intelligence_subscriptions ins
set user_id = c.canonical_id,
    user_key = c.canonical_user_key,
    email = c.normalized_email,
    updated_at = now()
from tmp_inconnect_user_canonical c
where ins.user_id = c.duplicate_id
   or ins.user_key = c.duplicate_user_key
   or lower(trim(ins.email)) = c.normalized_email;

update public.public_profiles pp
set user_id = c.canonical_id,
    user_key = c.canonical_user_key,
    updated_at = now()
from tmp_inconnect_user_canonical c
where pp.user_id = c.duplicate_id
   or pp.user_key = c.duplicate_user_key;

update public.professional_connections pc
set source_user_id = c.canonical_id
from tmp_inconnect_user_canonical c
where pc.source_user_id = c.duplicate_id;

update public.professional_connections pc
set target_user_id = c.canonical_id
from tmp_inconnect_user_canonical c
where pc.target_user_id = c.duplicate_id;

delete from public.professional_connections pc
using public.professional_connections duplicate
where pc.id > duplicate.id
  and pc.source_user_id = duplicate.source_user_id
  and pc.target_user_id = duplicate.target_user_id;

delete from public.users u
using tmp_inconnect_user_canonical c
where u.id = c.duplicate_id;

drop index if exists public.users_normalized_email_idx;

create unique index if not exists users_normalized_email_unique_idx
  on public.users (normalized_email)
  where normalized_email is not null;

drop table if exists tmp_inconnect_user_canonical;

notify pgrst, 'reload schema';
