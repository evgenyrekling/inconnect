alter table public.blog_posts
  add column if not exists research_sources jsonb,
  add column if not exists research_summary text,
  add column if not exists article_angle text;

create index if not exists blog_posts_article_angle_created_at_idx
  on public.blog_posts (article_angle, created_at desc);

notify pgrst, 'reload schema';
