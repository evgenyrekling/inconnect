alter table public.accounts
add column if not exists automation_potential_score integer;

alter table public.accounts
add column if not exists automation_potential_tier text;

alter table public.accounts
add column if not exists automation_score_notes text;

create index if not exists accounts_airport_automation_score_idx
  on public.accounts (automation_potential_score)
  where account_type = 'airport';

create index if not exists accounts_airport_automation_tier_idx
  on public.accounts (automation_potential_tier)
  where account_type = 'airport';

comment on column public.accounts.automation_potential_score is
  'Initial INConnect heuristic estimate for airport automation potential. Range 0-100.';

comment on column public.accounts.automation_potential_tier is
  'Automation potential tier derived from automation_potential_score.';

comment on column public.accounts.automation_score_notes is
  'Notes explaining the initial heuristic scoring factors and future enrichment placeholders.';

notify pgrst, 'reload schema';
