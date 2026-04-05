import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface CandidateRow {
  interviewId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  decision: string;
  score: number;
  flagged: boolean;
  date: string;
}

export default function Candidates() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => { if (user) loadCandidates(); }, [user]);

  const loadCandidates = async () => {
    const { data: jobs } = await supabase.from("job_roles").select("id, title").eq("created_by", user!.id);
    if (!jobs?.length) { setLoading(false); return; }

    const jobMap = Object.fromEntries(jobs.map(j => [j.id, j.title]));
    setRoles([...new Set(jobs.map(j => j.title))]);

    const { data: links } = await supabase.from("interview_links").select("*").in("job_role_id", jobs.map(j => j.id));
    if (!links?.length) { setLoading(false); return; }

    const linkMap = Object.fromEntries(links.map(l => [l.id, l]));
    const { data: interviews } = await supabase.from("interviews").select("*").in("link_id", links.map(l => l.id)).order("created_at", { ascending: false });
    if (!interviews?.length) { setLoading(false); return; }

    const { data: scores } = await supabase.from("interview_scores").select("*").in("interview_id", interviews.map(i => i.id));
    const scoreMap = Object.fromEntries((scores || []).map(s => [s.interview_id, s]));

    const result: CandidateRow[] = interviews.map(i => {
      const link = linkMap[i.link_id];
      const score = scoreMap[i.id];
      return {
        interviewId: i.id,
        name: i.candidate_name || link?.candidate_name || "Anonymous",
        email: i.candidate_email || link?.candidate_email || "",
        role: link ? jobMap[link.job_role_id] || "Unknown" : "Unknown",
        status: i.status,
        decision: score?.decision || "pending",
        score: score?.overall_rating || 0,
        flagged: i.flagged,
        date: i.created_at,
      };
    });

    setRows(result);
    setLoading(false);
  };

  const filtered = rows.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter !== "all" && r.role !== roleFilter) return false;
    if (statusFilter !== "all" && r.decision !== statusFilter) return false;
    return true;
  });

  const decisionBadge = (d: string) => {
    if (d === "selected") return <Badge className="bg-success text-success-foreground">Selected</Badge>;
    if (d === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Candidates</h1>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="selected">Selected</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No candidates found.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.interviewId}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{r.name}</p>
                      {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.role}</Badge></TableCell>
                  <TableCell><span className="font-semibold">{r.score}/100</span></TableCell>
                  <TableCell>{decisionBadge(r.decision)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(r.date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{r.flagged && <AlertTriangle className="h-4 w-4 text-destructive" />}</TableCell>
                  <TableCell>
                    <Link to={`/dashboard/candidates/${r.interviewId}`}>
                      <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
