alter table public.assessments
add column if not exists professional_archetype jsonb;
