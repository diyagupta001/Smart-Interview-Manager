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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Copy, Link as LinkIcon, Loader2, Search, Mail } from "lucide-react";
import { motion } from "framer-motion";
import type { Database } from "@/integrations/supabase/types";

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
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

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
    setLinkDialogOpen(true);
  };

  const generateLink = async () => {
    if (!user || !selectedJobId) return;
    setGeneratingLink(true);
    const hours = expiry === "1h" ? 1 : expiry === "24h" ? 24 : 168;
    const expires_at = new Date(Date.now() + hours * 3600000).toISOString();

    const { data, error } = await supabase.from("interview_links").insert({
      job_role_id: selectedJobId,
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      expires_at,
      created_by: user.id,
    }).select("token").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const link = `${window.location.origin}/interview/${data.token}`;
      setGeneratedLink(link);
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

      {/* Link Generation Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Interview Link</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Candidate Name (optional)</Label><Input value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="John Doe" /></div>
            <div className="space-y-2"><Label>Candidate Email (optional)</Label><Input type="email" value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} placeholder="john@example.com" /></div>
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

            {!generatedLink ? (
              <Button onClick={generateLink} disabled={generatingLink} className="w-full">
                {generatingLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Link
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
                  <code className="flex-1 text-xs break-all">{generatedLink}</code>
                  <Button size="sm" variant="outline" onClick={copyLink}><Copy className="h-3 w-3" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">Share this link with the candidate. It can only be used once.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
