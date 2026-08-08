
ALTER TABLE public.interview_links
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS email_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS email_error text;

CREATE OR REPLACE FUNCTION public.validate_interview_link_email_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email_status NOT IN ('not_sent', 'sent', 'failed') THEN
    RAISE EXCEPTION 'Invalid email_status: %', NEW.email_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_interview_link_email_status ON public.interview_links;
CREATE TRIGGER validate_interview_link_email_status
BEFORE INSERT OR UPDATE ON public.interview_links
FOR EACH ROW EXECUTE FUNCTION public.validate_interview_link_email_status();
