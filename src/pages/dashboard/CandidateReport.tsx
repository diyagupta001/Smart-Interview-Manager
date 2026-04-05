import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, XCircle, Download } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function CandidateReport() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [score, setScore] = useState<any>(null);
  const [jobTitle, setJobTitle] = useState("");

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

    setLoading(false);
  };

  const exportPDF = () => {
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
              <p className="text-sm text-muted-foreground">{interview.tab_switch_count} tab switches recorded during interview</p>
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
