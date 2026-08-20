ALTER TABLE public.interview_links
  ADD COLUMN IF NOT EXISTS resume_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS interview_mode text NOT NULL DEFAULT 'standard';