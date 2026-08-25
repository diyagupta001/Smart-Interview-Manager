ALTER TABLE public.interview_links
  ADD COLUMN IF NOT EXISTS available_languages text[] NOT NULL DEFAULT ARRAY['en']::text[];

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS interview_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS answer_language text NOT NULL DEFAULT 'same';