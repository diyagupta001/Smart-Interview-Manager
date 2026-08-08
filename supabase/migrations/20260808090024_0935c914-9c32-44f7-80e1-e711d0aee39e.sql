
-- interview_links
DROP POLICY IF EXISTS "Anyone can read link by token" ON public.interview_links;

-- interviews
DROP POLICY IF EXISTS "Anyone can read interviews" ON public.interviews;
DROP POLICY IF EXISTS "Anyone can update interview" ON public.interviews;
DROP POLICY IF EXISTS "Anyone can create interview" ON public.interviews;

CREATE POLICY "HR can view interviews for own roles"
ON public.interviews FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.interview_links l
  JOIN public.job_roles j ON j.id = l.job_role_id
  WHERE l.id = interviews.link_id AND j.created_by = auth.uid()
));

-- interview_questions
DROP POLICY IF EXISTS "Anyone can read questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Anyone can insert questions" ON public.interview_questions;

CREATE POLICY "HR can view questions for own interviews"
ON public.interview_questions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.interviews i
  JOIN public.interview_links l ON l.id = i.link_id
  JOIN public.job_roles j ON j.id = l.job_role_id
  WHERE i.id = interview_questions.interview_id AND j.created_by = auth.uid()
));

-- interview_answers
DROP POLICY IF EXISTS "Anyone can read answers" ON public.interview_answers;
DROP POLICY IF EXISTS "Anyone can insert answers" ON public.interview_answers;

CREATE POLICY "HR can view answers for own interviews"
ON public.interview_answers FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.interviews i
  JOIN public.interview_links l ON l.id = i.link_id
  JOIN public.job_roles j ON j.id = l.job_role_id
  WHERE i.id = interview_answers.interview_id AND j.created_by = auth.uid()
));

-- interview_scores
DROP POLICY IF EXISTS "Anyone can read scores" ON public.interview_scores;
DROP POLICY IF EXISTS "Anyone can insert scores" ON public.interview_scores;

CREATE POLICY "HR can view scores for own interviews"
ON public.interview_scores FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.interviews i
  JOIN public.interview_links l ON l.id = i.link_id
  JOIN public.job_roles j ON j.id = l.job_role_id
  WHERE i.id = interview_scores.interview_id AND j.created_by = auth.uid()
));

-- interview_violations
DROP POLICY IF EXISTS "Anyone can read violations" ON public.interview_violations;
DROP POLICY IF EXISTS "Anyone can insert violations" ON public.interview_violations;

CREATE POLICY "HR can view violations for own interviews"
ON public.interview_violations FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.interviews i
  JOIN public.interview_links l ON l.id = i.link_id
  JOIN public.job_roles j ON j.id = l.job_role_id
  WHERE i.id = interview_violations.interview_id AND j.created_by = auth.uid()
));

-- Remove anonymous Data API access to interview data
REVOKE ALL ON public.interview_links FROM anon;
REVOKE ALL ON public.interviews FROM anon;
REVOKE ALL ON public.interview_questions FROM anon;
REVOKE ALL ON public.interview_answers FROM anon;
REVOKE ALL ON public.interview_scores FROM anon;
REVOKE ALL ON public.interview_violations FROM anon;

GRANT SELECT ON public.interview_questions TO authenticated;
GRANT SELECT ON public.interview_answers TO authenticated;
GRANT SELECT ON public.interview_scores TO authenticated;
GRANT SELECT ON public.interview_violations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;
GRANT ALL ON public.interview_links TO service_role;
GRANT ALL ON public.interview_questions TO service_role;
GRANT ALL ON public.interview_answers TO service_role;
GRANT ALL ON public.interview_scores TO service_role;
GRANT ALL ON public.interview_violations TO service_role;

-- SECURITY DEFINER functions should not be callable from the Data API
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_hr_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
