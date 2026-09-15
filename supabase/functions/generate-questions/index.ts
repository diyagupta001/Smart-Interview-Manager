import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", pa: "Punjabi", "hr-haryanvi": "Haryanvi (colloquial Hindi dialect)", bn: "Bengali",
  mr: "Marathi", gu: "Gujarati", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam",
  ur: "Urdu", or: "Odia", as: "Assamese", es: "Spanish", fr: "French", de: "German", ar: "Arabic",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { interviewId, jobTitle, jobDescription, skills, questionCount, difficulty, language } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const skillsList = (skills || []).join(", ");
    const langCode = language || "en";
    const langName = LANGUAGE_NAMES[langCode] || "English";
    const buildLanguageBlock = (code: string) => {
      const name = LANGUAGE_NAMES[code] || "English";
      return code === "en" ? "" : `

LANGUAGE REQUIREMENT (critical):
- Write EVERY question in ${name}, using that language's native script.
- Keep established technical terms (e.g. "React", "REST API", "index", "join") in English inside the ${name} sentence so they stay unambiguous.
- Natural, spoken, interviewer-style phrasing — this text will be read aloud by text-to-speech in ${name}.
- Do not add translations, transliterations or English versions in brackets.`;
    };


    // Pull any resume the HR team attached to this invitation
    let resumeBlock = "";
    if (interviewId) {
      const { data: interviewRow } = await supabase
        .from("interviews")
        .select("resume_data, interview_mode")
        .eq("id", interviewId)
        .maybeSingle();
      const resume = interviewRow?.resume_data;
      if (resume && Object.keys(resume).length > 0) {
        resumeBlock = `

CANDIDATE RESUME (verified extract — never invent anything not listed here):
${JSON.stringify(resume).slice(0, 12000)}

Resume rules:
- At least half the questions must reference concrete items from the resume (specific projects, employers, tools, certifications).
- Probe depth on claimed skills; if a required job skill is missing from the resume, ask how they would approach it.
- Never invent experience the resume does not mention.`;
      }
    }

    const buildSystemPrompt = (code: string) => `You are an expert interviewer. Generate exactly ${questionCount || 8} interview questions for a ${jobTitle} position.

Job Description: ${jobDescription || "Not provided"}
Required Skills: ${skillsList || "General"}${resumeBlock}${buildLanguageBlock(code)}

Rules:
- Mix question types: technical (about skills/knowledge), hr (behavioral/cultural), scenario (situational problem-solving)
- Start with easier questions and gradually increase difficulty
- Questions must be specific to the ${jobTitle} role and required skills
- Each question should be clear and answerable in 2 minutes
- Do NOT ask generic questions unless they're tagged as "hr" type

Respond with a JSON array of objects, each with: question_text, question_type (technical/hr/scenario), difficulty (easy/medium/hard)`;

    const TOOLS = [{
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
    }];

    // Languages that must come back in a non-Latin script. If the model replies in
    // plain ASCII for one of these, it did not honour the language request.
    const NON_LATIN = ["hi", "bn", "mr", "gu", "ta", "te", "kn", "ml", "ur", "or", "as", "pa", "ar"];

    const attempt = async (code: string) => {
      const name = LANGUAGE_NAMES[code] || "English";
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: buildSystemPrompt(code) },
            { role: "user", content: `Generate ${questionCount} interview questions for ${jobTitle} in ${name}. Return only a JSON array.` },
          ],
          tools: TOOLS,
          tool_choice: { type: "function", function: { name: "return_questions" } },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI gateway error:", code, response.status, errText);
        return { status: response.status, questions: [] as any[] };
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let questions: any[] = [];
      if (toolCall?.function?.arguments) {
        try {
          questions = JSON.parse(toolCall.function.arguments).questions || [];
        } catch (_e) {
          questions = [];
        }
      }
      questions = questions.filter((q) => typeof q?.question_text === "string" && q.question_text.trim());

      // Script sanity check: a non-Latin language answered purely in ASCII is a miss.
      if (questions.length && NON_LATIN.includes(code)) {
        const joined = questions.map((q) => q.question_text).join(" ");
        // eslint-disable-next-line no-control-regex
        if (!/[^\u0000-\u024F]/.test(joined)) {
          console.error("Language mismatch: expected", code, "got Latin script only");
          return { status: 200, questions: [] as any[] };
        }
      }

      return { status: response.status, questions };
    };

    let usedLanguage = langCode;
    let languageFallback = false;
    let result = await attempt(langCode);

    // Rate limits and exhausted credits are transient/billing issues, not a language
    // problem — surface those instead of silently switching language.
    if (result.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (result.status === 402) {
      return new Response(JSON.stringify({ error: "Credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!result.questions.length && langCode !== "en") {
      console.warn("Falling back to English for interview", interviewId, "requested", langCode);
      const english = await attempt("en");
      if (english.questions.length) {
        result = english;
        usedLanguage = "en";
        languageFallback = true;
      }
    }

    if (!result.questions.length) {
      throw new Error("AI could not generate questions");
    }

    // Save questions to DB
    const savedQuestions = [];
    for (let i = 0; i < result.questions.length; i++) {
      const q = result.questions[i];
      const { data } = await supabase.from("interview_questions").insert({
        interview_id: interviewId,
        question_text: q.question_text,
        question_type: q.question_type,
        difficulty: q.difficulty,
        question_order: i,
      }).select("id, question_text, question_type, difficulty, question_order").single();

      if (data) savedQuestions.push(data);
    }

    if (languageFallback && interviewId) {
      await supabase.from("interviews").update({ interview_language: "en" }).eq("id", interviewId);
    }

    return new Response(JSON.stringify({
      questions: savedQuestions,
      language: usedLanguage,
      languageFallback,
      requestedLanguage: langCode,
      requestedLanguageName: langName,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
