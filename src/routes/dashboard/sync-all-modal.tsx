import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  GitMerge,
  GitFork,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  TrendingUp,
  Shield,
} from "lucide-react";

interface SyncResult {
  repo_id: string;
  repo_name: string;
  status: "assessing" | "merging" | "completed" | "failed" | "skipped" | "up_to_date";
  risk_level?: string;
  merge_commit_sha?: string;
  error?: string;
}

export function SyncAllModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const [repos, setRepos] = useState<any[]>([]);
  const [results, setResults] = useState<SyncResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "running" | "done">("idle");

  useEffect(() => {
    if (!isOpen || !profile?.id) return;
    loadRepos();
  }, [isOpen, profile?.id]);

  async function loadRepos() {
    setPhase("loading");
    try {
      const res = await fetch(`/api/v1/repositories?user_id=${profile!.id}&page_size=100`);
      const json = await res.json();
      setRepos((json.data || []).filter((r: any) => r.is_fork && r.parent_full_name));
    } catch {
      setRepos([]);
    } finally {
      setPhase("idle");
    }
  }

  async function runSyncAll() {
    setIsRunning(true);
    setPhase("running");
    const syncResults: SyncResult[] = [];

    for (const repo of repos) {
      if (!repo.behind_count || repo.behind_count <= 0) {
        syncResults.push({
          repo_id: repo.id,
          repo_name: repo.full_name,
          status: "up_to_date",
        });
        setResults([...syncResults]);
        continue;
      }

      // Assess risk
      syncResults.push({ repo_id: repo.id, repo_name: repo.full_name, status: "assessing" });
      setResults([...syncResults]);

      try {
        const assessRes = await fetch(
          `/api/v1/auto-merge/repositories/${repo.id}/assess-risk?base_branch=${repo.default_branch || "main"}&head_branch=${repo.parent_default_branch || "main"}`,
          { method: "POST" }
        );
        if (!assessRes.ok) {
          syncResults[syncResults.length - 1] = {
            repo_id: repo.id,
            repo_name: repo.full_name,
            status: "failed",
            error: "Risk assessment failed",
          };
          setResults([...syncResults]);
          continue;
        }
        const assessment = await assessRes.json();

        if (!assessment.can_auto_merge) {
          syncResults[syncResults.length - 1] = {
            repo_id: repo.id,
            repo_name: repo.full_name,
            status: "skipped",
            risk_level: assessment.risk_level,
            error: `Risk level: ${assessment.risk_level}`,
          };
          setResults([...syncResults]);
          continue;
        }

        // Execute merge
        syncResults[syncResults.length - 1] = {
          repo_id: repo.id,
          repo_name: repo.full_name,
          status: "merging",
          risk_level: assessment.risk_level,
        };
        setResults([...syncResults]);

        const mergeRes = await fetch(
          `/api/v1/auto-merge/repositories/${repo.id}/merge?merge_job_id=${assessment.merge_job_id}&force=false`,
          { method: "POST" }
        );
        const result = await mergeRes.json();

        syncResults[syncResults.length - 1] = {
          repo_id: repo.id,
          repo_name: repo.full_name,
          status: result.status === "completed" ? "completed" : "failed",
          risk_level: result.risk_level,
          merge_commit_sha: result.merge_commit_sha,
          error: result.error_message,
        };
        setResults([...syncResults]);

      } catch (err) {
        syncResults[syncResults.length - 1] = {
          repo_id: repo.id,
          repo_name: repo.full_name,
          status: "failed",
          error: (err as Error).message,
        };
        setResults([...syncResults]);
      }
    }

    setPhase("done");
    setIsRunning(false);
  }

  if (!isOpen) return null;

  const stats = {
    total: results.length,
    completed: results.filter((r) => r.status === "completed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    up_to_date: results.filter((r) => r.status === "up_to_date").length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-warm-200 dark:border-warm-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-rosegold-600 text-white">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-warm-900 dark:text-white">Sync All Forks</h2>
              <p className="text-xs text-warm-500 dark:text-warm-400">
                Auto-merge safe upstream changes across {repos.length} forks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-warm-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {phase === "loading" && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {phase === "idle" && repos.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-center">
                  <p className="text-2xl font-bold text-warm-900 dark:text-white">{repos.length}</p>
                  <p className="text-xs text-warm-500">Total Forks</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{repos.filter((r) => r.behind_count > 0).length}</p>
                  <p className="text-xs text-red-500">Behind</p>
                </div>
                <div className="rounded-lg bg-brand-50 dark:bg-brand-950 p-3 text-center">
                  <p className="text-2xl font-bold text-brand-600">{repos.filter((r) => r.behind_count <= 0).length}</p>
                  <p className="text-xs text-brand-500">Up to Date</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{repos.filter((r) => r.behind_count > 0 && r.behind_count <= 5).length}</p>
                  <p className="text-xs text-amber-500">Safe Merge</p>
                </div>
              </div>

              <button
                onClick={runSyncAll}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                <GitMerge className="h-5 w-5" />
                Auto-Merge {repos.filter((r) => r.behind_count > 0).length} Safe Forks
              </button>
            </div>
          )}

          {phase === "running" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing forks... {results.filter((r) => r.status !== "assessing" && r.status !== "merging").length}/{repos.length}
              </div>
              <div className="space-y-1">
                {Array.from({ length: Math.min(3, results.filter(r => r.status === "merging" || r.status === "assessing").length) }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-warm-500 animate-pulse py-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Assessing risk...
                  </div>
                ))}
              </div>
              {results.filter(r => r.status !== "assessing" && r.status !== "merging").slice(0, 5).map((r) => (
                <div key={r.repo_id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm">
                  <span className="truncate flex-1">{r.repo_name}</span>
                  {r.status === "completed" ? (
                    <span className="flex items-center gap-1 text-brand-600 text-xs"><CheckCircle2 className="h-3 w-3" />Merged</span>
                  ) : r.status === "skipped" ? (
                    <span className="flex items-center gap-1 text-amber-600 text-xs"><Shield className="h-3 w-3" />{r.risk_level}</span>
                  ) : r.status === "failed" ? (
                    <span className="flex items-center gap-1 text-red-600 text-xs"><AlertTriangle className="h-3 w-3" />Failed</span>
                  ) : (
                    <span className="flex items-center gap-1 text-brand-600 text-xs"><CheckCircle2 className="h-3 w-3" />Up to date</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg bg-brand-50 dark:bg-brand-950 p-3 text-center">
                  <p className="text-2xl font-bold text-brand-600">{stats.completed}</p>
                  <p className="text-xs text-brand-500">Merged</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{stats.skipped}</p>
                  <p className="text-xs text-amber-500">Skipped</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                  <p className="text-xs text-red-500">Failed</p>
                </div>
                <div className="rounded-lg bg-warm-50 dark:bg-warm-950 p-3 text-center">
                  <p className="text-2xl font-bold text-warm-600">{stats.up_to_date}</p>
                  <p className="text-xs text-warm-500">Up to Date</p>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {results.map((r) => (
                  <div key={r.repo_id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm">
                    <span className="truncate flex-1">{r.repo_name}</span>
                    <span className={`text-xs flex items-center gap-1 ${
                      r.status === "completed" ? "text-brand-600" :
                      r.status === "failed" ? "text-red-600" :
                      r.status === "skipped" ? "text-amber-600" :
                      "text-warm-600"
                    }`}>
                      {r.status === "completed" ? <><CheckCircle2 className="h-3 w-3" />Merged</> :
                       r.status === "failed" ? <><AlertTriangle className="h-3 w-3" />{r.error?.slice(0, 30)}</> :
                       r.status === "skipped" ? <><Shield className="h-3 w-3" />{r.risk_level}</> :
                       <><CheckCircle2 className="h-3 w-3" />Up to date</>}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-warm-100 dark:bg-warm-800 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
