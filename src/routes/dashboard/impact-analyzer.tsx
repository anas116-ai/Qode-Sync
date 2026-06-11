import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FileCode,
  Filter,
  GitFork,
  Globe,
  RefreshCw,
  Search,
  Shield,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/impact-analyzer")({
  component: ImpactAnalyzerPage,
});

interface Repository {
  id: string;
  full_name: string;
  parent_full_name?: string;
  default_branch?: string;
  parent_default_branch?: string;
}

function ImpactAnalyzerPage() {
  const { profile } = useAuth();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [impact, setImpact] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState("");
  const [crossRepoName, setCrossRepoName] = useState("");
  const [crossRepoImpact, setCrossRepoImpact] = useState<any>(null);
  const [activeView, setActiveView] = useState<"single" | "cross">("single");

  useEffect(() => {
    if (!profile?.id) return;
    loadRepos();
  }, [profile?.id]);

  async function loadRepos() {
    try {
      const res = await fetch("/api/v1/repositories");
      const json = await res.json();
      setRepos(Array.isArray(json) ? json : []);
    } catch {
      setRepos([]);
    }
  }

  async function handleAnalyze() {
    if (!selectedRepoId) return;
    setAnalyzing(true);
    setError(null);
    setImpact(null);
    try {
      const params = new URLSearchParams({ base_branch: "main" });
      const res = await fetch(`/api/v1/impact/${selectedRepoId}?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }
      const data = await res.json();
      setImpact(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleCrossRepoAnalyze() {
    if (!crossRepoName.trim()) return;
    setAnalyzing(true);
    setError(null);
    setCrossRepoImpact(null);
    try {
      const res = await fetch(`/api/v1/impact/cross-repo/${encodeURIComponent(crossRepoName.trim())}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Cross-repo analysis failed");
      }
      const data = await res.json();
      setCrossRepoImpact(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const filteredRepos = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (r.parent_full_name || "").toLowerCase().includes(repoSearch.toLowerCase())
  );

  function getScoreColor(score: number) {
    if (score < 30) return "text-brand-500";
    if (score < 60) return "text-amber-500";
    return "text-red-500";
  }

  function getScoreBg(score: number) {
    if (score < 30) return "bg-brand-50 dark:bg-brand-950/30 border-brand-200 dark:border-brand-900";
    if (score < 60) return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900";
    return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900";
  }

  return (
    <div className="space-y-6 px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-warm-900 dark:text-white">
            <span className="inline-flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Impact Analyzer
            </span>
          </h1>
          <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
            Analyze upstream changes and predict impact on your forks
          </p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 rounded-lg bg-warm-100 dark:bg-warm-800 p-1 w-fit">
        <button
          onClick={() => setActiveView("single")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeView === "single"
              ? "bg-white dark:bg-warm-900 text-warm-900 dark:text-white shadow-sm"
              : "text-warm-500 hover:text-warm-700 dark:hover:text-warm-300"
          }`}
        >
          Single Fork Impact
        </button>
        <button
          onClick={() => setActiveView("cross")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeView === "cross"
              ? "bg-white dark:bg-warm-900 text-warm-900 dark:text-white shadow-sm"
              : "text-warm-500 hover:text-warm-700 dark:hover:text-warm-300"
          }`}
        >
          Cross-Repo Impact
        </button>
      </div>

      {/* Single Fork Impact */}
      {activeView === "single" && (
        <>
          <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-6 shadow-sm">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1.5">
                  Select Repository
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
                  <input
                    placeholder="Search repositories…"
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    className="w-full rounded-lg border border-warm-200 dark:border-warm-700 bg-warm-50 dark:bg-warm-950 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <select
                  value={selectedRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  className="w-full rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a repository…</option>
                  {filteredRepos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name}{r.parent_full_name ? ` ← ${r.parent_full_name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={!selectedRepoId || analyzing}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm h-[42px]"
              >
                {analyzing ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Analyzing…</>
                ) : (
                  <><BarChart3 className="h-4 w-4" /> Analyze Impact</>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Results */}
          {impact && (
            <div className="space-y-4">
              {/* Impact Score */}
              <div className={`rounded-xl border p-6 shadow-sm ${getScoreBg(impact.impact_score)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-warm-500 uppercase tracking-wide">Impact Score</p>
                    <p className={`text-5xl font-bold mt-1 ${getScoreColor(impact.impact_score)}`}>
                      {Math.round(impact.impact_score)}
                      <span className="text-lg font-normal text-warm-400">/100</span>
                    </p>
                    <p className="text-sm mt-2 text-warm-600 dark:text-warm-300 font-medium">
                      {impact.action_recommendation}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-warm-900 dark:text-white">{impact.repo_name}</p>
                    <p className="text-xs text-warm-500">vs {impact.upstream}</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Behind" value={impact.behind_count} icon={ArrowUpRight} color="red" />
                  <MetricCard label="Ahead" value={impact.ahead_count} icon={TrendingUp} color="amber" />
                  <MetricCard label="Commits" value={impact.total_commits} icon={GitFork} color="amber" />
                  <MetricCard label="Files Changed" value={impact.total_files_changed} icon={FileCode} color="amber" />
                </div>
              </div>

              {/* Categorized Changes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CategoryCard
                  title="API Changes"
                  data={impact.categorized_changes?.api_changes}
                  icon={Globe}
                  color="amber"
                />
                <CategoryCard
                  title="Config Changes"
                  data={impact.categorized_changes?.config_changes}
                  icon={Filter}
                  color="amber"
                />
                <CategoryCard
                  title="Dependency Changes"
                  data={impact.categorized_changes?.dependency_changes}
                  icon={GitFork}
                  color="rose"
                />
                <CategoryCard
                  title="Test Changes"
                  data={impact.categorized_changes?.test_changes}
                  icon={CheckCircle2}
                  color="brand"
                />
                <CategoryCard
                  title="Documentation Changes"
                  data={impact.categorized_changes?.documentation_changes}
                  icon={BookOpen}
                  color="warm"
                />
                <CategoryCard
                  title="Source Code Changes"
                  data={impact.categorized_changes?.source_code_changes}
                  icon={FileCode}
                  color="slate"
                  count={impact.categorized_changes?.source_code_changes?.count}
                />
              </div>

              {/* Breaking Changes */}
              {impact.categorized_changes?.breaking_changes?.count > 0 && (
                <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <h3 className="font-semibold text-red-700 dark:text-red-300">
                      Breaking Changes Detected ({impact.categorized_changes.breaking_changes.count})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {impact.categorized_changes.breaking_changes.details?.map((bc: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Shield className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                        <span className="text-red-600 dark:text-red-400">{bc.file}</span>
                        <span className="text-xs text-red-500">· {bc.reason}</span>
                        <span className="text-[10px] rounded bg-red-100 dark:bg-red-900 px-1.5 py-0.5 text-red-600 dark:text-red-400 font-medium">
                          {bc.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!impact && !error && (
            <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-12 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warm-100 dark:bg-warm-800">
                <Activity className="h-8 w-8 text-warm-400" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-warm-900 dark:text-white">Select a repository to analyze</h3>
              <p className="mt-2 text-sm text-warm-500 dark:text-warm-400 max-w-sm mx-auto">
                Analyze upstream changes and get a detailed breakdown of impact categories, risk scores, and actionable recommendations.
              </p>
            </div>
          )}
        </>
      )}

      {/* Cross-Repo Impact */}
      {activeView === "cross" && (
        <>
          <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-6 shadow-sm">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1.5">
                  Upstream Repository (e.g. owner/repo)
                </label>
                <input
                  value={crossRepoName}
                  onChange={(e) => setCrossRepoName(e.target.value)}
                  placeholder="e.g. facebook/react"
                  className="w-full rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={handleCrossRepoAnalyze}
                disabled={!crossRepoName.trim() || analyzing}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm h-[42px]"
              >
                {analyzing ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Analyzing…</>
                ) : (
                  <><GitFork className="h-4 w-4" /> Cross-Repo Analyze</>
                )}
              </button>
            </div>
          </div>

          {crossRepoImpact && (
            <div className="space-y-4">
              <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-warm-900 dark:text-white mb-4">
                  Cross-Repo Impact Summary for {crossRepoImpact.upstream}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-warm-50 dark:bg-warm-800/50 rounded-lg">
                    <p className="text-3xl font-bold text-warm-900 dark:text-white">{crossRepoImpact.total_forks}</p>
                    <p className="text-xs text-warm-500 mt-1">Total Forks</p>
                  </div>
                  <div className="text-center p-4 bg-warm-50 dark:bg-warm-800/50 rounded-lg">
                    <p className={`text-3xl font-bold ${getScoreColor(crossRepoImpact.average_impact_score)}`}>
                      {crossRepoImpact.average_impact_score}
                    </p>
                    <p className="text-xs text-warm-500 mt-1">Avg Impact Score</p>
                  </div>
                  <div className="text-center p-4 bg-warm-50 dark:bg-warm-800/50 rounded-lg">
                    <p className="text-3xl font-bold text-red-500">{crossRepoImpact.total_breaking_across_forks}</p>
                    <p className="text-xs text-warm-500 mt-1">Total Breaking Changes</p>
                  </div>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-warm-900 dark:text-white">Fork Breakdown</h3>
              <div className="space-y-2">
                {crossRepoImpact.fork_impacts?.map((fork: any, i: number) => (
                  <div key={i} className={`rounded-xl border p-4 shadow-sm ${
                    fork.error ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20" : getScoreBg(fork.impact_score)
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`rounded-lg p-2 flex-shrink-0 ${
                          fork.error ? "bg-red-100 dark:bg-red-950" :
                          fork.impact_score < 30 ? "bg-brand-100 dark:bg-brand-950" :
                          fork.impact_score < 60 ? "bg-amber-100 dark:bg-amber-950" :
                          "bg-red-100 dark:bg-red-950"
                        }`}>
                          <GitFork className="h-4 w-4 text-warm-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-warm-900 dark:text-white truncate">
                            {fork.fork_name}
                          </p>
                          {!fork.error && (
                            <p className="text-xs text-warm-500">{fork.behind_count} commits behind</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {fork.error ? (
                          <span className="text-xs text-red-500">{fork.error}</span>
                        ) : (
                          <>
                            <span className={`text-lg font-bold ${getScoreColor(fork.impact_score)}`}>
                              {Math.round(fork.impact_score)}
                            </span>
                            {fork.breaking_changes > 0 && (
                              <span className="rounded bg-red-100 dark:bg-red-950 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                                {fork.breaking_changes} breaking
                              </span>
                            )}
                            <span className="text-[10px] text-warm-400 max-w-[120px] truncate">{fork.recommendation}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!crossRepoImpact && !error && (
            <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-12 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warm-100 dark:bg-warm-800">
                <GitFork className="h-8 w-8 text-warm-400" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-warm-900 dark:text-white">
                Analyze impact across all your forks
              </h3>
              <p className="mt-2 text-sm text-warm-500 dark:text-warm-400 max-w-sm mx-auto">
                Enter an upstream repository name to see how its changes affect every fork you track.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  const colorMap: Record<string, string> = {
    red: "text-red-500 bg-red-50 dark:bg-red-950/50",
    amber: "text-amber-500 bg-amber-50 dark:bg-amber-950/50",
  };
  return (
    <div className="bg-white dark:bg-warm-900/50 rounded-lg p-3 border border-warm-100 dark:border-warm-800">
      <div className="flex items-center gap-2">
        <div className={`rounded-md p-1.5 ${colorMap[color] || colorMap.amber}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-2xl font-bold text-warm-900 dark:text-white">{value}</span>
      </div>
      <p className="text-xs text-warm-500 mt-0.5">{label}</p>
    </div>
  );
}

function CategoryCard({ title, data, icon: Icon, color }: { title: string; data?: any; icon: any; color: string; count?: number }) {
  const files = data?.files || [];
  const count = data?.count || 0;
  const colorMap: Record<string, string> = {
    amber: "text-amber-500 bg-amber-50 dark:bg-amber-950/50",
    rose: "text-rose-500 bg-rose-50 dark:bg-rose-950/50",
    brand: "text-brand-500 bg-brand-50 dark:bg-brand-950/50",
    warm: "text-warm-500 bg-warm-50 dark:bg-warm-950/50",
    slate: "text-slate-500 bg-slate-50 dark:bg-slate-950/50",
  };
  return (
    <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`rounded-lg p-2 ${colorMap[color] || colorMap.slate}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-warm-900 dark:text-white">{title}</h4>
          <p className="text-xs text-warm-500">{count} file(s) changed</p>
        </div>
      </div>
      {files.length > 0 ? (
        <div className="space-y-1.5">
          {files.slice(0, 5).map((f: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-warm-600 dark:text-warm-300 truncate max-w-[200px]">{f.file}</span>
              <span className="text-warm-400 flex-shrink-0 ml-2">
                +{f.additions} -{f.deletions}
              </span>
            </div>
          ))}
          {files.length > 5 && (
            <p className="text-xs text-warm-400 mt-1">+{files.length - 5} more files</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-warm-400">No changes detected</p>
      )}
    </div>
  );
}
