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

create unique index if not exists assessment_feedback_assessment_id_idx
  on public.assessment_feedback (assessment_id);

create index if not exists assessment_feedback_user_key_created_at_idx
  on public.assessment_feedback (user_key, created_at desc);
