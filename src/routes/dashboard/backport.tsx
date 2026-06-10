import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  GitBranch,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  GitPullRequest,
  ExternalLink,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/backport")({
  component: BackportPage,
});

interface Repository {
  id: string;
  full_name: string;
  parent_full_name?: string;
  default_branch?: string;
}

interface CommitEntry {
  sha: string;
  message: string;
  author: string;
  date: string;
  is_backportable: boolean;
  reasons: string[];
  files_changed: number;
}

function BackportPage() {
  const { profile } = useAuth();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [featureBranch, setFeatureBranch] = useState("");
  const [targetBranch, setTargetBranch] = useState("main");
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [selectedShas, setSelectedShas] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState("");

  useEffect(() => {
    if (!profile?.id) return;
    loadRepos();
  }, [profile?.id]);

  async function loadRepos() {
    try {
      const res = await fetch("/api/v1/repositories");
      const json = await res.json();
      setRepos(Array.isArray(json) ? json.filter((r: any) => r.parent_full_name) : []);
    } catch {
      setRepos([]);
    }
  }

  async function handleAnalyze() {
    if (!selectedRepoId || !featureBranch.trim()) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setResult(null);
    setSelectedShas(new Set());
    try {
      const params = new URLSearchParams({
        feature_branch: featureBranch.trim(),
        target_upstream_branch: targetBranch,
      });
      const res = await fetch(`/api/v1/backport/${selectedRepoId}/analyze?${params}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }
      const data = await res.json();
      setAnalysis(data);
      // Auto-select all backportable commits
      const backportableShas = new Set<string>();
      (data.backportable_commits || []).forEach((c: CommitEntry) => backportableShas.add(c.sha));
      setSelectedShas(backportableShas);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleExecute() {
    if (!selectedRepoId || selectedShas.size === 0) return;
    setExecuting(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        feature_branch: featureBranch.trim(),
        target_upstream_branch: targetBranch,
        commit_shas: Array.from(selectedShas).join(","),
        create_pr: "true",
      });
      const res = await fetch(`/api/v1/backport/${selectedRepoId}/execute?${params}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Execution failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  }

  function toggleSha(sha: string) {
    setSelectedShas((prev) => {
      const next = new Set(prev);
      if (next.has(sha)) next.delete(sha);
      else next.add(sha);
      return next;
    });
  }

  const filteredRepos = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (r.parent_full_name || "").toLowerCase().includes(repoSearch.toLowerCase())
  );

  const selectedRepo = repos.find((r) => r.id === selectedRepoId);

  return (
    <div className="space-y-6 px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-warm-900 dark:text-white">
            <span className="inline-flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-primary" />
              Semantic Backporting
            </span>
          </h1>
          <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
            Selectively backport feature branch commits to upstream
          </p>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-warm-900 dark:text-white mb-4">Backport Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Repository */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1.5">
              Fork Repository
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
              <input
                placeholder="Search forks..."
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                className="w-full rounded-lg border border-warm-200 dark:border-warm-700 bg-warm-50 dark:bg-warm-950 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-2"
              />
            </div>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="w-full rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a fork…</option>
              {filteredRepos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name} ← {r.parent_full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Feature Branch */}
          <div>
            <label className="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1.5">
              Feature Branch
            </label>
            <input
              value={featureBranch}
              onChange={(e) => setFeatureBranch(e.target.value)}
              placeholder="e.g. feat/new-api"
              className="w-full rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Target Branch */}
          <div>
            <label className="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1.5">
              Target Upstream Branch
            </label>
            <input
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              placeholder="main"
              className="w-full rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleAnalyze}
            disabled={!selectedRepoId || !featureBranch.trim() || analyzing}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {analyzing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Analyze Backport
              </>
            )}
          </button>
          {analysis && (
            <button
              onClick={handleExecute}
              disabled={selectedShas.size === 0 || executing}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {executing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Executing…
                </>
              ) : (
                <>
                  <GitPullRequest className="h-4 w-4" />
                  Execute Backport ({selectedShas.size} commits)
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Error</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 dark:bg-primary/20 p-2.5">
                  <GitBranch className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-warm-900 dark:text-white">
                    {analysis.repo_name}
                  </h3>
                  <p className="text-xs text-warm-500">
                    {analysis.feature_branch} → {analysis.target_upstream_branch} · {analysis.upstream}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {analysis.backportable_count} backportable
                </span>
                <span className="text-warm-300 dark:text-warm-600">|</span>
                <span className="flex items-center gap-1.5 text-red-500">
                  <XCircle className="h-4 w-4" />
                  {analysis.non_backportable_count} skipped
                </span>
                <span className="text-warm-300 dark:text-warm-600">|</span>
                <span className="text-warm-500">{analysis.total_ahead_commits} ahead</span>
              </div>
            </div>
            <div className="mt-3 text-sm text-warm-600 dark:text-warm-300 bg-warm-50 dark:bg-warm-800/50 rounded-lg px-3 py-2">
              {analysis.recommendation}
            </div>
          </div>

          {/* Backportable Commits */}
          {analysis.backportable_commits?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-warm-900 dark:text-white mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Backportable Commits
                <span className="text-xs font-normal text-warm-400">(select which to include)</span>
              </h3>
              <div className="space-y-2">
                {analysis.backportable_commits.map((commit: CommitEntry) => (
                  <div
                    key={commit.sha}
                    onClick={() => toggleSha(commit.sha)}
                    className={`rounded-xl border p-4 shadow-sm cursor-pointer transition-all ${
                      selectedShas.has(commit.sha)
                        ? "border-primary/50 bg-primary/5 dark:bg-primary/10"
                        : "border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 hover:border-warm-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-colors ${
                          selectedShas.has(commit.sha)
                            ? "border-primary bg-primary text-white"
                            : "border-warm-300 dark:border-warm-600"
                        }`}
                      >
                        {selectedShas.has(commit.sha) && (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-warm-100 dark:bg-warm-800 px-1.5 py-0.5 rounded text-warm-600 dark:text-warm-300">
                            {commit.sha}
                          </code>
                          <span className="text-xs text-warm-400">{commit.author}</span>
                        </div>
                        <p className="text-sm text-warm-700 dark:text-warm-200 mt-1 line-clamp-2">
                          {commit.message}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-warm-400">
                          <span>{commit.files_changed} file(s) changed</span>
                          {commit.date && <span>{new Date(commit.date).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Non-Backportable Commits */}
          {analysis.non_backportable_commits?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-warm-900 dark:text-white mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-400" />
                Skipped Commits
              </h3>
              <div className="space-y-2">
                {analysis.non_backportable_commits.map((commit: CommitEntry) => (
                  <div key={commit.sha} className="rounded-xl border border-warm-200 dark:border-warm-800 bg-warm-50 dark:bg-warm-900/50 p-4 shadow-sm opacity-75">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-warm-100 dark:bg-warm-800 px-1.5 py-0.5 rounded text-warm-600 dark:text-warm-300">
                            {commit.sha}
                          </code>
                          <span className="text-xs text-warm-400">{commit.author}</span>
                        </div>
                        <p className="text-sm text-warm-500 dark:text-warm-400 mt-1 line-clamp-1">
                          {commit.message}
                        </p>
                        {commit.reasons?.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            {commit.reasons.map((reason: string, i: number) => (
                              <span key={i} className="text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded px-1.5 py-0.5">
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Execution Result */}
      {result && (
        <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900 p-2.5">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
                Backport Executed Successfully
              </h3>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-green-950/50 rounded-lg px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{result.cherry_picked_commits}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Cherry-picked</p>
                </div>
                <div className="bg-white dark:bg-green-950/50 rounded-lg px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-warm-900 dark:text-white">{result.failed_commits?.length || 0}</p>
                  <p className="text-xs text-warm-500">Failed</p>
                </div>
                <div className="bg-white dark:bg-green-950/50 rounded-lg px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-warm-900 dark:text-white">{result.pr_created ? "Yes" : "No"}</p>
                  <p className="text-xs text-warm-500">PR Created</p>
                </div>
                <div className="bg-white dark:bg-green-950/50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs font-mono text-warm-600 dark:text-warm-300 truncate">{result.backport_branch}</p>
                  <p className="text-xs text-warm-500">Branch</p>
                </div>
              </div>
              {result.pr_url && (
                <div className="mt-4">
                  <a
                    href={result.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Pull Request #{result.pr_number}
                  </a>
                </div>
              )}
              {result.failed_commits?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Failed Commits:</p>
                  {result.failed_commits.map((fc: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-red-500 mb-1">
                      <XCircle className="h-3 w-3" />
                      <code className="font-mono">{fc.sha}</code>
                      <span>{fc.error || fc.status}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setResult(null); setAnalysis(null); }}
                className="mt-4 text-sm text-primary dark:text-primary hover:underline"
              >
                ← Start new backport
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!analysis && !result && !error && (
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warm-100 dark:bg-warm-800">
            <ArrowRight className="h-8 w-8 text-warm-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-warm-900 dark:text-white">Ready to backport</h3>
          <p className="mt-2 text-sm text-warm-500 dark:text-warm-400 max-w-sm mx-auto">
            Select a fork repository, specify your feature branch, and analyze which commits can be safely backported to upstream.
          </p>
        </div>
      )}
    </div>
  );
}
