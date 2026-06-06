create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text,
  excerpt text,
  category text,
  content text,
  seo_title text,
  seo_description text,
  published boolean not null default false,
  auto_generated boolean not null default true,
  author_name text not null default 'INConnect Editorial',
  created_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.blog_posts
  add column if not exists slug text,
  add column if not exists title text,
  add column if not exists excerpt text,
  add column if not exists category text,
  add column if not exists content text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists published boolean not null default false,
  add column if not exists auto_generated boolean not null default true,
  add column if not exists author_name text not null default 'INConnect Editorial',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists published_at timestamptz;

create unique index if not exists blog_posts_slug_idx
  on public.blog_posts (slug);

create index if not exists blog_posts_published_published_at_idx
  on public.blog_posts (published, published_at desc);

create index if not exists blog_posts_auto_generated_created_at_idx
  on public.blog_posts (auto_generated, created_at desc);

notify pgrst, 'reload schema';
