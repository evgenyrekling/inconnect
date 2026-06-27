create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  user_key text unique not null,
  name text,
  email text not null,
  linkedin_url text,
  normalized_email text not null,
  normalized_linkedin_url text,
  is_admin boolean not null default false,
  plan_type text not null default 'free',
  email_verified boolean default false,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  auth_provider text default 'email_otp',
  supabase_auth_user_id uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text not null,
  pdf_storage_path text,
  pdf_file_name text,
  pdf_file_size integer,
  extracted_text text,
  extracted_character_count integer,
  authority_score integer,
  assessment_confidence text,
  market_position text,
  core_positioning text,
  professional_archetype jsonb,
  positioning_snapshot jsonb,
  what_makes_unique text,
  score_breakdown jsonb,
  positioning_gap jsonb,
  top_competencies jsonb,
  expertise_domains jsonb,
  authority_growth_areas jsonb,
  profile_improvements jsonb,
  visibility_gaps jsonb,
  share_text text,
  ai_response jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.usage_limits (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  period_start date not null,
  period_end date not null,
  assessment_count integer not null default 0,
  plan_type text not null default 'free',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_key, period_start, period_end)
);

create table if not exists public.assessment_feedback (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  user_key text not null,
  feedback_type text not null check (feedback_type in ('positive', 'negative')),
  feedback_text text,
  created_at timestamp with time zone not null default now(),
  constraint assessment_feedback_negative_text_check
    check (feedback_type <> 'negative' or nullif(trim(feedback_text), '') is not null)
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text,
  name text,
  email text not null,
  linkedin_url text,
  professional_role text,
  seniority_level text,
  current_company text,
  location text,
  industries jsonb not null default '[]'::jsonb,
  sub_industries jsonb not null default '[]'::jsonb,
  interests jsonb not null default '[]'::jsonb,
  top_skills jsonb not null default '[]'::jsonb,
  expertise_domains jsonb not null default '[]'::jsonb,
  business_goals jsonb not null default '[]'::jsonb,
  professional_identity jsonb not null default '[]'::jsonb,
  writing_preferences jsonb not null default '[]'::jsonb,
  desired_perception text,
  professional_archetype jsonb,
  latest_authority_score integer,
  latest_assessment_id uuid,
  last_assessment_date timestamptz,
  headline_generator_inputs jsonb,
  headline_generator_outputs jsonb,
  about_generator_inputs jsonb,
  about_generator_outputs jsonb,
  article_generator_inputs jsonb,
  article_generator_outputs jsonb,
  profile_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.about_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text,
  email text not null,
  name text,
  inputs jsonb not null,
  outputs jsonb not null,
  selected_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.article_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  user_key text,
  email text not null,
  topic text,
  inputs jsonb,
  outputs jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text,
  excerpt text,
  category text,
  content text,
  hero_image_prompt text,
  hero_image_url text,
  research_sources jsonb,
  research_summary text,
  article_angle text,
  seo_title text,
  seo_description text,
  published boolean not null default true,
  auto_generated boolean not null default true,
  author_name text not null default 'INConnect Editorial',
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.airport_briefings (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text,
  airport_name text,
  category text,
  excerpt text,
  content text,
  hero_image_url text,
  hero_image_prompt text,
  source_name text,
  source_url text,
  source_domain text,
  source_image_url text,
  source_image_domain text,
  image_attribution text,
  keywords jsonb default '[]'::jsonb,
  research_sources jsonb default '[]'::jsonb,
  research_summary text,
  summary text,
  inconnect_view text,
  reading_time text default '1 Minute Read',
  is_source_based boolean default true,
  quality_score integer,
  status text default 'published',
  is_draft_candidate boolean default false,
  auto_send_allowed boolean default false,
  quality_rejection_reason text,
  source_url_type text,
  seo_title text,
  seo_description text,
  published boolean default true,
  published_at timestamptz,
  sent_at timestamptz,
  generated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.airport_daily_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text not null,
  source_type text,
  category text,
  priority text default 'medium',
  is_active boolean default true,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_successful_story_title text,
  last_successful_story_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.airport_daily_candidates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text not null,
  source_name text,
  source_image_url text,
  category text,
  notes text,
  status text default 'pending',
  priority text default 'medium',
  selected_for_digest boolean default false,
  used_at timestamptz,
  created_by_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.intelligence_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  user_key text,
  name text,
  email text,
  intelligence_type text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  email text not null,
  normalized_email text,
  name text,
  digest_type text not null,
  is_active boolean default true,
  unsubscribe_token text,
  unsubscribed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint subscriptions_digest_type_check
    check (
      digest_type in (
        'airport_automation_daily',
        'linkedin_daily',
        'lidar_daily',
        'smart_mobility_daily',
        'industrial_automation_daily'
      )
    )
);

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

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  digest_type text not null,
  content_type text,
  content_id uuid,
  email text not null,
  briefing_id uuid,
  status text not null default 'sent',
  resend_email_id text,
  error_message text,
  sent_at timestamptz default now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.airport_email_delivery_log (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid references public.airport_briefings(id) on delete set null,
  recipient_email text,
  status text not null,
  provider text default 'resend',
  provider_message_id text,
  error_message text,
  sent_at timestamptz default now()
);

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
  status text default 'prospect',
  automation_potential_score integer,
  automation_potential_tier text,
  automation_score_notes text,
  source_identity text,
  source_traffic text,
  source_url text,
  website text,
  linkedin_url text,
  is_seeded boolean default false,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.public_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  user_key text,
  slug text unique not null,
  display_name text,
  headline text,
  linkedin_url text,
  normalized_linkedin_url text,
  professional_email text,
  normalized_professional_email text,
  location text,
  company text,
  professional_role text,
  current_title text,
  current_company text,
  industry text,
  summary text,
  industries jsonb default '[]'::jsonb,
  expertise jsonb default '[]'::jsonb,
  strengths jsonb default '[]'::jsonb,
  interests jsonb default '[]'::jsonb,
  professional_archetype jsonb,
  authority_score integer,
  sections jsonb,
  visibility text default 'unlisted',
  is_public boolean default false,
  owner_edit_token text,
  profile_photo_url text,
  profile_photo_storage_path text,
  profile_image_url text,
  source text default 'linkedin_url',
  owner_user_id uuid references public.users(id) on delete set null,
  owner_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.professional_company_links (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.public_profiles(id) on delete cascade,
  company_id uuid not null references public.accounts(id) on delete cascade,
  relationship_type text default 'employee',
  title text,
  department text,
  seniority text,
  is_primary boolean default false,
  notes text,
  owner_user_id uuid references public.users(id) on delete cascade,
  owner_email text,
  created_by_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.professional_invitations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references public.public_profiles(id) on delete cascade,
  owner_user_id uuid references public.users(id) on delete cascade,
  professional_email text not null,
  normalized_professional_email text not null,
  invitation_token text unique not null,
  status text default 'sent',
  sent_at timestamptz,
  claimed_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.professional_invitation_events (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.professional_invitations(id) on delete cascade,
  event_type text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists users_user_key_idx on public.users (user_key);
create unique index if not exists users_normalized_email_unique_idx
  on public.users (normalized_email)
  where normalized_email is not null;
create unique index if not exists users_supabase_auth_user_id_unique_idx
  on public.users (supabase_auth_user_id)
  where supabase_auth_user_id is not null;
create index if not exists assessments_user_key_created_at_idx
  on public.assessments (user_key, created_at desc);
create index if not exists usage_limits_user_key_period_idx
  on public.usage_limits (user_key, period_start, period_end);
create unique index if not exists assessment_feedback_assessment_id_idx
  on public.assessment_feedback (assessment_id);
create index if not exists assessment_feedback_user_key_created_at_idx
  on public.assessment_feedback (user_key, created_at desc);
create unique index if not exists user_profiles_email_idx
  on public.user_profiles (email);
create index if not exists user_profiles_user_key_idx
  on public.user_profiles (user_key);
create index if not exists user_profiles_user_id_idx
  on public.user_profiles (user_id);
create index if not exists about_generations_user_key_created_at_idx
  on public.about_generations (user_key, created_at desc);
create index if not exists about_generations_email_created_at_idx
  on public.about_generations (email, created_at desc);
create index if not exists article_generations_user_key_created_at_idx
  on public.article_generations (user_key, created_at desc);
create index if not exists article_generations_email_created_at_idx
  on public.article_generations (email, created_at desc);
create unique index if not exists blog_posts_slug_idx
  on public.blog_posts (slug);
create index if not exists blog_posts_published_published_at_idx
  on public.blog_posts (published, published_at desc);
create index if not exists blog_posts_auto_generated_created_at_idx
  on public.blog_posts (auto_generated, created_at desc);
create unique index if not exists airport_briefings_slug_idx
  on public.airport_briefings (slug);
create unique index if not exists market_articles_type_slug_unique_idx
  on public.market_articles (article_type, slug);
create index if not exists market_articles_type_published_idx
  on public.market_articles (article_type, published, published_at desc);
create index if not exists market_articles_type_status_idx
  on public.market_articles (article_type, status, created_at desc);
create index if not exists market_articles_source_url_idx
  on public.market_articles (source_url)
  where source_url is not null;
create index if not exists airport_briefings_published_generated_at_idx
  on public.airport_briefings (published, generated_at desc);
create index if not exists airport_briefings_source_url_idx
  on public.airport_briefings (source_url);
create index if not exists airport_briefings_sent_at_idx
  on public.airport_briefings (sent_at);
create index if not exists airport_briefings_is_source_based_idx
  on public.airport_briefings (is_source_based);
create index if not exists airport_briefings_status_generated_at_idx
  on public.airport_briefings (status, generated_at desc);
create index if not exists airport_briefings_auto_send_allowed_idx
  on public.airport_briefings (auto_send_allowed);
create index if not exists airport_daily_sources_active_idx
  on public.airport_daily_sources (is_active);
create index if not exists airport_daily_sources_priority_idx
  on public.airport_daily_sources (priority);
create index if not exists airport_daily_candidates_status_idx
  on public.airport_daily_candidates (status);
create index if not exists airport_daily_candidates_priority_idx
  on public.airport_daily_candidates (priority);
create index if not exists intelligence_subscriptions_email_idx
  on public.intelligence_subscriptions (email);
create index if not exists intelligence_subscriptions_user_key_idx
  on public.intelligence_subscriptions (user_key);
create index if not exists intelligence_subscriptions_type_idx
  on public.intelligence_subscriptions (intelligence_type);
create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);
create index if not exists subscriptions_email_idx
  on public.subscriptions (email);
create index if not exists subscriptions_normalized_email_idx
  on public.subscriptions (normalized_email);
create index if not exists subscriptions_digest_type_idx
  on public.subscriptions (digest_type);
create index if not exists subscriptions_is_active_idx
  on public.subscriptions (is_active);
create unique index if not exists subscriptions_email_digest_type_unique_idx
  on public.subscriptions (lower(email), digest_type);
create unique index if not exists subscriptions_unsubscribe_token_unique_idx
  on public.subscriptions (unsubscribe_token)
  where unsubscribe_token is not null;
create index if not exists email_deliveries_subscription_id_idx
  on public.email_deliveries (subscription_id);
create index if not exists email_deliveries_digest_type_idx
  on public.email_deliveries (digest_type);
create index if not exists email_deliveries_content_idx
  on public.email_deliveries (content_type, content_id);
create index if not exists email_deliveries_digest_content_email_idx
  on public.email_deliveries (digest_type, content_type, content_id, email);
create index if not exists email_deliveries_email_idx
  on public.email_deliveries (email);
create index if not exists email_deliveries_status_idx
  on public.email_deliveries (status);
create index if not exists email_deliveries_sent_at_idx
  on public.email_deliveries (sent_at desc);
create index if not exists email_deliveries_resend_email_id_idx
  on public.email_deliveries (resend_email_id);
create index if not exists airport_email_delivery_log_briefing_id_idx
  on public.airport_email_delivery_log (briefing_id);
create index if not exists airport_email_delivery_log_recipient_email_idx
  on public.airport_email_delivery_log (recipient_email);
create index if not exists airport_email_delivery_log_status_idx
  on public.airport_email_delivery_log (status);
create index if not exists airport_email_delivery_log_sent_at_idx
  on public.airport_email_delivery_log (sent_at desc);
create index if not exists professional_connections_source_user_id_idx
  on public.professional_connections (source_user_id);
create index if not exists professional_connections_target_user_id_idx
  on public.professional_connections (target_user_id);
create index if not exists professional_connections_connection_type_idx
  on public.professional_connections (connection_type);
create index if not exists professional_connections_status_idx
  on public.professional_connections (status);
create unique index if not exists professional_connections_source_target_idx
  on public.professional_connections (source_user_id, target_user_id);
create index if not exists accounts_account_type_idx
  on public.accounts (account_type);
create index if not exists accounts_status_idx
  on public.accounts (status);
create index if not exists accounts_website_idx
  on public.accounts (website)
  where website is not null;
create index if not exists accounts_linkedin_url_idx
  on public.accounts (linkedin_url)
  where linkedin_url is not null;
create unique index if not exists accounts_airport_iata_unique_idx
  on public.accounts (iata_code)
  where account_type = 'airport' and iata_code is not null;
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
create index if not exists accounts_airport_status_idx
  on public.accounts (status)
  where account_type = 'airport';
create index if not exists accounts_airport_automation_score_idx
  on public.accounts (automation_potential_score)
  where account_type = 'airport';
create index if not exists accounts_airport_automation_tier_idx
  on public.accounts (automation_potential_tier)
  where account_type = 'airport';
create index if not exists accounts_airport_is_active_idx
  on public.accounts (is_active)
  where account_type = 'airport';
create unique index if not exists public_profiles_slug_idx
  on public.public_profiles (slug);
create index if not exists public_profiles_user_id_idx
  on public.public_profiles (user_id);
create index if not exists public_profiles_user_key_idx
  on public.public_profiles (user_key);
create index if not exists public_profiles_visibility_idx
  on public.public_profiles (visibility);
create index if not exists public_profiles_is_public_idx
  on public.public_profiles (is_public);
create index if not exists public_profiles_linkedin_url_idx
  on public.public_profiles (linkedin_url)
  where linkedin_url is not null;
create index if not exists public_profiles_normalized_professional_email_idx
  on public.public_profiles (normalized_professional_email)
  where normalized_professional_email is not null;
create unique index if not exists public_profiles_owner_linkedin_unique_idx
  on public.public_profiles (
    (coalesce(owner_user_id::text, lower(owner_email))),
    normalized_linkedin_url
  )
  where normalized_linkedin_url is not null
    and (owner_user_id is not null or owner_email is not null);
create index if not exists public_profiles_owner_user_id_idx
  on public.public_profiles (owner_user_id)
  where owner_user_id is not null;
create index if not exists public_profiles_owner_email_idx
  on public.public_profiles (owner_email)
  where owner_email is not null;
create unique index if not exists professional_company_links_unique_idx
  on public.professional_company_links (professional_id, company_id, relationship_type);
create index if not exists professional_company_links_professional_id_idx
  on public.professional_company_links (professional_id);
create index if not exists professional_company_links_company_id_idx
  on public.professional_company_links (company_id);
create index if not exists professional_company_links_relationship_type_idx
  on public.professional_company_links (relationship_type);
create index if not exists professional_company_links_owner_user_id_idx
  on public.professional_company_links (owner_user_id)
  where owner_user_id is not null;
create index if not exists professional_company_links_owner_email_idx
  on public.professional_company_links (owner_email)
  where owner_email is not null;
create index if not exists professional_invitations_professional_id_idx
  on public.professional_invitations (professional_id);
create index if not exists professional_invitations_owner_user_id_idx
  on public.professional_invitations (owner_user_id);
create index if not exists professional_invitations_normalized_email_idx
  on public.professional_invitations (normalized_professional_email);
create index if not exists professional_invitations_recent_idx
  on public.professional_invitations (owner_user_id, normalized_professional_email, sent_at desc);
create index if not exists professional_invitation_events_invitation_id_idx
  on public.professional_invitation_events (invitation_id);

comment on table public.professional_connections is
  'Private professional connection graph foundation for business matchmaking, mutual connections, partner discovery, opportunity matching, and company network intelligence.';

comment on table public.accounts is
  'Generic account layer for airport accounts and future company, supplier, customer, and opportunity account intelligence.';

comment on table public.professional_company_links is
  'Foundation for linking professionals to company accounts for future business matchmaking, account mapping, opportunity discovery, and company network intelligence.';

comment on column public.accounts.source_identity is
  'Identity source for seeded airport data, typically OurAirports airports.csv.';

comment on column public.accounts.source_traffic is
  'Passenger traffic source supplied by a later enrichment CSV.';

comment on column public.accounts.status is
  'Generic CRM account status. Supported values: support, prospect, customer, partner, competitor, inactive.';

comment on column public.accounts.automation_potential_score is
  'Initial INConnect heuristic estimate for airport automation potential. Range 0-100.';

comment on column public.accounts.automation_potential_tier is
  'Automation potential tier derived from automation_potential_score.';

comment on column public.accounts.automation_score_notes is
  'Notes explaining the initial heuristic scoring factors and future enrichment placeholders.';

comment on column public.accounts.website is
  'Account website URL imported from master account data.';

comment on column public.accounts.linkedin_url is
  'Account LinkedIn URL imported from master account data.';

alter table public.accounts enable row level security;
alter table public.users enable row level security;
alter table public.public_profiles enable row level security;
alter table public.professional_company_links enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "users_owner_select" on public.users;
create policy "users_owner_select"
  on public.users
  for select
  to authenticated
  using (
    supabase_auth_user_id = auth.uid()
    or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "users_owner_update" on public.users;
create policy "users_owner_update"
  on public.users
  for update
  to authenticated
  using (
    supabase_auth_user_id = auth.uid()
    or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    supabase_auth_user_id = auth.uid()
    or lower(normalized_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "accounts_read_authenticated" on public.accounts;
create policy "accounts_read_authenticated"
  on public.accounts
  for select
  to authenticated
  using (true);

drop policy if exists "public_profiles_owner_select" on public.public_profiles;
create policy "public_profiles_owner_select"
  on public.public_profiles
  for select
  to authenticated
  using (
    is_public = true
    or owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "public_profiles_owner_insert" on public.public_profiles;
create policy "public_profiles_owner_insert"
  on public.public_profiles
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "public_profiles_owner_update" on public.public_profiles;
create policy "public_profiles_owner_update"
  on public.public_profiles
  for update
  to authenticated
  using (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_select" on public.professional_company_links;
create policy "professional_company_links_owner_select"
  on public.professional_company_links
  for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_insert" on public.professional_company_links;
create policy "professional_company_links_owner_insert"
  on public.professional_company_links
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_update" on public.professional_company_links;
create policy "professional_company_links_owner_update"
  on public.professional_company_links
  for update
  to authenticated
  using (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "professional_company_links_owner_delete" on public.professional_company_links;
create policy "professional_company_links_owner_delete"
  on public.professional_company_links
  for delete
  to authenticated
  using (
    owner_user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

insert into storage.buckets (id, name, public)
values ('profile-pdfs', 'profile-pdfs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update
set public = true;

insert into storage.buckets (id, name, public)
values ('airport-briefing-images', 'airport-briefing-images', true)
on conflict (id) do update
set public = true;

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update
set public = true;
