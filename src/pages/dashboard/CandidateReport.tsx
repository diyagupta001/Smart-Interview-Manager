import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, XCircle, Download, Eye, EyeOff, Monitor, Keyboard, Copy, Camera } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface Violation {
  id: string;
  violation_type: string;
  description: string;
  created_at: string;
}

const violationIcons: Record<string, any> = {
  tab_switch: Monitor,
  no_face: Camera,
  window_blur: EyeOff,
  new_window: Eye,
  copy_attempt: Copy,
  shortcut_blocked: Keyboard,
};

const violationLabels: Record<string, string> = {
  tab_switch: "Tab Switch",
  no_face: "No Face Detected",
  window_blur: "Window Lost Focus",
  new_window: "New Window Attempt",
  copy_attempt: "Copy Attempt",
  shortcut_blocked: "Blocked Shortcut",
};

export default function CandidateReport() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [score, setScore] = useState<any>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [violations, setViolations] = useState<Violation[]>([]);

  useEffect(() => { if (id) loadReport(); }, [id]);

  const loadReport = async () => {
    const { data: interviewData } = await supabase.from("interviews").select("*").eq("id", id).single();
    if (!interviewData) { setLoading(false); return; }
    setInterview(interviewData);

    const { data: link } = await supabase.from("interview_links").select("*, job_roles(title)").eq("id", interviewData.link_id).single();
    if (link) setJobTitle((link as any).job_roles?.title || "Unknown");

    const { data: qs } = await supabase.from("interview_questions").select("*").eq("interview_id", id!).order("question_order");
    setQuestions(qs || []);

    const { data: ans } = await supabase.from("interview_answers").select("*").eq("interview_id", id!);
    setAnswers(ans || []);

    const { data: sc } = await supabase.from("interview_scores").select("*").eq("interview_id", id!).single();
    setScore(sc);

    const { data: viol } = await supabase.from("interview_violations").select("*").eq("interview_id", id!).order("created_at");
    setViolations(viol || []);

    setLoading(false);
  };

  const exportPDF = () => {
    const violationText = violations.length > 0
      ? violations.map((v, i) => `${i + 1}. [${format(new Date(v.created_at), "HH:mm:ss")}] ${violationLabels[v.violation_type] || v.violation_type}: ${v.description}`).join("\n")
      : "None";

    const content = `
INTERVIEW REPORT
================
Candidate: ${interview?.candidate_name || "Anonymous"}
Email: ${interview?.candidate_email || "N/A"}
Role: ${jobTitle}
Date: ${interview ? format(new Date(interview.created_at), "PPP") : ""}
Status: ${score?.decision || "Pending"}

SCORES
------
Technical: ${score?.technical_score || 0}/100
Communication: ${score?.communication_score || 0}/100
Confidence: ${score?.confidence_score || 0}/100
Overall: ${score?.overall_rating || 0}/100

Decision: ${score?.decision === "selected" ? "✅ SELECTED" : "❌ REJECTED"}

FEEDBACK
--------
${score?.ai_feedback || "N/A"}

PROCTORING VIOLATIONS (${violations.length})
-------------------
${violationText}

QUESTIONS & ANSWERS
-------------------
${questions.map((q, i) => {
  const ans = answers.find(a => a.question_id === q.id);
  return `Q${i + 1} [${q.question_type}] (${q.difficulty}): ${q.question_text}\nA: ${ans?.answer_text || "No answer"}\nTime: ${ans?.time_taken_seconds || 0}s\n`;
}).join("\n")}

Tab Switches: ${interview?.tab_switch_count || 0}
Flagged: ${interview?.flagged ? "Yes" : "No"}
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-report-${interview?.candidate_name || "candidate"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!interview) return <div className="text-center py-12 text-muted-foreground">Interview not found.</div>;

  const scoreItems = [
    { label: "Technical", value: score?.technical_score || 0, color: "bg-primary" },
    { label: "Communication", value: score?.communication_score || 0, color: "bg-accent" },
    { label: "Confidence", value: score?.confidence_score || 0, color: "bg-warning" },
  ];

  // Group violations by type for summary
  const violationSummary = violations.reduce<Record<string, number>>((acc, v) => {
    acc[v.violation_type] = (acc[v.violation_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link to="/dashboard/candidates"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{interview.candidate_name || "Anonymous"}</h1>
          <p className="text-sm text-muted-foreground">{jobTitle} · {format(new Date(interview.created_at), "PPP")}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportPDF}>
          <Download className="h-4 w-4" /> Export Report
        </Button>
      </div>

      {/* Score Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        {scoreItems.map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
                <p className="text-3xl font-bold">{s.value}</p>
                <Progress value={s.value} className="mt-2 h-2" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className={score?.decision === "selected" ? "border-success/50" : "border-destructive/50"}>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Overall</p>
              <p className="text-3xl font-bold">{score?.overall_rating || 0}</p>
              <div className="mt-2">
                {score?.decision === "selected" ? (
                  <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" /> Selected</Badge>
                ) : score?.decision === "rejected" ? (
                  <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Flags */}
      {interview.flagged && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Suspicious Activity Detected</p>
              <p className="text-sm text-muted-foreground">{interview.tab_switch_count} violations recorded during interview</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proctoring Violations */}
      {violations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Proctoring Violations ({violations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(violationSummary).map(([type, count]) => {
                const Icon = violationIcons[type] || AlertTriangle;
                return (
                  <Badge key={type} variant="outline" className="gap-1.5 py-1">
                    <Icon className="h-3 w-3" />
                    {violationLabels[type] || type}: {count}
                  </Badge>
                );
              })}
            </div>

            {/* Timeline */}
            <div className="relative border-l-2 border-muted ml-3 space-y-3">
              {violations.map((v) => {
                const Icon = violationIcons[v.violation_type] || AlertTriangle;
                return (
                  <div key={v.id} className="flex items-start gap-3 pl-4 relative">
                    <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-destructive/20 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-destructive" />
                    </div>
                    <div className="flex-1 flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{violationLabels[v.violation_type] || v.violation_type}</span>
                      <span className="text-muted-foreground">— {v.description}</span>
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">
                        {format(new Date(v.created_at), "HH:mm:ss")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Feedback */}
      {score?.ai_feedback && (
        <Card>
          <CardHeader><CardTitle className="text-lg">AI Feedback</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">{score.ai_feedback}</p></CardContent>
        </Card>
      )}

      {/* Q&A */}
      {score?.debug_details && Object.keys(score.debug_details).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Evaluation Audit Trail</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <p><span className="text-muted-foreground">Answered:</span> {score.debug_details.answered_count}/{score.debug_details.total_questions} ({score.debug_details.answered_ratio_percent}%)</p>
              <p><span className="text-muted-foreground">Score cap from answer coverage:</span> {score.debug_details.score_cap_applied}</p>
              <p><span className="text-muted-foreground">Tab switches:</span> {score.debug_details.proctoring?.tab_switch_count} (penalty −{score.debug_details.proctoring?.tab_switch_penalty})</p>
              <p><span className="text-muted-foreground">Model:</span> {score.debug_details.model}</p>
            </div>
            <p className="text-xs text-muted-foreground">{score.debug_details.overall_formula}</p>
            <div className="space-y-2">
              {(score.debug_details.questions || []).map((q: any) => (
                <div key={q.index} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">Q{q.index}</Badge>
                    <Badge variant="outline" className="text-xs">{q.question_type}</Badge>
                    <Badge variant={q.counted_as_substantive ? "secondary" : "destructive"} className="text-xs">
                      {q.counted_as_substantive ? "Counted" : "Scored 0"}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">{q.answer_word_count} words · {q.time_taken_seconds}s</span>
                  </div>
                  <p className="font-medium">{q.question_text}</p>
                  <p className="text-muted-foreground mt-1">{q.recognized_answer || "(nothing recognized)"}</p>
                  {q.llm_grade && (
                    <div className="mt-2 rounded-md bg-muted/50 p-2 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">{q.llm_grade.verdict}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Tech {q.llm_grade.technical} · Comm {q.llm_grade.communication} · Conf {q.llm_grade.confidence}
                        </span>
                      </div>
                      {q.llm_grade.justification && <p className="text-xs">{q.llm_grade.justification}</p>}
                      {q.llm_grade.key_gaps && (
                        <p className="text-xs text-muted-foreground"><span className="font-medium">Gaps:</span> {q.llm_grade.key_gaps}</p>
                      )}
                      {q.llm_grade.ideal_answer && (
                        <p className="text-xs text-muted-foreground"><span className="font-medium">Ideal answer:</span> {q.llm_grade.ideal_answer}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Raw model output</summary>
              <pre className="mt-2 overflow-auto rounded-md bg-muted p-3">{JSON.stringify(score.debug_details.raw_model_scores, null, 2)}</pre>
            </details>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Questions & Answers</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {questions.map((q, i) => {
            const ans = answers.find(a => a.question_id === q.id);
            return (
              <div key={q.id} className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{q.question_type}</Badge>
                      <Badge variant="outline" className="text-xs">{q.difficulty}</Badge>
                      {ans && <span className="text-xs text-muted-foreground">{ans.time_taken_seconds}s</span>}
                    </div>
                    <p className="font-medium text-sm">{q.question_text}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{ans?.answer_text || "No answer provided"}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
