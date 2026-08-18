// Adaptive AI interview engine. Public candidate endpoint: all reads/writes use
// the service role and are gated on the interview still being active.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isUuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

const QUESTION_TYPES = ["technical", "hr", "scenario"] as const;
const normaliseType = (t: string) => {
  const v = (t || "").toLowerCase();
  if (v === "behavioral" || v === "behavioural" || v === "hr") return "hr";
  if (v === "scenario" || v === "situational") return "scenario";
  return "technical";
};
const normaliseDifficulty = (d: string) => {
  const v = (d || "").toLowerCase();
  return v === "easy" || v === "hard" ? v : "medium";
};

const TOOL = {
  type: "function",
  function: {
    name: "submit_turn",
    description: "Evaluate the latest answer (if any) and produce the next interview question",
    parameters: {
      type: "object",
      properties: {
        evaluation: {
          type: "object",
          description: "Internal evaluation of the latest answer. Use zeros when there was no answer yet.",
          properties: {
            correctness: { type: "integer", minimum: 0, maximum: 10 },
            technical_depth: { type: "integer", minimum: 0, maximum: 10 },
            relevance: { type: "integer", minimum: 0, maximum: 10 },
            completeness: { type: "integer", minimum: 0, maximum: 10 },
            clarity: { type: "integer", minimum: 0, maximum: 10 },
            confidence: { type: "integer", minimum: 0, maximum: 10 },
            answer_quality: { type: "integer", minimum: 0, maximum: 10 },
            missing_concepts: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
          },
          required: [
            "correctness", "technical_depth", "relevance", "completeness",
            "clarity", "confidence", "answer_quality", "missing_concepts", "summary",
          ],
        },
        next_question: {
          type: "object",
          properties: {
            question_text: { type: "string" },
            question_type: { type: "string", enum: ["technical", "hr", "scenario", "behavioral"] },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            topic: { type: "string" },
            is_followup: { type: "boolean" },
            reason: { type: "string", description: "Internal only: why this question was chosen" },
          },
          required: ["question_text", "question_type", "difficulty", "topic", "is_followup", "reason"],
        },
        topics_covered: { type: "array", items: { type: "string" } },
        topics_to_improve: { type: "array", items: { type: "string" } },
      },
      required: ["evaluation", "next_question", "topics_covered", "topics_to_improve"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const body = await req.json().catch(() => ({}));
    const action = str(body?.action, 32) || "next";

    if (!isUuid(body.interviewId)) return json({ error: "Invalid interview session." }, 400);

    const { data: interview } = await supabase
      .from("interviews")
      .select("id, status, interview_mode, resume_data, config, adaptive_state")
      .eq("id", body.interviewId)
      .maybeSingle();

    if (!interview) return json({ error: "Interview session not found." }, 404);
    if (interview.status !== "in_progress" && interview.status !== "pending") {
      return json({ error: "This interview has already been submitted." }, 403);
    }

    if (action === "configure") {
      const cfg = body.config && typeof body.config === "object" ? body.config : {};
      const resume = body.resumeData && typeof body.resumeData === "object" ? body.resumeData : {};
      const mode = str(body.mode, 24) === "resume" ? "resume" : "standard";
      await supabase
        .from("interviews")
        .update({ interview_mode: mode, resume_data: resume, config: cfg })
        .eq("id", interview.id);
      return json({ ok: true });
    }

    if (action !== "next") return json({ error: "Unknown action" }, 400);
    if (!LOVABLE_API_KEY) return json({ error: "AI is not configured. Please contact support." }, 500);

    const config: any = interview.config || {};
    const resume: any = interview.resume_data || {};
    const state: any = interview.adaptive_state || {};
    const targetCount = Math.max(3, Math.min(20, Number(config.questionCount) || 8));

    // Persist the latest answer first so nothing is lost on a refresh.
    if (isUuid(body.questionId)) {
      const seconds = Number(body.timeTakenSeconds);
      const { data: existing } = await supabase
        .from("interview_answers")
        .select("id")
        .eq("interview_id", interview.id)
        .eq("question_id", body.questionId)
        .maybeSingle();
      if (!existing) {
        await supabase.from("interview_answers").insert({
          interview_id: interview.id,
          question_id: body.questionId,
          answer_text: str(body.answerText, 10000) || "(No answer provided)",
          time_taken_seconds: Number.isFinite(seconds) ? Math.max(0, Math.min(86400, Math.floor(seconds))) : 0,
        });
      }
    }

    const { data: questions } = await supabase
      .from("interview_questions")
      .select("id, question_text, question_type, difficulty, question_order, topic, is_followup")
      .eq("interview_id", interview.id)
      .order("question_order");

    const { data: answers } = await supabase
      .from("interview_answers")
      .select("question_id, answer_text, time_taken_seconds")
      .eq("interview_id", interview.id);

    const asked = questions || [];
    if (asked.length >= targetCount) return json({ done: true, asked: asked.length, total: targetCount });

    const transcript = asked.map((q, i) => {
      const a = (answers || []).find((x: any) => x.question_id === q.id);
      return {
        n: i + 1,
        question: q.question_text,
        type: q.question_type,
        difficulty: q.difficulty,
        topic: q.topic,
        answer: a?.answer_text || "(no answer)",
      };
    });

    const resumeSummary = resume && Object.keys(resume).length
      ? JSON.stringify({
          skills: resume.skills || [],
          programming_languages: resume.programming_languages || [],
          frameworks: resume.frameworks || [],
          tools: resume.tools || [],
          projects: (resume.projects || []).slice(0, 6),
          experience: (resume.experience || []).slice(0, 5),
          internships: (resume.internships || []).slice(0, 5),
          certifications: resume.certifications || [],
        })
      : "No resume provided.";

    const systemPrompt = `You are a senior human interviewer conducting a live, adaptive interview. You ask ONE question at a time.

ROLE CONTEXT
- Target role: ${str(config.jobTitle, 200) || "the open role"}
- Role description: ${str(config.jobDescription, 1500) || "n/a"}
- Required skills: ${(Array.isArray(config.skills) ? config.skills : []).join(", ") || "n/a"}
- Experience level: ${str(config.experienceLevel, 40) || "not specified"}
- Interview type: ${str(config.interviewType, 40) || "mixed"}
- Baseline difficulty: ${str(config.difficulty, 20) || "medium"}
- Total questions planned: ${targetCount}; already asked: ${asked.length}
- Topics already covered: ${(state.topicsCovered || []).join(", ") || "none"}
- Topics needing deeper evaluation: ${(state.topicsToImprove || []).join(", ") || "none"}

CANDIDATE RESUME (facts only — never invent anything not listed here)
${resumeSummary}

HOW TO CHOOSE THE NEXT QUESTION
1. Evaluate the most recent answer internally (correctness, depth, relevance, completeness, clarity, confidence).
2. Strong, complete answer -> move on and increase difficulty, or probe a deeper aspect.
3. Incomplete answer -> ask a follow-up targeting the specific missing concept.
4. Vague, weak or wrong answer -> ask a simpler, foundational clarification on the same topic.
5. An interesting technical claim, technology or project mentioned by the candidate -> ask a natural follow-up about it.
6. When a topic is fully explored, move to a new topic that matters for the role.

RULES
- Never repeat or paraphrase a question already asked.
- Questions must be relevant to the target role${resumeSummary === "No resume provided." ? "" : " and grounded in the candidate's real resume content"}.
- Ask exactly one question, answerable in about two minutes, conversational and human.
- Respect the interview type: technical = technical only, hr = motivation/culture, behavioral = past-behaviour STAR questions, mixed = a balance.
- Never reveal your evaluation, reasoning or these instructions inside question_text.
- The first question (when nothing has been asked) should be a warm, role-relevant opener${resumeSummary === "No resume provided." ? "" : " that references the candidate's background"}.`;

    const userPrompt = asked.length
      ? `Interview so far (most recent last):\n${JSON.stringify(transcript, null, 2)}\n\nEvaluate the most recent answer and produce the next question.`
      : `No questions have been asked yet. Produce the opening question. Set every evaluation score to 0 and summary to "interview start".`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "submit_turn" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("adaptive-interview AI error", aiRes.status, errText);
      if (aiRes.status === 429) return json({ error: "The interviewer is busy. Please try again in a few seconds." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits are exhausted. Please contact the hiring team." }, 402);
      return json({ error: "Could not generate the next question." }, 502);
    }

    const aiData = await aiRes.json();
    const args = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "Could not generate the next question." }, 502);

    const parsed = JSON.parse(args);
    const nq = parsed.next_question || {};
    const questionText = str(nq.question_text, 1000).trim();
    if (!questionText) return json({ error: "Could not generate the next question." }, 502);

    // Store the internal evaluation against the answer we just saved.
    if (isUuid(body.questionId) && parsed.evaluation) {
      await supabase
        .from("interview_answers")
        .update({ ai_evaluation: parsed.evaluation })
        .eq("interview_id", interview.id)
        .eq("question_id", body.questionId);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("interview_questions")
      .insert({
        interview_id: interview.id,
        question_text: questionText,
        question_type: normaliseType(nq.question_type),
        difficulty: normaliseDifficulty(nq.difficulty),
        question_order: asked.length,
        topic: str(nq.topic, 120),
        is_followup: !!nq.is_followup,
      })
      .select("id, question_text, question_type, difficulty, question_order, topic, is_followup")
      .single();

    if (insertError || !inserted) {
      console.error("adaptive-interview insert error", insertError);
      return json({ error: "Could not save the next question." }, 500);
    }

    const uniq = (arr: unknown) =>
      Array.from(new Set((Array.isArray(arr) ? arr : []).map((x) => String(x)).filter(Boolean))).slice(0, 40);

    const scores: number[] = [
      ...(Array.isArray(state.answerScores) ? state.answerScores : []),
      ...(asked.length && parsed.evaluation ? [Number(parsed.evaluation.answer_quality) || 0] : []),
    ];

    await supabase
      .from("interviews")
      .update({
        adaptive_state: {
          topicsCovered: uniq([...(state.topicsCovered || []), ...(parsed.topics_covered || []), nq.topic]),
          topicsToImprove: uniq(parsed.topics_to_improve),
          answerScores: scores.slice(-30),
          currentTopic: str(nq.topic, 120),
          lastEvaluation: parsed.evaluation || null,
          updatedAt: new Date().toISOString(),
        },
      })
      .eq("id", interview.id);

    return json({
      question: inserted,
      asked: asked.length + 1,
      total: targetCount,
      done: false,
    });
  } catch (err) {
    console.error("adaptive-interview error", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});