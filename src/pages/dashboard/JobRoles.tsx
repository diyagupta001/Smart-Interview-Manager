import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { INTERVIEW_LANGUAGES, DEFAULT_LANGUAGE_CODE } from "@/lib/languages";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Copy, Link as LinkIcon, Loader2, Search, Mail, FileText, Upload, X, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import emailjs from "@emailjs/browser";
import type { Database } from "@/integrations/supabase/types";

const EMAILJS_SERVICE_ID = "service_ktmsjhi";
const EMAILJS_TEMPLATE_ID = "template_yrknou5";
const EMAILJS_PUBLIC_KEY = "ivfLSVOohJQe7EtRU";

type JobRole = Database["public"]["Tables"]["job_roles"]["Row"];
type Difficulty = Database["public"]["Enums"]["difficulty_level"];

export default function JobRoles() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editing, setEditing] = useState<JobRole | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [questionCount, setQuestionCount] = useState(8);
  const [timePerQuestion, setTimePerQuestion] = useState(120);
  const [saving, setSaving] = useState(false);

  // Link generation
  const [sendEmail, setSendEmail] = useState(true);
  const [expiry, setExpiry] = useState("24h");
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>([DEFAULT_LANGUAGE_CODE]);
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Resume-based interview setup
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeData, setResumeData] = useState<any | null>(null);
  const [parsingResume, setParsingResume] = useState(false);

  useEffect(() => { loadJobs(); }, [user]);

  const loadJobs = async () => {
    if (!user) return;
    const { data } = await supabase.from("job_roles").select("*").eq("created_by", user.id).order("created_at", { ascending: false });
    setJobs(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setTitle(""); setDescription(""); setSkills(""); setDifficulty("medium"); setQuestionCount(8); setTimePerQuestion(120);
    setDialogOpen(true);
  };

  const openEdit = (job: JobRole) => {
    setEditing(job);
    setTitle(job.title); setDescription(job.description); setSkills(job.required_skills.join(", "));
    setDifficulty(job.difficulty); setQuestionCount(job.question_count); setTimePerQuestion(job.time_per_question);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    const skillsArr = skills.split(",").map(s => s.trim()).filter(Boolean);
    const payload = { title: title.trim(), description, required_skills: skillsArr, difficulty, question_count: questionCount, time_per_question: timePerQuestion, created_by: user.id };

    if (editing) {
      const { error } = await supabase.from("job_roles").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
      else toast({ title: "Job role updated" });
    } else {
      const { error } = await supabase.from("job_roles").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
      else toast({ title: "Job role created" });
    }
    setSaving(false);
    setDialogOpen(false);
    loadJobs();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("job_roles").delete().eq("id", id);
    toast({ title: "Job role deleted" });
    loadJobs();
  };

  const openLinkDialog = (jobId: string) => {
    setSelectedJobId(jobId);
    setCandidateName(""); setCandidateEmail(""); setGeneratedLink(""); setExpiry("24h"); setSendEmail(true); setEmailSent(false);
    setResumeFileName(""); setResumeData(null); setParsingResume(false);
    setLinkDialogOpen(true);
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleResumeUpload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload a resume under 10 MB.", variant: "destructive" });
      return;
    }
    setResumeFileName(file.name);
    setResumeData(null);
    setParsingResume(true);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const payload: Record<string, unknown> = { fileName: file.name, mimeType: file.type };
      if (isPdf) {
        payload.fileBase64 = await fileToBase64(file);
        payload.mimeType = "application/pdf";
      } else {
        payload.text = await file.text();
      }

      const { data, error } = await supabase.functions.invoke("parse-resume", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.resume) throw new Error("No resume details could be extracted.");

      setResumeData(data.resume);
      if (!candidateName.trim() && data.resume.candidate_name) setCandidateName(data.resume.candidate_name);
      toast({ title: "Resume analysed", description: "Questions will be personalised to this resume." });
    } catch (err: any) {
      console.error("Resume parse error:", err);
      setResumeFileName("");
      toast({
        title: "Couldn't analyse resume",
        description: err?.message || "Please try a text-based PDF or TXT file.",
        variant: "destructive",
      });
    } finally {
      setParsingResume(false);
    }
  };

  const clearResume = () => { setResumeFileName(""); setResumeData(null); };

  const generateLink = async () => {
    if (!user || !selectedJobId) return;
    if (sendEmail && !candidateEmail.trim()) {
      toast({ title: "Email required", description: "Please enter the candidate's email to send the link.", variant: "destructive" });
      return;
    }
    setGeneratingLink(true);
    const hours = expiry === "1h" ? 1 : expiry === "24h" ? 24 : 168;
    const expires_at = new Date(Date.now() + hours * 3600000).toISOString();

    const selectedJob = jobs.find(j => j.id === selectedJobId);

    const { data, error } = await supabase.from("interview_links").insert({
      job_role_id: selectedJobId,
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      expires_at,
      created_by: user.id,
      resume_data: resumeData ?? {},
      interview_mode: resumeData ? "resume_based" : "standard",
    }).select("id, token").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setGeneratingLink(false);
      return;
    }

    const link = `${window.location.origin}/interview/${data.token}`;
    setGeneratedLink(link);

    if (sendEmail && candidateEmail.trim()) {
      try {
        const expiryLabel = expiry === "1h" ? "1 hour" : expiry === "24h" ? "24 hours" : "7 days";
        const expiresOn = new Date(Date.now() + hours * 3600000).toLocaleString();
        const skillsList = selectedJob?.required_skills?.join(", ") || "General";

        // Tracking URLs (open pixel + click redirect through edge function)
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const origin = encodeURIComponent(window.location.origin);
        const trackBase = `https://${projectId}.functions.supabase.co/track-link`;
        const openPixelUrl = `${trackBase}?t=${data.token}&type=open`;
        const trackedLink = `${trackBase}?t=${data.token}&type=click&origin=${origin}`;

        const candidateDisplayName = candidateName.trim() || "Candidate";
        const roleTitle = selectedJob?.title || "the role";

        const emailMessage = `Hello ${candidateDisplayName},

You have been invited to take an AI-powered interview for the position of ${roleTitle}.

📋 Interview Details:
• Role: ${selectedJob?.title || "N/A"}
• Difficulty: ${selectedJob?.difficulty || "medium"}
• Number of Questions: ${selectedJob?.question_count || 0}
• Time per Question: ${selectedJob?.time_per_question || 0} seconds
• Key Skills: ${skillsList}

🔗 Your Interview Link:
${trackedLink}

⏰ This link expires in ${expiryLabel} (on ${expiresOn}) and can only be used once.

📝 Instructions:
1. Find a quiet place with a stable internet connection.
2. Click the link above when you're ready to begin.
3. Do not switch tabs or leave the interview window — this will be flagged.
4. Answer each question within the allotted time.

Best of luck!
The Intervia Hiring Team`;

        // Minimal, professional HTML email (white bg, subtle borders, single accent)
        const ACCENT = "#0f172a"; // slate-900 — swap to your brand hex if desired
        const htmlMessage = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Interview Invitation</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 20px 32px;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:13px;letter-spacing:.08em;color:#64748b;text-transform:uppercase;font-weight:600;">The Intervia Hiring Team</div>
          <h1 style="margin:8px 0 0 0;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700;">You're invited to interview</h1>
        </td></tr>
        <tr><td style="padding:24px 32px 8px 32px;">
          <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#334155;">Hi ${candidateDisplayName},</p>
          <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#334155;">You've been invited to take an AI-powered interview for the <strong style="color:#0f172a;">${roleTitle}</strong> position. Below are the details and your unique interview link.</p>
        </td></tr>
        <tr><td style="padding:0 32px 8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;">
            <tr><td style="padding:16px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#334155;">
                <tr><td style="padding:4px 0;color:#64748b;width:140px;">Role</td><td style="padding:4px 0;color:#0f172a;font-weight:600;">${selectedJob?.title || "N/A"}</td></tr>
                <tr><td style="padding:4px 0;color:#64748b;">Difficulty</td><td style="padding:4px 0;color:#0f172a;font-weight:600;text-transform:capitalize;">${selectedJob?.difficulty || "medium"}</td></tr>
                <tr><td style="padding:4px 0;color:#64748b;">Questions</td><td style="padding:4px 0;color:#0f172a;font-weight:600;">${selectedJob?.question_count || 0}</td></tr>
                <tr><td style="padding:4px 0;color:#64748b;">Time per question</td><td style="padding:4px 0;color:#0f172a;font-weight:600;">${selectedJob?.time_per_question || 0} seconds</td></tr>
                <tr><td style="padding:4px 0;color:#64748b;vertical-align:top;">Key skills</td><td style="padding:4px 0;color:#0f172a;font-weight:600;">${skillsList}</td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:24px 32px 8px 32px;">
          <a href="${trackedLink}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:8px;">Start Interview →</a>
        </td></tr>
        <tr><td align="center" style="padding:0 32px 20px 32px;">
          <p style="margin:8px 0 0 0;font-size:12px;color:#94a3b8;">Or paste this link into your browser:</p>
          <p style="margin:4px 0 0 0;font-size:12px;color:#475569;word-break:break-all;"><a href="${trackedLink}" style="color:#475569;text-decoration:underline;">${trackedLink}</a></p>
        </td></tr>
        <tr><td style="padding:8px 32px 20px 32px;">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;font-size:13px;color:#92400e;">
            ⏰ This link expires in <strong>${expiryLabel}</strong> (on ${expiresOn}) and can only be used once.
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <h3 style="margin:8px 0 8px 0;font-size:14px;color:#0f172a;font-weight:700;">Before you start</h3>
          <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.7;color:#334155;">
            <li>Find a quiet place with a stable internet connection.</li>
            <li>Click the button above when you're ready to begin.</li>
            <li>Do not switch tabs or leave the interview window — this is flagged.</li>
            <li>Answer each question within the allotted time.</li>
          </ul>
        </td></tr>
        <tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Best of luck! — The Intervia Hiring Team</p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#94a3b8;margin:16px 0 0 0;">If you didn't expect this email, you can safely ignore it.</p>
    </td></tr>
  </table>
  <img src="${openPixelUrl}" width="1" height="1" alt="" style="display:none;visibility:hidden;opacity:0;width:1px;height:1px;">
</body></html>`;

        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            candidate_email: candidateEmail.trim(),
            to_email: candidateEmail.trim(),
            email: candidateEmail.trim(),
            to_name: candidateDisplayName,
            candidate_name: candidateDisplayName,
            from_name: "Intervia",
            subject: `Interview Invitation — ${roleTitle}`,
            job_title: selectedJob?.title || "Interview",
            job_description: selectedJob?.description || "",
            difficulty: selectedJob?.difficulty || "medium",
            question_count: String(selectedJob?.question_count || 0),
            time_per_question: String(selectedJob?.time_per_question || 0),
            required_skills: skillsList,
            interview_link: trackedLink,
            tracking_pixel_url: openPixelUrl,
            expiry_label: expiryLabel,
            expires_on: expiresOn,
            message: emailMessage,
            html_message: htmlMessage,
          },
          { publicKey: EMAILJS_PUBLIC_KEY }
        );

        setEmailSent(true);
        await supabase.from("interview_links").update({
          email_status: "sent",
          email_sent_at: new Date().toISOString(),
          email_error: null,
        }).eq("id", data.id);
        toast({ title: "✅ Email sent successfully!", description: `Interview invitation delivered to ${candidateEmail.trim()}` });
      } catch (emailErr: any) {
        console.error("Email send error:", emailErr);
        const msg = emailErr?.text || emailErr?.message || "Could not send email. You can copy the link manually.";
        await supabase.from("interview_links").update({
          email_status: "failed",
          email_sent_at: new Date().toISOString(),
          email_error: String(msg).slice(0, 500),
        }).eq("id", data.id);
        toast({ title: "Link generated but email failed", description: msg, variant: "destructive" });
      }
    }

    setGeneratingLink(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast({ title: "Link copied to clipboard!" });
  };

  const filtered = jobs.filter(j => j.title.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Job Roles</h1>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Create Role</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search roles..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No job roles yet. Create your first one!</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((job, i) => (
            <motion.div key={job.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{job.title}</CardTitle>
                    <Badge variant={job.difficulty === "hard" ? "destructive" : job.difficulty === "medium" ? "secondary" : "outline"}>
                      {job.difficulty}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{job.description || "No description"}</p>
                  {job.required_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {job.required_skills.slice(0, 5).map(s => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                      {job.required_skills.length > 5 && <Badge variant="outline" className="text-xs">+{job.required_skills.length - 5}</Badge>}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">{job.question_count} questions · {job.time_per_question}s each</div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openLinkDialog(job.id)}>
                      <LinkIcon className="h-3 w-3" /> Generate Link
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(job)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(job.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Job Role" : "Create Job Role"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Software Developer" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Job description..." rows={3} /></div>
            <div className="space-y-2"><Label>Required Skills (comma-separated)</Label><Input value={skills} onChange={e => setSkills(e.target.value)} placeholder="React, TypeScript, Node.js" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={v => setDifficulty(v as Difficulty)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Questions</Label><Input type="number" value={questionCount} onChange={e => setQuestionCount(+e.target.value)} min={3} max={20} /></div>
              <div className="space-y-2"><Label>Time (s)</Label><Input type="number" value={timePerQuestion} onChange={e => setTimePerQuestion(+e.target.value)} min={30} max={600} /></div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Update" : "Create"} Role
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Interview Link</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Candidate Name (optional)</Label><Input value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="John Doe" /></div>
            <div className="space-y-2"><Label>Candidate Email {sendEmail && <span className="text-destructive">*</span>}</Label><Input type="email" value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} placeholder="john@example.com" /></div>
            <div className="space-y-2">
              <Label>Link Expiry</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 Hour</SelectItem>
                  <SelectItem value="24h">24 Hours</SelectItem>
                  <SelectItem value="7d">7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="send-email" className="cursor-pointer">Send email to candidate</Label>
              </div>
              <Switch id="send-email" checked={sendEmail} onCheckedChange={setSendEmail} />
            </div>

            {/* Resume-based interview setup */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>Resume-based interview (optional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Upload the candidate's resume (PDF or TXT) to personalise the AI questions.
                  </p>
                </div>
              </div>

              {!resumeData ? (
                <div className="space-y-2">
                  <Input
                    id="resume-upload"
                    type="file"
                    accept=".pdf,.txt,.md,application/pdf,text/plain"
                    disabled={parsingResume}
                    onChange={e => handleResumeUpload(e.target.files?.[0])}
                    className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
                  />
                  {parsingResume && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Analysing {resumeFileName}…
                    </p>
                  )}
                  {!parsingResume && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Upload className="h-3 w-3" /> No resume attached — a standard role-based interview will be used.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 rounded-md bg-muted p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-sm font-medium">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        {resumeData.candidate_name || "Resume analysed"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{resumeFileName}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={clearResume}><X className="h-3 w-3" /></Button>
                  </div>
                  {resumeData.headline && <p className="text-xs text-muted-foreground">{resumeData.headline}</p>}
                  {resumeData.years_experience && (
                    <p className="text-xs text-muted-foreground">Experience: {resumeData.years_experience}</p>
                  )}
                  {Array.isArray(resumeData.skills) && resumeData.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {resumeData.skills.slice(0, 8).map((s: string) => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                      {resumeData.skills.length > 8 && (
                        <Badge variant="outline" className="text-xs">+{resumeData.skills.length - 8}</Badge>
                      )}
                    </div>
                  )}
                  {Array.isArray(resumeData.projects) && resumeData.projects.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {resumeData.projects.length} project{resumeData.projects.length > 1 ? "s" : ""} detected — questions will reference them.
                    </p>
                  )}
                </div>
              )}
            </div>

            {!generatedLink ? (
              <Button onClick={generateLink} disabled={generatingLink || parsingResume} className="w-full gap-2">
                {generatingLink && <Loader2 className="h-4 w-4 animate-spin" />}
                {sendEmail ? <><Mail className="h-4 w-4" /> Generate & Send Link</> : "Generate Link"}
              </Button>
            ) : (
              <div className="space-y-3">
                {emailSent && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-3">
                    <Mail className="h-4 w-4 text-green-600" />
                    <p className="text-sm text-green-700 dark:text-green-400">Email sent to {candidateEmail}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
                  <code className="flex-1 text-xs break-all">{generatedLink}</code>
                  <Button size="sm" variant="outline" onClick={copyLink}><Copy className="h-3 w-3" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {emailSent ? "The link has been emailed. You can also copy it above." : "Share this link with the candidate. It can only be used once."}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
