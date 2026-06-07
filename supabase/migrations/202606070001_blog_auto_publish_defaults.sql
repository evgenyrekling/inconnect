alter table public.blog_posts
  add column if not exists slug text,
  add column if not exists title text,
  add column if not exists excerpt text,
  add column if not exists category text,
  add column if not exists content text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists published boolean not null default true,
  add column if not exists auto_generated boolean not null default true,
  add column if not exists author_name text not null default 'INConnect Editorial',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists published_at timestamptz;

alter table public.blog_posts
  alter column published set default true,
  alter column auto_generated set default true,
  alter column author_name set default 'INConnect Editorial',
  alter column created_at set default now();

create unique index if not exists blog_posts_slug_idx
  on public.blog_posts (slug);

create index if not exists blog_posts_published_published_at_idx
  on public.blog_posts (published, published_at desc);

create index if not exists blog_posts_auto_generated_created_at_idx
  on public.blog_posts (auto_generated, created_at desc);

notify pgrst, 'reload schema';
