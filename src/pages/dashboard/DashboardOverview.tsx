import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, CheckCircle2, XCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const CHART_COLORS = ["hsl(230,80%,56%)", "hsl(160,70%,42%)", "hsl(38,92%,50%)", "hsl(0,72%,51%)"];

export default function DashboardOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ jobs: 0, total: 0, selected: 0, rejected: 0, pending: 0, flagged: 0 });
  const [roleData, setRoleData] = useState<{ name: string; count: number }[]>([]);
  const [scoreData, setScoreData] = useState<{ name: string; avg: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    loadStats();
  }, [user]);

  const loadStats = async () => {
    const { data: jobs } = await supabase.from("job_roles").select("id, title").eq("created_by", user!.id);
    if (!jobs?.length) return;

    const jobIds = jobs.map(j => j.id);
    const { data: links } = await supabase.from("interview_links").select("id, job_role_id").in("job_role_id", jobIds);
    if (!links?.length) { setStats(s => ({ ...s, jobs: jobs.length })); return; }

    const linkIds = links.map(l => l.id);
    const { data: interviews } = await supabase.from("interviews").select("id, link_id, flagged").in("link_id", linkIds);
    if (!interviews?.length) { setStats(s => ({ ...s, jobs: jobs.length })); return; }

    const interviewIds = interviews.map(i => i.id);
    const { data: scores } = await supabase.from("interview_scores").select("*").in("interview_id", interviewIds);

    const selected = scores?.filter(s => s.decision === "selected").length || 0;
    const rejected = scores?.filter(s => s.decision === "rejected").length || 0;
    const flagged = interviews.filter(i => i.flagged).length;

    setStats({
      jobs: jobs.length,
      total: interviews.length,
      selected,
      rejected,
      pending: interviews.length - selected - rejected,
      flagged,
    });

    // Role distribution
    const roleCounts: Record<string, number> = {};
    links.forEach(l => {
      const job = jobs.find(j => j.id === l.job_role_id);
      if (job) roleCounts[job.title] = (roleCounts[job.title] || 0) + interviews.filter(i => i.link_id === l.id).length;
    });
    setRoleData(Object.entries(roleCounts).map(([name, count]) => ({ name, count })));

    // Avg scores per role
    const roleScores: Record<string, number[]> = {};
    links.forEach(l => {
      const job = jobs.find(j => j.id === l.job_role_id);
      if (!job) return;
      interviews.filter(i => i.link_id === l.id).forEach(interview => {
        const score = scores?.find(s => s.interview_id === interview.id);
        if (score) {
          if (!roleScores[job.title]) roleScores[job.title] = [];
          roleScores[job.title].push(score.overall_rating);
        }
      });
    });
    setScoreData(Object.entries(roleScores).map(([name, arr]) => ({
      name,
      avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    })));
  };

  const cards = [
    { label: "Job Roles", value: stats.jobs, icon: Briefcase, color: "text-primary" },
    { label: "Total Interviews", value: stats.total, icon: Users, color: "text-primary" },
    { label: "Selected", value: stats.selected, icon: CheckCircle2, color: "text-success" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-destructive" },
    { label: "Pending", value: stats.pending, icon: TrendingUp, color: "text-warning" },
    { label: "Flagged", value: stats.flagged, icon: AlertTriangle, color: "text-destructive" },
  ];

  const pieData = [
    { name: "Selected", value: stats.selected },
    { name: "Rejected", value: stats.rejected },
    { name: "Pending", value: stats.pending },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`rounded-lg bg-muted p-3 ${c.color}`}>
                  <c.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold">{c.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {roleData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Interviews by Role</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={roleData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(230,80%,56%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {pieData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Selection Rate</CardTitle></CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {stats.total === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No interviews yet</h3>
            <p className="text-sm text-muted-foreground">Create job roles and generate interview links to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
