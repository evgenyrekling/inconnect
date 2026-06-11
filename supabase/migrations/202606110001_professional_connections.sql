create table if not exists public.professional_connections (
  id uuid primary key default gen_random_uuid(),
  source_user_id uuid references public.users(id),
  target_user_id uuid references public.users(id),
  connection_type text default 'linkedin',
  source text default 'csv_import',
  status text default 'connected',
  notes text,
  created_at timestamptz default now()
);

alter table public.professional_connections
  add column if not exists source_user_id uuid references public.users(id),
  add column if not exists target_user_id uuid references public.users(id),
  add column if not exists connection_type text default 'linkedin',
  add column if not exists source text default 'csv_import',
  add column if not exists status text default 'connected',
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now();

create index if not exists professional_connections_source_user_id_idx
  on public.professional_connections(source_user_id);

create index if not exists professional_connections_target_user_id_idx
  on public.professional_connections(target_user_id);

create index if not exists professional_connections_connection_type_idx
  on public.professional_connections(connection_type);

create index if not exists professional_connections_status_idx
  on public.professional_connections(status);

create unique index if not exists professional_connections_source_target_idx
  on public.professional_connections(source_user_id, target_user_id);

comment on table public.professional_connections is
  'Private professional connection graph foundation for business matchmaking, mutual connections, professional graph, partner discovery, opportunity matching, and company network intelligence.';

comment on column public.professional_connections.source_user_id is
  'Source professional in the private graph, usually the importing admin user for CSV imports.';

comment on column public.professional_connections.target_user_id is
  'Imported or discovered professional contact connected to the source user.';

notify pgrst, 'reload schema';
