import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Loader2, RefreshCw, Mail, MailOpen, MousePointerClick, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface InviteRow {
  id: string;
  candidate_name: string | null;
  candidate_email: string | null;
  role: string;
  created_at: string;
  expires_at: string;
  used: boolean;
  email_status: string;
  email_sent_at: string | null;
  email_error: string | null;
  email_opened_at: string | null;
  link_clicked_at: string | null;
}

type Stage = "sent" | "failed" | "not_sent" | "opened" | "clicked" | "used" | "expired";

const isExpired = (r: InviteRow) => !r.used && new Date(r.expires_at).getTime() < Date.now();

export default function Invitations() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Stage>("all");

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const { data: jobs } = await supabase.from("job_roles").select("id, title").eq("created_by", user!.id);
    if (!jobs?.length) { setRows([]); setLoading(false); return; }
    const jobMap = Object.fromEntries(jobs.map(j => [j.id, j.title]));
    const { data: links } = await supabase
      .from("interview_links")
      .select("*")
      .in("job_role_id", jobs.map(j => j.id))
      .order("created_at", { ascending: false });
    setRows((links || []).map((l: any) => ({
      id: l.id,
      candidate_name: l.candidate_name,
      candidate_email: l.candidate_email,
      role: jobMap[l.job_role_id] || "Unknown",
      created_at: l.created_at,
      expires_at: l.expires_at,
      used: l.used,
      email_status: l.email_status || "not_sent",
      email_sent_at: l.email_sent_at,
      email_error: l.email_error,
      email_opened_at: l.email_opened_at,
      link_clicked_at: l.link_clicked_at,
    })));
    setLoading(false);
  };

  const matchesFilter = (r: InviteRow) => {
    switch (filter) {
      case "all": return true;
      case "sent": return r.email_status === "sent";
      case "failed": return r.email_status === "failed";
      case "not_sent": return r.email_status === "not_sent";
      case "opened": return !!r.email_opened_at;
      case "clicked": return !!r.link_clicked_at;
      case "used": return r.used;
      case "expired": return isExpired(r);
    }
  };

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    if (q && !(r.candidate_name || "").toLowerCase().includes(q) && !(r.candidate_email || "").toLowerCase().includes(q) && !r.role.toLowerCase().includes(q)) return false;
    return matchesFilter(r);
  });

  const counts = {
    total: rows.length,
    sent: rows.filter(r => r.email_status === "sent").length,
    failed: rows.filter(r => r.email_status === "failed").length,
    clicked: rows.filter(r => r.link_clicked_at).length,
    used: rows.filter(r => r.used).length,
    expired: rows.filter(isExpired).length,
  };

  const deliveryBadge = (r: InviteRow) => {
    if (r.email_status === "sent") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" /> Sent</Badge>
          </TooltipTrigger>
          <TooltipContent>{r.email_sent_at ? `Sent ${format(new Date(r.email_sent_at), "MMM d, h:mm a")}` : "Sent"}</TooltipContent>
        </Tooltip>
      );
    }
    if (r.email_status === "failed") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Failed</Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs break-words">{r.email_error || "Send error"}</TooltipContent>
        </Tooltip>
      );
    }
    return <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" /> Not sent</Badge>;
  };

  const linkStatus = (r: InviteRow) => {
    if (r.used) return <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" /> Used</Badge>;
    if (isExpired(r)) return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Expired</Badge>;
    return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Active</Badge>;
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invitations</h1>
          <p className="text-sm text-muted-foreground">Email delivery and tracking log for every interview link.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
        {[
          { label: "Total", value: counts.total },
          { label: "Sent", value: counts.sent },
          { label: "Failed", value: counts.failed },
          { label: "Clicked", value: counts.clicked },
          { label: "Used", value: counts.used },
          { label: "Expired", value: counts.expired },
        ].map(s => (
          <Card key={s.label}><CardContent className="py-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by candidate, email or role..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={v => setFilter(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All invitations</SelectItem>
            <SelectItem value="sent">Email sent</SelectItem>
            <SelectItem value="failed">Send failed</SelectItem>
            <SelectItem value="not_sent">Not sent</SelectItem>
            <SelectItem value="opened">Email opened</SelectItem>
            <SelectItem value="clicked">Link clicked</SelectItem>
            <SelectItem value="used">Used</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No invitations found.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="font-medium">{r.candidate_name || "Unnamed"}</p>
                    {r.candidate_email && <p className="text-xs text-muted-foreground">{r.candidate_email}</p>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.role}</Badge></TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {deliveryBadge(r)}
                      {r.email_status === "failed" && r.email_error && (
                        <p className="text-xs text-destructive max-w-[220px] break-words">{r.email_error}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {r.email_opened_at
                            ? <MailOpen className="h-4 w-4 text-primary" />
                            : <Mail className="h-4 w-4 text-muted-foreground/40" />}
                        </TooltipTrigger>
                        <TooltipContent>{r.email_opened_at ? `Opened ${format(new Date(r.email_opened_at), "MMM d, h:mm a")}` : "Not opened yet"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <MousePointerClick className={`h-4 w-4 ${r.link_clicked_at ? "text-primary" : "text-muted-foreground/40"}`} />
                        </TooltipTrigger>
                        <TooltipContent>{r.link_clicked_at ? `Clicked ${format(new Date(r.link_clicked_at), "MMM d, h:mm a")}` : "Not clicked yet"}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell>{linkStatus(r)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(r.created_at), "MMM d, h:mm a")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(r.expires_at), "MMM d, h:mm a")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
