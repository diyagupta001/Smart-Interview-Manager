import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { interviewId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch questions and answers
    const { data: questions } = await supabase
      .from("interview_questions")
      .select("*")
      .eq("interview_id", interviewId)
      .order("question_order");

    const { data: answers } = await supabase
      .from("interview_answers")
      .select("*")
      .eq("interview_id", interviewId);

    const { data: interview } = await supabase
      .from("interviews")
      .select("*")
      .eq("id", interviewId)
      .single();

    const { data: violations } = await supabase
      .from("interview_violations")
      .select("violation_type, description, created_at")
      .eq("interview_id", interviewId)
      .order("created_at");

    // Build Q&A pairs
    const qaPairs = (questions || []).map((q: any) => {
      const ans = (answers || []).find((a: any) => a.question_id === q.id);
      return {
        question: q.question_text,
        type: q.question_type,
        difficulty: q.difficulty,
        answer: ans?.answer_text || "(No answer)",
        time_taken: ans?.time_taken_seconds || 0,
      };
    });

    const answered = qaPairs.filter((p) => {
      const t = (p.answer || "").replace(/\(No answer\)/gi, "").trim();
      return t.length >= 15 && /[a-zA-Z]{3,}/.test(t);
    });
    const answeredRatio = qaPairs.length ? answered.length / qaPairs.length : 0;

    const systemPrompt = `You are a STRICT expert interview evaluator. Be harsh and evidence-based. Never be generous.

Evaluate on three dimensions (0-100 each):
1. Technical Score - accuracy and depth of technical knowledge
2. Communication Score - clarity, structure, and articulation
3. Confidence Score - decisiveness, completeness, and conviction

MANDATORY RULES (violating these is a failed evaluation):
- An empty answer, "(No answer)", gibberish, random characters, a single word, or off-topic text scores 0 for ALL dimensions for that question.
- Do NOT award "benefit of the doubt" points. There is no baseline or participation score. A missing answer is a 0, never 40-60.
- Score each question independently, then average. If the candidate answered nothing, ALL scores MUST be 0 and the decision MUST be "rejected".
- Only answers that demonstrate real, correct, relevant knowledge may exceed 50.
- 0-20 = nothing/irrelevant, 21-40 = vague or mostly wrong, 41-60 = partially correct but shallow, 61-80 = solid and correct, 81-100 = expert, precise, well-structured.

Also provide:
- Overall rating (0-100, weighted: technical 40%, communication 35%, confidence 25%)
- Decision: "selected" only if overall >= 60, otherwise "rejected"
- Brief honest feedback (2-3 sentences) naming concrete gaps

Interview facts:
- Questions asked: ${qaPairs.length}
- Questions with a substantive answer: ${answered.length} (${Math.round(answeredRatio * 100)}%)
- Tab switches: ${interview?.tab_switch_count || 0} (penalize heavily if > 2)
- Auto-submitted: ${interview?.status === "auto_submitted" ? "Yes (suspicious)" : "No"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Evaluate this interview:\n\n${JSON.stringify(qaPairs, null, 2)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_evaluation",
            description: "Submit the interview evaluation scores",
            parameters: {
              type: "object",
              properties: {
                technical_score: { type: "integer", minimum: 0, maximum: 100 },
                communication_score: { type: "integer", minimum: 0, maximum: 100 },
                confidence_score: { type: "integer", minimum: 0, maximum: 100 },
                overall_rating: { type: "integer", minimum: 0, maximum: 100 },
                decision: { type: "string", enum: ["selected", "rejected"] },
                ai_feedback: { type: "string" },
              },
              required: ["technical_score", "communication_score", "confidence_score", "overall_rating", "decision", "ai_feedback"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_evaluation" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let evaluation = {
      technical_score: 50,
      communication_score: 50,
      confidence_score: 50,
      overall_rating: 50,
      decision: "pending" as const,
      ai_feedback: "Evaluation completed.",
    };

    let rawModelEvaluation: any = null;
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      rawModelEvaluation = parsed;
      evaluation = {
        technical_score: parsed.technical_score ?? 50,
        communication_score: parsed.communication_score ?? 50,
        confidence_score: parsed.confidence_score ?? 50,
        overall_rating: parsed.overall_rating ?? 50,
        decision: parsed.decision === "selected" ? "selected" : "rejected",
        ai_feedback: parsed.ai_feedback || "Evaluation completed.",
      };
    }

    // Deterministic guardrails: the model must never reward blank interviews.
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const cap = answeredRatio === 0 ? 0 : clamp(answeredRatio * 100);
    evaluation.technical_score = Math.min(clamp(evaluation.technical_score), cap);
    evaluation.communication_score = Math.min(clamp(evaluation.communication_score), cap);
    evaluation.confidence_score = Math.min(clamp(evaluation.confidence_score), cap);
    evaluation.overall_rating = clamp(
      evaluation.technical_score * 0.4 +
        evaluation.communication_score * 0.35 +
        evaluation.confidence_score * 0.25,
    );
    // Proctoring penalty
    const tabSwitches = interview?.tab_switch_count || 0;
    if (tabSwitches > 2) {
      evaluation.overall_rating = clamp(evaluation.overall_rating - (tabSwitches - 2) * 10);
    }
    evaluation.decision = (evaluation.overall_rating >= 60 ? "selected" : "rejected") as any;
    if (answered.length === 0) {
      evaluation.ai_feedback =
        "No substantive answers were provided during the interview, so the candidate could not be assessed on any dimension.";
    }

    // Audit trail: exactly what the score was computed from.
    const debug_details = {
      evaluated_at: new Date().toISOString(),
      model: "google/gemini-2.5-flash",
      questions: qaPairs.map((p, i) => {
        const text = (p.answer || "").replace(/\(No answer\)/gi, "").trim();
        return {
          index: i + 1,
          question_text: p.question,
          question_type: p.type,
          difficulty: p.difficulty,
          recognized_answer: text,
          answer_char_count: text.length,
          answer_word_count: text ? text.split(/\s+/).length : 0,
          time_taken_seconds: p.time_taken,
          counted_as_substantive: text.length >= 15 && /[a-zA-Z]{3,}/.test(text),
        };
      }),
      answered_count: answered.length,
      total_questions: qaPairs.length,
      answered_ratio_percent: Math.round(answeredRatio * 100),
      score_cap_applied: cap,
      raw_model_scores: rawModelEvaluation,
      final_scores: { ...evaluation },
      overall_formula: "technical*0.40 + communication*0.35 + confidence*0.25, capped by answered ratio",
      proctoring: {
        tab_switch_count: tabSwitches,
        tab_switch_penalty: tabSwitches > 2 ? (tabSwitches - 2) * 10 : 0,
        flagged: interview?.flagged ?? false,
        status: interview?.status ?? null,
        violations: violations || [],
      },
    };

    // Save scores
    await supabase.from("interview_scores").insert({
      interview_id: interviewId,
      ...evaluation,
      debug_details,
    });

    return new Response(JSON.stringify({ score: evaluation, debug_details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-interview error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
