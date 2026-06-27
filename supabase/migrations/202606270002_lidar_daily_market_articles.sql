create table if not exists public.market_articles (
  id uuid primary key default gen_random_uuid(),
  article_type text not null,
  title text not null,
  slug text not null,
  category text,
  source_name text,
  source_url text,
  source_domain text,
  source_image_url text,
  image_attribution text,
  body text,
  inconnect_perspective text,
  excerpt text,
  status text default 'draft_candidate',
  quality_score integer,
  published boolean default false,
  published_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.market_articles
  add column if not exists article_type text,
  add column if not exists title text,
  add column if not exists slug text,
  add column if not exists category text,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists source_domain text,
  add column if not exists source_image_url text,
  add column if not exists image_attribution text,
  add column if not exists body text,
  add column if not exists inconnect_perspective text,
  add column if not exists excerpt text,
  add column if not exists status text default 'draft_candidate',
  add column if not exists quality_score integer,
  add column if not exists published boolean default false,
  add column if not exists published_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists market_articles_type_slug_unique_idx
  on public.market_articles (article_type, slug);

create index if not exists market_articles_type_published_idx
  on public.market_articles (article_type, published, published_at desc);

create index if not exists market_articles_type_status_idx
  on public.market_articles (article_type, status, created_at desc);

create index if not exists market_articles_source_url_idx
  on public.market_articles (source_url)
  where source_url is not null;

alter table public.subscriptions
  drop constraint if exists subscriptions_digest_type_check;

alter table public.subscriptions
  add constraint subscriptions_digest_type_check
    check (
      digest_type in (
        'airport_automation_daily',
        'linkedin_daily',
        'lidar_daily',
        'smart_mobility_daily',
        'industrial_automation_daily'
      )
    );

notify pgrst, 'reload schema';
