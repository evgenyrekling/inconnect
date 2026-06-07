alter table public.blog_posts
  add column if not exists hero_image_url text,
  add column if not exists hero_image_prompt text;

insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update
set public = true;

notify pgrst, 'reload schema';
