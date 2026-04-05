
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'hr');

-- Create interview status enum
CREATE TYPE public.interview_status AS ENUM ('pending', 'in_progress', 'completed', 'auto_submitted');

-- Create decision enum
CREATE TYPE public.interview_decision AS ENUM ('selected', 'rejected', 'pending');

-- Create question type enum
CREATE TYPE public.question_type AS ENUM ('technical', 'hr', 'scenario');

-- Create difficulty enum
CREATE TYPE public.difficulty_level AS ENUM ('easy', 'medium', 'hard');

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  company TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Auto-assign HR role on signup
CREATE OR REPLACE FUNCTION public.assign_hr_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'hr');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_hr_role();

-- Job roles table
CREATE TABLE public.job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  difficulty difficulty_level NOT NULL DEFAULT 'medium',
  question_count INT NOT NULL DEFAULT 8,
  time_per_question INT NOT NULL DEFAULT 120,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR can view own job roles" ON public.job_roles FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "HR can create job roles" ON public.job_roles FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "HR can update own job roles" ON public.job_roles FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "HR can delete own job roles" ON public.job_roles FOR DELETE USING (auth.uid() = created_by);
-- Allow anonymous read for interview flow
CREATE POLICY "Anyone can read active job roles by id" ON public.job_roles FOR SELECT USING (is_active = true);

CREATE TRIGGER update_job_roles_updated_at BEFORE UPDATE ON public.job_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Interview links table
CREATE TABLE public.interview_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_role_id UUID REFERENCES public.job_roles(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  candidate_name TEXT DEFAULT '',
  candidate_email TEXT DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR can view own links" ON public.interview_links FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "HR can create links" ON public.interview_links FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "HR can update own links" ON public.interview_links FOR UPDATE USING (auth.uid() = created_by);
-- Candidates can read link by token (no auth)
CREATE POLICY "Anyone can read link by token" ON public.interview_links FOR SELECT USING (true);

-- Interviews table
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES public.interview_links(id) ON DELETE CASCADE NOT NULL,
  candidate_name TEXT NOT NULL DEFAULT '',
  candidate_email TEXT DEFAULT '',
  status interview_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  tab_switch_count INT NOT NULL DEFAULT 0,
  flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
-- Anyone can insert (candidates are not authenticated)
CREATE POLICY "Anyone can create interview" ON public.interviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update interview" ON public.interviews FOR UPDATE USING (true);
CREATE POLICY "Anyone can read interviews" ON public.interviews FOR SELECT USING (true);

CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Interview questions table
CREATE TABLE public.interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type question_type NOT NULL DEFAULT 'technical',
  difficulty difficulty_level NOT NULL DEFAULT 'easy',
  question_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert questions" ON public.interview_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read questions" ON public.interview_questions FOR SELECT USING (true);

-- Interview answers table
CREATE TABLE public.interview_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.interview_questions(id) ON DELETE CASCADE NOT NULL,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  answer_text TEXT NOT NULL DEFAULT '',
  time_taken_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert answers" ON public.interview_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read answers" ON public.interview_answers FOR SELECT USING (true);

-- Interview scores table
CREATE TABLE public.interview_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL UNIQUE,
  technical_score INT NOT NULL DEFAULT 0,
  communication_score INT NOT NULL DEFAULT 0,
  confidence_score INT NOT NULL DEFAULT 0,
  overall_rating INT NOT NULL DEFAULT 0,
  decision interview_decision NOT NULL DEFAULT 'pending',
  ai_feedback TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert scores" ON public.interview_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read scores" ON public.interview_scores FOR SELECT USING (true);

-- Indexes
CREATE INDEX idx_interview_links_token ON public.interview_links(token);
CREATE INDEX idx_interviews_link_id ON public.interviews(link_id);
CREATE INDEX idx_interview_questions_interview_id ON public.interview_questions(interview_id);
CREATE INDEX idx_interview_answers_interview_id ON public.interview_answers(interview_id);
CREATE INDEX idx_interview_scores_interview_id ON public.interview_scores(interview_id);
CREATE INDEX idx_job_roles_created_by ON public.job_roles(created_by);
CREATE INDEX idx_interview_links_created_by ON public.interview_links(created_by);
