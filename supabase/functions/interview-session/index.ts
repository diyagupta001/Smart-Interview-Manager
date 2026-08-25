// Public candidate endpoint. All candidate reads/writes go through here so the
// interview tables stay private (no anonymous Data API access).
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

const isToken = (v: unknown) =>
  typeof v === "string" && /^[0-9a-f]{16,128}$/i.test(v);

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : "";

const SUPPORTED_LANGUAGES = [
  "en", "hi", "pa", "hr-haryanvi", "bn", "mr", "gu", "ta", "te", "kn", "ml",
  "ur", "or", "as", "es", "fr", "de", "ar",
];
const normaliseLanguage = (v: unknown) => {
  const code = str(v, 24);
  return SUPPORTED_LANGUAGES.includes(code) ? code : "en";
};
const normaliseAnswerLanguage = (v: unknown) => {
  const code = str(v, 24);
  return code === "english" || code === "both" ? code : "same";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = str(body?.action, 32);

    // Resolve the link for token-based actions
    const loadLink = async (token: unknown) => {
      if (!isToken(token)) return null;
      const { data } = await supabase
        .from("interview_links")
        .select("id, expires_at, used, candidate_name, candidate_email, resume_data, interview_mode, available_languages, job_roles(*)")
        .eq("token", token)
        .maybeSingle();
      return data;
    };

    // Verify the interview exists and is still active
    const activeInterview = async (interviewId: unknown) => {
      if (!isUuid(interviewId)) return null;
      const { data } = await supabase
        .from("interviews")
        .select("id, status")
        .eq("id", interviewId)
        .maybeSingle();
      if (!data || (data.status !== "in_progress" && data.status !== "pending")) return null;
      return data;
    };

    if (action === "load") {
      const link = await loadLink(body.token);
      if (!link) return json({ valid: false, reason: "not_found" });
      if (link.used || new Date(link.expires_at) < new Date()) {
        return json({ valid: false, reason: "expired" });
      }
      const job: any = (link as any).job_roles;
      return json({
        valid: true,
        linkId: link.id,
        candidateName: link.candidate_name || "",
        candidateEmail: link.candidate_email || "",
        interviewMode: (link as any).interview_mode || "standard",
        hasResume: !!((link as any).resume_data && Object.keys((link as any).resume_data).length > 0),
        availableLanguages: (Array.isArray((link as any).available_languages) && (link as any).available_languages.length
          ? (link as any).available_languages
          : ["en"]
        ).filter((c: unknown) => SUPPORTED_LANGUAGES.includes(String(c))),
        job: {
          title: job?.title ?? "",
          description: job?.description ?? "",
          required_skills: job?.required_skills ?? [],
          question_count: job?.question_count ?? 8,
          time_per_question: job?.time_per_question ?? 120,
        },
      });
    }

    if (action === "start") {
      const link = await loadLink(body.token);
      if (!link) return json({ error: "Invalid link" }, 404);
      if (link.used || new Date(link.expires_at) < new Date()) {
        return json({ error: "Link expired" }, 403);
      }

      await supabase.from("interview_links").update({ used: true }).eq("id", link.id);

      // The candidate picks the interview language on the welcome screen; only a
      // language the creator enabled for this link is accepted.
      const allowed: string[] = (Array.isArray((link as any).available_languages) && (link as any).available_languages.length
        ? (link as any).available_languages
        : ["en"]).map((c: unknown) => String(c));
      const requested = normaliseLanguage(body.language);
      const interviewLanguage = allowed.includes(requested) ? requested : (allowed.find((c) => SUPPORTED_LANGUAGES.includes(c)) || "en");
      const answerLanguage = normaliseAnswerLanguage(body.answerLanguage);

      const { data: interview, error } = await supabase
        .from("interviews")
        .insert({
          link_id: link.id,
          candidate_name: link.candidate_name || "",
          candidate_email: link.candidate_email || "",
          status: "in_progress",
          started_at: new Date().toISOString(),
          interview_mode: (link as any).interview_mode || "standard",
          resume_data: (link as any).resume_data || {},
        })
        .select("id")
        .single();

      if (error || !interview) return json({ error: "Could not start interview" }, 500);
      return json({ interviewId: interview.id });
    }

    if (action === "answer") {
      const interview = await activeInterview(body.interviewId);
      if (!interview) return json({ error: "Invalid interview" }, 403);
      if (!isUuid(body.questionId)) return json({ ok: true, skipped: true });

      const seconds = Number(body.timeTakenSeconds);
      await supabase.from("interview_answers").insert({
        interview_id: interview.id,
        question_id: body.questionId,
        answer_text: str(body.answerText, 10000) || "(No answer provided)",
        time_taken_seconds: Number.isFinite(seconds) ? Math.max(0, Math.min(86400, Math.floor(seconds))) : 0,
      });
      return json({ ok: true });
    }

    if (action === "violation") {
      const interview = await activeInterview(body.interviewId);
      if (!interview) return json({ error: "Invalid interview" }, 403);

      const allowed = [
        "tab_switch", "no_face", "window_blur", "new_window",
        "copy_attempt", "shortcut_blocked",
      ];
      const type = allowed.includes(str(body.violationType, 32))
        ? str(body.violationType, 32)
        : "shortcut_blocked";
      const count = Number(body.count);

      await supabase.from("interview_violations").insert({
        interview_id: interview.id,
        violation_type: type,
        description: str(body.description, 500),
      });

      if (Number.isFinite(count)) {
        const safeCount = Math.max(0, Math.min(1000, Math.floor(count)));
        await supabase
          .from("interviews")
          .update({ tab_switch_count: safeCount, flagged: safeCount >= 2 })
          .eq("id", interview.id);
      }
      return json({ ok: true });
    }

    if (action === "complete") {
      const interview = await activeInterview(body.interviewId);
      if (!interview) return json({ error: "Invalid interview" }, 403);
      const status = body.status === "auto_submitted" ? "auto_submitted" : "completed";
      await supabase
        .from("interviews")
        .update({ status, completed_at: new Date().toISOString() })
        .eq("id", interview.id);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("interview-session error:", err);
    return json({ error: "Request failed" }, 500);
  }
});
