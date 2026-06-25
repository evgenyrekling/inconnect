create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  account_type text not null,
  name text not null,
  display_name text,
  iata_code text,
  icao_code text,
  ourairports_ident text,
  country_code text,
  country_name text,
  region_code text,
  city text,
  municipality text,
  latitude double precision,
  longitude double precision,
  airport_type text,
  scheduled_service text,
  annual_passengers bigint,
  passenger_year integer,
  passenger_tier text default 'unknown',
  strategic_priority text default 'unrated',
  source_identity text,
  source_traffic text,
  source_url text,
  is_seeded boolean default false,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounts add column if not exists user_id uuid references public.users(id) on delete set null;
alter table public.accounts add column if not exists account_type text;
alter table public.accounts add column if not exists name text;
alter table public.accounts add column if not exists display_name text;
alter table public.accounts add column if not exists iata_code text;
alter table public.accounts add column if not exists icao_code text;
alter table public.accounts add column if not exists ourairports_ident text;
alter table public.accounts add column if not exists country_code text;
alter table public.accounts add column if not exists country_name text;
alter table public.accounts add column if not exists region_code text;
alter table public.accounts add column if not exists city text;
alter table public.accounts add column if not exists municipality text;
alter table public.accounts add column if not exists latitude double precision;
alter table public.accounts add column if not exists longitude double precision;
alter table public.accounts add column if not exists airport_type text;
alter table public.accounts add column if not exists scheduled_service text;
alter table public.accounts add column if not exists annual_passengers bigint;
alter table public.accounts add column if not exists passenger_year integer;
alter table public.accounts add column if not exists passenger_tier text default 'unknown';
alter table public.accounts add column if not exists strategic_priority text default 'unrated';
alter table public.accounts add column if not exists source_identity text;
alter table public.accounts add column if not exists source_traffic text;
alter table public.accounts add column if not exists source_url text;
alter table public.accounts add column if not exists is_seeded boolean default false;
alter table public.accounts add column if not exists is_active boolean default true;
alter table public.accounts add column if not exists notes text;
alter table public.accounts add column if not exists created_at timestamptz default now();
alter table public.accounts add column if not exists updated_at timestamptz default now();

update public.accounts
set
  passenger_tier = coalesce(passenger_tier, 'unknown'),
  strategic_priority = coalesce(strategic_priority, 'unrated'),
  is_seeded = coalesce(is_seeded, false),
  is_active = coalesce(is_active, true),
  updated_at = coalesce(updated_at, now())
where account_type = 'airport';

create unique index if not exists accounts_airport_iata_unique_idx
  on public.accounts (iata_code)
  where account_type = 'airport' and iata_code is not null;

create index if not exists accounts_account_type_idx
  on public.accounts (account_type);

create index if not exists accounts_airport_country_code_idx
  on public.accounts (country_code)
  where account_type = 'airport';

create index if not exists accounts_airport_iata_idx
  on public.accounts (iata_code)
  where account_type = 'airport';

create index if not exists accounts_airport_passenger_tier_idx
  on public.accounts (passenger_tier)
  where account_type = 'airport';

create index if not exists accounts_airport_strategic_priority_idx
  on public.accounts (strategic_priority)
  where account_type = 'airport';

create index if not exists accounts_airport_is_active_idx
  on public.accounts (is_active)
  where account_type = 'airport';

comment on table public.accounts is
  'Generic account layer for airport accounts and future company, supplier, customer, and opportunity account intelligence.';

comment on column public.accounts.source_identity is
  'Identity source for seeded airport data, typically OurAirports airports.csv.';

comment on column public.accounts.source_traffic is
  'Passenger traffic source supplied by a later enrichment CSV.';

notify pgrst, 'reload schema';
