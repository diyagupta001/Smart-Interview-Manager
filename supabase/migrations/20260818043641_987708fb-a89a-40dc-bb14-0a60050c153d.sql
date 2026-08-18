
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS interview_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS resume_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS adaptive_state jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.interview_questions
  ADD COLUMN IF NOT EXISTS is_followup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT '';

ALTER TABLE public.interview_answers
  ADD COLUMN IF NOT EXISTS ai_evaluation jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.interview_scores
  ADD COLUMN IF NOT EXISTS problem_solving_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resume_skill_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS improvement_plan jsonb NOT NULL DEFAULT '{}'::jsonb;
