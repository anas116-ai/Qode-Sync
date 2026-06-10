import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  GitMerge,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Activity,
  TrendingUp,
  ArrowUpRight,
  Search,
  Filter,
  Clock,
  GitBranch,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/auto-merge")({
  component: AutoMergePage,
});

function AutoMergePage() {
  const { profile } = useAuth();
  const [mergeJobs, setMergeJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [executing, setExecuting] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    loadMergeJobs();
  }, [profile?.id, statusFilter]);

  async function loadMergeJobs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/v1/auto-merge/merge-jobs?${params}`);
      const json = await res.json();
      setMergeJobs(Array.isArray(json) ? json : []);
    } catch {
      setMergeJobs([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleMerge(repoId: string) {
    setExecuting(repoId);
    try {
      // Step 1: Assess risk
      const assessRes = await fetch(
        `/api/v1/auto-merge/repositories/${repoId}/assess-risk?base_branch=main&head_branch=main`,
        { method: "POST" }
      );
      const assessment = await assessRes.json();

      if (!assessment.merge_job_id) {
        alert("Risk assessment failed");
        return;
      }

      if (!assessment.can_auto_merge) {
        const proceed = confirm(
          `Risk level: ${assessment.risk_level}. ${assessment.risk_factors?.join(", ") || ""}\n\nProceed with merge anyway?`
        );
        if (!proceed) return;
      }

      // Step 2: Execute merge
      const mergeRes = await fetch(
        `/api/v1/auto-merge/repositories/${repoId}/merge?merge_job_id=${assessment.merge_job_id}&force=true`,
        { method: "POST" }
      );
      const result = await mergeRes.json();
      alert(`Merge result: ${result.status}${result.merge_commit_sha ? `\nCommit: ${result.merge_commit_sha}` : ""}`);
      await loadMergeJobs();
    } catch (err) {
      alert("Merge failed: " + (err as Error).message);
    } finally {
      setExecuting(null);
    }
  }

  const stats = {
    total: mergeJobs.length,
    completed: mergeJobs.filter((j) => j.status === "completed").length,
    failed: mergeJobs.filter((j) => j.status === "failed" || j.status === "conflict").length,
    pending: mergeJobs.filter((j) => j.status === "pending" || j.status === "merging").length,
  };

  return (
    <div className="space-y-6 px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-warm-900 dark:text-white">
            <span className="inline-flex items-center gap-2">
              <GitMerge className="h-6 w-6 text-primary" />
              AI Auto-Merge
            </span>
          </h1>
          <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
            AI-powered merge with risk assessment & dependency resolution
          </p>
        </div>
        <button
          onClick={loadMergeJobs}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Merges" value={stats.total} icon={GitMerge} color="indigo" />
        <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} color="emerald" />
        <StatCard title="Failed" value={stats.failed} icon={XCircle} color="red" />
        <StatCard title="Pending" value={stats.pending} icon={Clock} color="amber" />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            placeholder="Search merge jobs..."
            className="w-full rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 pl-10 pr-4 py-2.5 text-sm placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="conflict">Conflict</option>
          <option value="pending">Pending</option>
          <option value="blocked">Blocked</option>
          <option value="rolled_back">Rolled Back</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-warm-200 dark:bg-warm-700 rounded w-3/4" />
                <div className="h-3 bg-warm-200 dark:bg-warm-700 rounded w-1/2" />
                <div className="h-3 bg-warm-200 dark:bg-warm-700 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : mergeJobs.length === 0 ? (
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warm-100 dark:bg-warm-800">
            <GitMerge className="h-8 w-8 text-warm-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-warm-900 dark:text-white">No merge jobs found</h3>
          <p className="mt-2 text-sm text-warm-500 dark:text-warm-400 max-w-sm mx-auto">
            Use the auto-merge feature to safely merge upstream changes into your forks.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mergeJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className={`rounded-lg p-2.5 flex-shrink-0 ${getStatusStyle(job.status).bg}`}>
                  {getStatusIcon(job.status, "h-5 w-5")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-warm-900 dark:text-white truncate">
                      Merge #{job.id.slice(0, 8)}
                    </h3>
                    <StatusBadge status={job.status} />
                    <RiskBadge level={job.risk_level} />
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-warm-500 dark:text-warm-400">
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {job.base_branch} ← {job.head_branch}
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-red-400" />
                      {job.behind_commits} behind
                    </span>
                    <span className="flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3 text-blue-400" />
                      {job.ahead_commits} ahead
                    </span>
                    {job.merge_commit_sha && (
                      <span className="font-mono text-[10px]">
                        SHA: {job.merge_commit_sha.slice(0, 12)}
                      </span>
                    )}
                  </div>
                  {job.error_message && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded px-2 py-1">
                      {job.error_message}
                    </p>
                  )}
                  {job.breaking_changes_detected && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Breaking changes detected during risk assessment
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-[10px] text-warm-400">
                    {job.created_at && <span>{new Date(job.created_at).toLocaleString()}</span>}
                    {job.completed_at && <span>Completed: {new Date(job.completed_at).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-start gap-2">
                  {job.status === "pending" && (
                    <button
                      onClick={() => handleMerge(job.repository_id)}
                      disabled={executing === job.repository_id}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {executing === job.repository_id ? "Merging..." : "Merge Now"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getStatusStyle(status: string) {
  switch (status) {
    case "completed": return { bg: "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400", text: "text-green-700" };
    case "failed": return { bg: "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400", text: "text-red-700" };
    case "conflict": return { bg: "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400", text: "text-orange-700" };
    case "blocked": return { bg: "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400", text: "text-amber-700" };
    case "merging": return { bg: "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400", text: "text-blue-700" };
    case "rolled_back": return { bg: "bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400", text: "text-purple-700" };
    default: return { bg: "bg-warm-100 dark:bg-warm-800 text-slate-600 dark:text-warm-400", text: "text-slate-600" };
  }
}

function getStatusIcon(status: string, className: string) {
  switch (status) {
    case "completed": return <CheckCircle2 className={className} />;
    case "failed": return <XCircle className={className} />;
    case "conflict": return <AlertTriangle className={className} />;
    case "blocked": return <Shield className={className} />;
    case "merging": return <Activity className={`${className} animate-pulse`} />;
    case "rolled_back": return <RefreshCw className={className} />;
    default: return <Clock className={className} />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const style = getStatusStyle(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.bg}`}>
      {status}
    </span>
  );
}

function RiskBadge({ level }: { level?: string }) {
  if (!level) return null;
  const colors: Record<string, string> = {
    safe: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
    low: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
    medium: "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400",
    high: "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400",
    critical: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[level] || colors.medium}`}>
      {level} risk
    </span>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  const colors: Record<string, string> = {
    indigo: "from-primary to-primary-600",
    emerald: "from-primary to-primary-600",
    red: "from-red-500 to-pink-500",
    amber: "from-amber-500 to-orange-500",
  };
  return (
    <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wide">{title}</p>
          <p className="mt-2 text-3xl font-bold text-warm-900 dark:text-white">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${colors[color]} text-white shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
