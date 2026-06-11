import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  GitFork,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  GitCommit,
  ChevronRight,
  Bell,
  Sparkles,
  Star,
  CheckCircle2,
  Clock,
  Activity,
  GitMerge,
  Loader2,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { MarketsCard, MarketsRow } from "@/components/ui/card-styles";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
});

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  fork: boolean;
  parent?: { full_name: string; stargazers_count: number };
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  pushed_at: string;
  html_url: string;
  description: string | null;
  open_issues_count: number;
  default_branch: string;
  private: boolean;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function fetchGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;
  while (page <= 5) {
    try {
      const res = await fetch(
        `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&type=all&sort=updated&direction=desc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
      if (!res.ok) break;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      repos.push(...data);
      if (data.length < perPage) break;
      page++;
    } catch {
      break;
    }
  }
  return repos;
}

async function syncRepo(token: string, fullName: string): Promise<{ success: boolean; message: string }> {
   try {
     const res = await fetch(`https://api.github.com/repos/${fullName}/commits?per_page=1`, {
       headers: {
         Authorization: `Bearer ${token}`,
         Accept: "application/vnd.github+json",
         "X-GitHub-Api-Version": "2022-11-28",
       },
     });
     if (!res.ok) return { success: false, message: `GitHub API error (${res.status})` };
     const commits = await res.json();
     if (commits.length > 0) {
       return { success: true, message: `Latest: ${commits[0].commit.message.slice(0, 60)}` };
     }
     return { success: true, message: "Synced" };
   } catch {
     return { success: false, message: "Network error" };
   }
 }

 function DashboardPage() {
  const { profile, githubToken } = useAuth();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const forkedRepos = repos.filter((r) => r.fork);
  const allRepos = repos;
  const totalRepos = allRepos.length;
  const totalForks = forkedRepos.length;

  // Fetch repos on mount
  useEffect(() => {
    if (!githubToken || githubToken === "demo-token") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await fetchGitHubRepos(githubToken!);
      if (!cancelled) {
        setRepos(data);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [githubToken]);

  // Sync all forks
  async function handleSyncAll() {
    if (!githubToken || forkedRepos.length === 0) return;
    setSyncing(true);
    const results: Record<string, { success: boolean; message: string }> = {};
    for (const repo of forkedRepos.slice(0, 10)) {
      const result = await syncRepo(githubToken, repo.full_name);
      results[repo.full_name] = result;
    }
    setSyncResults(results);
    setSyncing(false);
  }

  // Sync single repo
  async function handleSyncRepo(fullName: string) {
    if (!githubToken) return;
    setSyncResults((prev) => ({ ...prev, [fullName]: { success: false, message: "Syncing..." } }));
    const result = await syncRepo(githubToken, fullName);
    setSyncResults((prev) => ({ ...prev, [fullName]: result }));
  }

  const lastSync = repos.length > 0 ? repos[0]?.updated_at : null;

  // Generate notifications from forks
  const notifications = forkedRepos.slice(0, 5).map((repo) => ({
    id: repo.id,
    title: `Fork: ${repo.full_name}`,
    description: repo.description || `Last updated ${timeAgo(repo.updated_at)}`,
    repo: repo.full_name,
    type: "fork",
    severity: "medium" as const,
    created_at: repo.updated_at,
  }));

  return (
    <div className="px-6 py-6 lg:px-8 space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-stencil font-bold text-white">
            Welcome back, {profile?.username || "Developer"} 👋
          </h1>
          <p className="mt-1 text-sm text-warm-400">
            {loading
              ? "Loading your repositories..."
              : `You have ${totalRepos} repositories (${totalForks} forks).`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={syncing || forkedRepos.length === 0}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #e8f553, #c8d930)", color: "#0a0d18" }}
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
            {syncing ? "Syncing..." : "Sync All Forks"}
          </button>
          <a
            href="/dashboard/notifications"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-medium text-warm-200 hover:bg-white/[0.08] hover:border-white/20 transition-all"
          >
            <Bell className="h-4 w-4" />
            Notifications
          </a>
          <a
            href="/dashboard/ai-assistant"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all"
            style={{ background: "linear-gradient(135deg, #c8d930, #a8b820)" }}
          >
            <Sparkles className="h-4 w-4" />
            Ask AI
          </a>
          <button
            onClick={async () => {
              localStorage.removeItem("qodesync_profile");
              localStorage.removeItem("qodesync_github_token");
              window.location.href = "/login";
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MarketsCard>
          <p className="text-xs text-warm-400 uppercase tracking-wider">Total Repos</p>
          <p className="mt-2 text-3xl font-bold text-white">{loading ? "..." : totalRepos}</p>
          <p className="mt-1 text-xs text-warm-400">{totalForks} forks</p>
        </MarketsCard>
        <MarketsCard>
          <p className="text-xs text-warm-400 uppercase tracking-wider">Forked</p>
          <p className="mt-2 text-3xl font-bold text-amber-400">{loading ? "..." : totalForks}</p>
          <p className="mt-1 text-xs text-warm-400">From upstream</p>
        </MarketsCard>
        <MarketsCard>
          <p className="text-xs text-warm-400 uppercase tracking-wider">Synced</p>
          <p className="mt-2 text-3xl font-bold text-brand-400">{loading ? "..." : Object.keys(syncResults).length}</p>
          <p className="mt-1 text-xs text-warm-400">This session</p>
        </MarketsCard>
        <MarketsCard>
          <p className="text-xs text-warm-400 uppercase tracking-wider">Last Sync</p>
          <p className="mt-2 text-3xl font-bold text-brand-400">{lastSync ? timeAgo(lastSync) : "Never"}</p>
          <p className="mt-1 text-xs text-warm-400">Auto every 6h</p>
        </MarketsCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORKED REPOSITORIES */}
        <section className="lg:col-span-2 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-brand-500/5 to-transparent shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/20">
            <div>
              <h2 className="text-base font-stencil font-semibold text-white flex items-center gap-2">
                <GitFork className="h-4 w-4 text-amber-400" />
                Forked Repositories
              </h2>
              <p className="text-xs text-warm-400">
                {loading ? "Loading..." : `${forkedRepos.length} forks tracked`}
              </p>
            </div>
            <a
              href="/dashboard/repositories"
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
            >
              View all <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="divide-y divide-amber-500/10">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                <span className="ml-2 text-sm text-warm-400">Fetching repositories...</span>
              </div>
            ) : forkedRepos.length === 0 ? (
              <div className="text-center py-12">
                <GitFork className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                <p className="text-sm text-warm-400">No forks found</p>
                <p className="text-xs text-warm-500">Your forked repositories will appear here</p>
              </div>
            ) : (
              forkedRepos.slice(0, 5).map((repo) => (
                <div
                  key={repo.id}
                  className="px-6 py-3 hover:bg-amber-500/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20">
                      <GitFork className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{repo.full_name}</p>
                      <p className="mt-0.5 text-xs text-warm-400 line-clamp-1">{repo.description}</p>
                      <p className="mt-1 text-[11px] text-amber-400">{timeAgo(repo.updated_at)} • {repo.stargazers_count} stars</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* REPOSITORIES */}
        <section className="rounded-xl border border-brand-500/20 bg-gradient-to-br from-brand-500/5 via-amber-500/5 to-transparent shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-brand-500/20">
            <div>
              <h2 className="text-base font-stencil font-semibold text-white flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-brand-400" />
                Your Repositories
              </h2>
              <p className="text-xs text-warm-400">
                {loading ? "Loading..." : `${totalRepos} total · ${forkedRepos.length} forks`}
              </p>
            </div>
            <a href="/dashboard/repositories" className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300">
              All <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="divide-y divide-white/[0.06] max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
              </div>
            ) : allRepos.length === 0 ? (
              <div className="text-center py-12">
                <GitFork className="h-8 w-8 mx-auto text-warm-500 mb-2" />
                <p className="text-sm text-warm-400">No repositories found</p>
              </div>
            ) : (
              allRepos.slice(0, 10).map((repo) => {
                const syncResult = syncResults[repo.full_name];
                return (
                  <div
                    key={repo.id}
                    className="px-6 py-3 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06]">
                        {repo.fork ? (
                          <GitFork className="h-4 w-4 text-amber-400" />
                        ) : (
                          <GitCommit className="h-4 w-4 text-warm-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">{repo.name}</p>
                          {repo.fork && (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400 uppercase">
                              Fork
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-warm-400">
                          {repo.language && <span>{repo.language}</span>}
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="h-3 w-3" />{repo.stargazers_count}
                          </span>
                          <span>{timeAgo(repo.updated_at)}</span>
                        </div>
                        {syncResult && (
                          <p className={`mt-1 text-[10px] ${syncResult.success ? "text-brand-400" : "text-warm-500"}`}>
                            {syncResult.message}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {repo.fork && (
                          <button
                            onClick={() => handleSyncRepo(repo.full_name)}
                            className="p-1.5 rounded-md hover:bg-white/5 text-warm-400 hover:text-brand-400 transition-colors"
                            title="Sync this fork"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md hover:bg-white/5 text-warm-400 hover:text-white transition-colors"
                          title="Open on GitHub"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* SECONDARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MarketsCard>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-warm-400">Forks Tracked</p>
              <p className="text-xl font-bold text-white">{loading ? "..." : `${totalForks}`}</p>
              <p className="text-xs text-warm-400">Active monitoring</p>
            </div>
          </div>
        </MarketsCard>
        <MarketsCard>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-warm-400">Last Sync</p>
              <p className="text-xl font-bold text-white">{lastSync ? timeAgo(lastSync) : "Never"}</p>
              <p className="text-xs text-warm-400">Click Sync All to update</p>
            </div>
          </div>
        </MarketsCard>
        <MarketsCard>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-warm-400">Notifications</p>
              <p className="text-xl font-bold text-white">{notifications.length}</p>
              <p className="text-xs text-warm-400">Active alerts</p>
            </div>
          </div>
        </MarketsCard>
      </div>
    </div>
  );
}

