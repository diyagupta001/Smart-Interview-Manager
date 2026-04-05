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

    const systemPrompt = `You are an expert interview evaluator. Analyze the candidate's interview performance based on their answers.

Evaluate on three dimensions (0-100 each):
1. Technical Score - accuracy and depth of technical knowledge
2. Communication Score - clarity, structure, and articulation
3. Confidence Score - decisiveness, completeness, and conviction

Also provide:
- Overall rating (0-100, weighted: technical 40%, communication 35%, confidence 25%)
- Decision: "selected" if overall >= 60, "rejected" if below
- Brief personalized feedback (2-3 sentences)

Consider:
- Tab switches: ${interview?.tab_switch_count || 0} (penalize if > 2)
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

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      evaluation = {
        technical_score: parsed.technical_score ?? 50,
        communication_score: parsed.communication_score ?? 50,
        confidence_score: parsed.confidence_score ?? 50,
        overall_rating: parsed.overall_rating ?? 50,
        decision: parsed.decision === "selected" ? "selected" : "rejected",
        ai_feedback: parsed.ai_feedback || "Evaluation completed.",
      };
    }

    // Save scores
    await supabase.from("interview_scores").insert({
      interview_id: interviewId,
      ...evaluation,
    });

    return new Response(JSON.stringify({ score: evaluation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-interview error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
