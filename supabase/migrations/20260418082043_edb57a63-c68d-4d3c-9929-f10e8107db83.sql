ALTER TABLE public.interview_links
  ADD COLUMN IF NOT EXISTS email_opened_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS link_clicked_at TIMESTAMP WITH TIME ZONE;

CREATE POLICY "Anyone can update tracking timestamps"
ON public.interview_links
FOR UPDATE
USING (true)
WITH CHECK (true);