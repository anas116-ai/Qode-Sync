import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  Bell,
  Search,
  Filter,
  GitCommit,
  Tag,
  AlertTriangle,
  Shield,
  GitPullRequest,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  X,
  GitMerge,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/updates")({
  component: UpdatesPage,
});

type UpdateType = "commit" | "release" | "tag" | "security_advisory" | "breaking_change" | "pull_request_merged";
type UpdateSeverity = "critical" | "high" | "medium" | "low";

function UpdatesPage() {
  const { profile } = useAuth();
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [mergingUpdateId, setMergingUpdateId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    loadUpdates();
  }, [profile?.id, statusFilter, severityFilter]);

  async function loadUpdates() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        user_id: profile.id,
        page: "1",
        page_size: "50",
        status: statusFilter === "new" ? "new" : statusFilter === "viewed" ? "viewed" : "",
      });
      const res = await fetch(`/api/v1/updates?${params}`);
      const json = await res.json();
      if (json.data) {
        let filtered = json.data;
        if (severityFilter !== "all") {
          filtered = filtered.filter((u: any) => u.severity === severityFilter);
        }
        if (search) {
          const q = search.toLowerCase();
          filtered = filtered.filter(
            (u: any) =>
              u.title?.toLowerCase().includes(q) ||
              u.description?.toLowerCase().includes(q) ||
              u.update_type?.toLowerCase().includes(q)
          );
        }
        setUpdates(filtered);
      }
    } catch {
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }

  async function acknowledgeUpdate(id: string) {
    try {
      await fetch(`/api/v1/updates/${id}/acknowledge?user_id=${profile?.id}`, { method: "POST" });
      setUpdates((prev) => prev.filter((u) => u.id !== id));
    } catch {
      // silent
    }
  }

  async function handleMergeFromUpdate(update: any) {
    if (!profile?.id || mergingUpdateId) return;
    setMergingUpdateId(update.id);
    try {
      const repoId = update.repository_id;
      if (!repoId) {
        alert("No repository associated with this update");
        return;
      }
      const assessRes = await fetch(
        `/api/v1/auto-merge/repositories/${repoId}/assess-risk?base_branch=main&head_branch=main`,
        { method: "POST" }
      );
      if (!assessRes.ok) {
        const err = await assessRes.json();
        alert(`Risk assessment failed: ${err.detail || "Unknown error"}`);
        return;
      }
      const assessment = await assessRes.json();
      if (!assessment.merge_job_id) {
        alert("Risk assessment returned no job");
        return;
      }
      if (!assessment.can_auto_merge) {
        const proceed = window.confirm(
          `Risk level: ${assessment.risk_level}. Proceed with merge anyway?`
        );
        if (!proceed) return;
      }
      const mergeRes = await fetch(
        `/api/v1/auto-merge/repositories/${repoId}/merge?merge_job_id=${assessment.merge_job_id}&force=true`,
        { method: "POST" }
      );
      const result = await mergeRes.json();
      if (result.status === "completed") {
        alert(`✓ Merge successful! Commit: ${result.merge_commit_sha?.slice(0, 12) || "N/A"}`);
        await acknowledgeUpdate(update.id);
      } else if (result.status === "conflict") {
        alert(`⚠ Merge conflict. Manual resolution required.`);
      } else {
        alert(`✗ Merge failed: ${result.error_message || result.status}`);
      }
    } catch (err) {
      alert(`Merge failed: ${(err as Error).message}`);
    } finally {
      setMergingUpdateId(null);
    }
  }

  async function detectUpdates() {
    try {
      const res = await fetch(`/api/v1/updates/detect?user_id=${profile?.id}`, { method: "POST" });
      const json = await res.json();
      alert(json.message || "Update detection queued");
    } catch {
      // silent
    }
  }

  const updateStats = {
    total: updates.length,
    critical: updates.filter((u) => u.severity === "critical").length,
    new: updates.filter((u) => u.status === "new").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-warm-900 dark:text-white">Updates</h1>
          <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
            Track upstream changes across your forks
          </p>
        </div>
        <button
          onClick={detectUpdates}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors shadow-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Detect Updates
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
          <p className="text-sm text-warm-500 dark:text-warm-400">Total Updates</p>
          <p className="mt-1 text-2xl font-bold text-warm-900 dark:text-white">{updateStats.total}</p>
        </div>
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
          <p className="text-sm text-warm-500 dark:text-warm-400">Critical</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{updateStats.critical}</p>
        </div>
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
          <p className="text-sm text-warm-500 dark:text-warm-400">New</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{updateStats.new}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search updates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="viewed">Viewed</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
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
      ) : updates.length === 0 ? (
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warm-100 dark:bg-warm-800">
            <Bell className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-warm-900 dark:text-white">No updates found</h3>
          <p className="mt-2 text-sm text-warm-500 dark:text-warm-400 max-w-sm mx-auto">
            {search || statusFilter !== "all"
              ? "Try adjusting your filters."
              : "Your forks are up to date. Detect updates to check for new upstream changes."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((update: any) => (
            <div
              key={update.id}
              className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`rounded-lg p-2.5 flex-shrink-0 ${getSeverityBg(update.severity)}`}
                >
                  {getTypeIcon(update.update_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-warm-900 dark:text-white truncate">
                      {update.title}
                    </h3>
                    {update.status === "new" && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-warm-500 dark:text-warm-400 line-clamp-2">
                    {update.ai_summary || update.description || "No description available"}
                  </p>
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <SeverityBadge severity={update.severity} />
                    <TypeBadge type={update.update_type} />
                    <span className="text-xs text-warm-400 dark:text-warm-500">
                      {update.created_at ? new Date(update.created_at).toLocaleDateString() : ""}
                    </span>
                    {update.files_changed > 0 && (
                      <span className="text-xs text-warm-400 dark:text-warm-500">
                        {update.files_changed} files • +{update.additions || 0}/-{update.deletions || 0}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  {update.repository_id && update.update_type === "commit" && (
                    <button
                      onClick={() => handleMergeFromUpdate(update)}
                      disabled={mergingUpdateId === update.id}
                      className="rounded-lg p-2 text-white bg-primary hover:bg-primary-700 disabled:opacity-50 transition-colors"
                      title="Merge upstream changes"
                    >
                      {mergingUpdateId === update.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <GitMerge className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  {update.status === "new" && (
                    <button
                      onClick={() => acknowledgeUpdate(update.id)}
                      className="rounded-lg p-2 text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors"
                      title="Mark as viewed"
                    >
                      <CheckCircle2 className="h-5 w-5" />
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

function getSeverityBg(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400";
    case "high":
      return "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400";
    case "medium":
      return "bg-yellow-100 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400";
    default:
      return "bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400";
  }
}

function getTypeIcon(type: UpdateType) {
  const icons: Record<UpdateType, any> = {
    commit: GitCommit,
    release: Tag,
    tag: Tag,
    security_advisory: Shield,
    breaking_change: AlertTriangle,
    pull_request_merged: GitPullRequest,
  };
  const Icon = icons[type] || GitCommit;
  return <Icon className="h-5 w-5" />;
}

function SeverityBadge({ severity }: { severity: UpdateSeverity }) {
  const colors: Record<UpdateSeverity, string> = {
    critical: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 ring-1 ring-red-600/20",
    high: "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-400 ring-1 ring-orange-600/20",
    medium: "bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 ring-1 ring-yellow-600/20",
    low: "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400 ring-1 ring-brand-600/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[severity || "low"] || colors.low}`}>
      {(severity || "low").charAt(0).toUpperCase() + (severity || "low").slice(1)}
    </span>
  );
}

function TypeBadge({ type }: { type: UpdateType }) {
  const label = type?.replace(/_/g, " ") || "unknown";
  return (
    <span className="inline-flex items-center rounded-full bg-warm-100 dark:bg-warm-800 px-2.5 py-0.5 text-xs font-medium text-warm-600 dark:text-warm-400">
      {label}
    </span>
  );
}
