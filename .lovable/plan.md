

# AI-Powered Interview System — Full Build Plan

## Overview
A full-stack AI interview platform where HR creates job roles, generates unique interview links, and candidates complete AI-driven interviews with automatic scoring and reporting. Built with React + Lovable Cloud (Supabase) + Lovable AI.

---

## Phase 1: Foundation & Authentication

### Database Schema
- **profiles** table (HR users — name, company, avatar)
- **user_roles** table (role enum: admin, hr, candidate)
- **job_roles** table (title, description, required_skills, difficulty, created_by HR)
- **interview_links** table (unique token, job_role_id, expires_at, used, candidate_name, candidate_email)
- **interviews** table (link_id, candidate info, status, started_at, completed_at, tab_switch_count, flagged)
- **interview_questions** table (interview_id, question_text, question_type tag, difficulty, order)
- **interview_answers** table (question_id, answer_text, time_taken_seconds)
- **interview_scores** table (interview_id, technical_score, communication_score, confidence_score, overall_rating, decision, ai_feedback)

### Auth & Roles
- HR: Email/password signup & login
- Candidates: Access via unique link only (no auth required)
- RLS policies on all tables

### Dark/Light Mode
- Theme toggle component using CSS variables
- Persist preference in localStorage

---

## Phase 2: HR Dashboard

### Job Role Management
- Create/edit/delete job roles with title, description, required skills, and difficulty level
- List view with search and filters

### Interview Link Generation
- Generate unique secure links per job role
- Set expiration time (1 hour, 24 hours, 7 days)
- Copy link to clipboard
- Send email invitation with job details and link (using Lovable Emails)

### Candidate Management
- Table of all candidates with columns: name, role, score, status, date, flags
- Filters by role, score range, status (Selected/Rejected/Pending)
- Search by candidate name
- Click to view detailed report

### Analytics Dashboard
- Cards: Total interviews, selection rate, average scores
- Charts: Selection rate over time, average scores per role, interviews per role
- Candidate timeline view (Started → Completed → Result)
- Suspicious activity flags (tab switching)

### Report Export
- Generate PDF report per candidate with scorecard, answers, and AI feedback

---

## Phase 3: AI Interview Flow (Candidate Side)

### Interview Entry
- Candidate clicks unique link → validates token → shows welcome screen
- Quick name/email capture (optional, for report)
- Microphone permission request for voice answers
- Instructions screen before starting

### Interview UI
- Clean, distraction-free interface
- Progress bar showing question number / total
- Timer per question (configurable by HR)
- Question display with type tag (Technical / HR / Scenario-based)
- Text input area for typed answers
- Voice input button with speech-to-text transcription (Web Speech API)
- TTS: AI reads question aloud with Play/Pause/Replay controls (Web Speech Synthesis API)

### AI Question Engine (via Lovable AI edge function)
- Generate role-specific questions based on job description and required skills
- Adaptive difficulty: start easy → increase based on answer quality
- Mix of Technical, HR, and Scenario-based questions
- ~8-10 questions per interview

### Anti-Cheating
- Detect tab switches and window blur events
- Show warning toast on first 2 occurrences
- Auto-submit interview after 3rd violation
- Log all violations with timestamps

---

## Phase 4: AI Evaluation & Results

### Scoring Edge Function
- Send all Q&A pairs to Lovable AI for evaluation
- Score dimensions: Technical accuracy, Communication clarity, Confidence
- Generate overall rating (0-100)
- Make decision: Selected / Rejected with threshold
- Generate brief personalized feedback

### Instant Result Screen
- "Analyzing your responses…" animation (3-4 seconds)
- Result reveal with smooth transition
- Score breakdown cards (Technical, Communication, Confidence)
- Overall rating with visual gauge
- Decision badge: ✅ Selected for next round / ❌ Not Selected
- AI-generated feedback paragraph

### Data Storage
- Save all scores, decision, and feedback to database
- Link to interview record for HR viewing

---

## Phase 5: Polish & Advanced Features

### UX Enhancements
- Animated page transitions (Framer Motion)
- Loading skeletons throughout
- Professional card-based layouts
- Responsive design for all screen sizes
- Toast notifications for all actions

### Email System
- HR sends interview invitations from dashboard
- Email includes: greeting, job role, interview link, instructions
- Confirmation email to candidate after completion (optional)

---

## Key Pages
1. `/` — Landing page
2. `/login` — HR login
3. `/signup` — HR signup
4. `/dashboard` — HR main dashboard with analytics
5. `/dashboard/jobs` — Job role management
6. `/dashboard/candidates` — Candidate list & reports
7. `/dashboard/candidates/:id` — Detailed candidate report
8. `/interview/:token` — Candidate interview flow
9. `/interview/:token/result` — Instant result screen

