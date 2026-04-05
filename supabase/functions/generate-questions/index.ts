import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { interviewId, jobTitle, jobDescription, skills, questionCount, difficulty } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const skillsList = (skills || []).join(", ");
    const systemPrompt = `You are an expert interviewer. Generate exactly ${questionCount || 8} interview questions for a ${jobTitle} position.

Job Description: ${jobDescription || "Not provided"}
Required Skills: ${skillsList || "General"}

Rules:
- Mix question types: technical (about skills/knowledge), hr (behavioral/cultural), scenario (situational problem-solving)
- Start with easier questions and gradually increase difficulty
- Questions must be specific to the ${jobTitle} role and required skills
- Each question should be clear and answerable in 2 minutes
- Do NOT ask generic questions unless they're tagged as "hr" type

Respond with a JSON array of objects, each with: question_text, question_type (technical/hr/scenario), difficulty (easy/medium/hard)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate ${questionCount} interview questions for ${jobTitle}. Return only a JSON array.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_questions",
            description: "Return the generated interview questions",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question_text: { type: "string" },
                      question_type: { type: "string", enum: ["technical", "hr", "scenario"] },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                    },
                    required: ["question_text", "question_type", "difficulty"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_questions" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let questionsArr: any[] = [];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      questionsArr = parsed.questions || [];
    }

    // Save questions to DB
    const savedQuestions = [];
    for (let i = 0; i < questionsArr.length; i++) {
      const q = questionsArr[i];
      const { data } = await supabase.from("interview_questions").insert({
        interview_id: interviewId,
        question_text: q.question_text,
        question_type: q.question_type,
        difficulty: q.difficulty,
        question_order: i,
      }).select("id, question_text, question_type, difficulty, question_order").single();

      if (data) savedQuestions.push(data);
    }

    return new Response(JSON.stringify({ questions: savedQuestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
