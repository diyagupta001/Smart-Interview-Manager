CREATE TABLE public.interview_violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert violations" ON public.interview_violations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can read violations" ON public.interview_violations FOR SELECT TO public USING (true);