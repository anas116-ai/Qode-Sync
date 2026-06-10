import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  GitFork,
  Search,
  RefreshCw,
  Star,
  AlertCircle,
  CheckCircle,
  XCircle,
  MoreVertical,
  ExternalLink,
  Bookmark,
  Activity,
  TrendingUp,
  ArrowLeft,
  Clock,
  GitCommit,
  GitPullRequest,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/repositories")({
  component: RepositoriesPage,
});

interface RepoItem {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  parent?: { full_name: string; html_url: string; default_branch: string };
  default_branch: string;
  updated_at: string;
  pushed_at: string;
}

interface UpstreamUpdate {
  hasUpdate: boolean;
  behindBy: number;
  latestCommit: string;
  latestCommitDate: string;
  latestCommitMessage: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function fetchAllGitHubRepos(token: string): Promise<RepoItem[]> {
  const repos: RepoItem[] = [];
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

async function checkForUpstreamUpdates(token: string, repo: RepoItem): Promise<UpstreamUpdate | null> {
  if (!repo.fork || !repo.parent) return null;
  try {
    // Get the fork's latest commit SHA
    const forkRes = await fetch(
      `https://api.github.com/repos/${repo.full_name}/commits/${repo.default_branch}?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    if (!forkRes.ok) return null;
    const forkData = await forkRes.json();
    const forkSha = forkData.sha;

    // Get upstream latest commits
    const upstreamRes = await fetch(
      `https://api.github.com/repos/${repo.parent.full_name}/commits?per_page=5`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    if (!upstreamRes.ok) return null;
    const upstreamData = await upstreamRes.json();

    // Compare - check if fork is behind upstream
    const compareRes = await fetch(
      `https://api.github.com/repos/${repo.parent.full_name}/compare/${repo.parent.full_name.split("/")[1]}...${repo.full_name}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    
    let behindBy = 0;
    let hasUpdate = false;
    let latestCommit = upstreamData[0]?.sha || "";
    let latestCommitDate = upstreamData[0]?.commit?.author?.date || "";
    let latestCommitMessage = upstreamData[0]?.commit?.message || "";

    if (compareRes.ok) {
      const compareData = await compareRes.json();
      behindBy = compareData.behind_by || 0;
      hasUpdate = behindBy > 0;
    } else {
      // Fallback: Check if upstream head differs from fork
      hasUpdate = upstreamData.length > 0 && upstreamData[0].sha !== forkSha;
      if (hasUpdate) {
        // Count how many upstream commits the fork is missing
        behindBy = upstreamData.filter((c: any) => c.sha !== forkSha).length;
      }
    }

    return { hasUpdate, behindBy, latestCommit, latestCommitDate, latestCommitMessage };
  } catch {
    return null;
  }
}

function RepositoriesPage() {
  const { profile, githubToken } = useAuth();
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [syncStatuses, setSyncStatuses] = useState<Record<string, string>>({});
  const [upstreamUpdates, setUpstreamUpdates] = useState<Record<string, UpstreamUpdate>>({});
  const [detectingUpdates, setDetectingUpdates] = useState(false);

  useEffect(() => {
    loadRepos();
  }, []);

  async function loadRepos() {
    if (!githubToken || githubToken === "demo-token") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAllGitHubRepos(githubToken);
      setRepos(data);
    } catch {
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }

  // Detect updates for all forked repos
  async function detectAllUpdates() {
    if (!githubToken || forkedRepos.length === 0 || detectingUpdates) return;
    setDetectingUpdates(true);
    const results: Record<string, UpstreamUpdate> = {};
    
    // Process a few at a time to avoid rate limits
    const batch = forkedRepos.slice(0, 20);
    for (const repo of batch) {
      const result = await checkForUpstreamUpdates(githubToken, repo);
      if (result && result.hasUpdate) {
        results[repo.full_name] = result;
      }
    }
    
    setUpstreamUpdates((prev) => ({ ...prev, ...results }));
    setDetectingUpdates(false);
    
    return results;
  }

  // Sync single repo - actually fetch upstream and merge
  async function handleSyncRepo(fullName: string) {
    if (!githubToken) return;
    setSyncStatuses((prev) => ({ ...prev, [fullName]: "Syncing..." }));
    
    try {
      const repo = repos.find((r) => r.full_name === fullName);
      if (!repo || !repo.fork || !repo.parent) {
        setSyncStatuses((prev) => ({ ...prev, [fullName]: "Not a fork or no upstream" }));
        return;
      }

      // Fetch upstream default branch
      const upstreamRes = await fetch(
        `https://api.github.com/repos/${repo.parent.full_name}/git/refs/heads/${repo.parent.default_branch || "main"}`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
          },
        }
      );
      if (!upstreamRes.ok) {
        setSyncStatuses((prev) => ({ ...prev, [fullName]: `GitHub API error (${upstreamRes.status})` }));
        return;
      }
      const upstreamRef = await upstreamRes.json();
      const upstreamSha = upstreamRef.object.sha;

      // Get the fork's latest commit SHA
      const forkRes = await fetch(
        `https://api.github.com/repos/${fullName}/git/refs/heads/${repo.default_branch || "main"}`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
          },
        }
      );
      if (!forkRes.ok) {
        setSyncStatuses((prev) => ({ ...prev, [fullName]: `Error getting fork ref` }));
        return;
      }
      const forkRef = await forkRes.json();
      const forkSha = forkRef.object.sha;

      if (upstreamSha === forkSha) {
        setSyncStatuses((prev) => ({ ...prev, [fullName]: "Already up to date ✓" }));
        setTimeout(() => setSyncStatuses((prev) => {
          const next = { ...prev };
          delete next[fullName];
          return next;
        }), 3000);
        return;
      }

      // Actually sync: Create a merge commit by updating the branch to upstream
      // This performs the actual sync by updating the fork's branch
      const updateRes = await fetch(
        `https://api.github.com/repos/${fullName}/git/refs/heads/${repo.default_branch || "main"}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sha: upstreamSha,
            force: false,
          }),
        }
      );

      if (updateRes.ok) {
        setSyncStatuses((prev) => ({ ...prev, [fullName]: "✓ Synced successfully" }));
        // Remove the update indicator since we just synced
        setUpstreamUpdates((prev) => {
          const next = { ...prev };
          delete next[fullName];
          return next;
        });
        // Refresh repos list
        loadRepos();
      } else {
        const errData = await updateRes.json().catch(() => ({}));
        setSyncStatuses((prev) => ({
          ...prev,
          [fullName]: `Merge needed: ${errData.message || "Conflicts may exist"}`,
        }));
      }
    } catch {
      setSyncStatuses((prev) => ({ ...prev, [fullName]: "Network error" }));
    }

    setTimeout(() => setSyncStatuses((prev) => {
      const next = { ...prev };
      delete next[fullName];
      return next;
    }), 5000);
  }

  const forkedRepos = repos.filter((r) => r.fork);
  const ownedRepos = repos.filter((r) => !r.fork);
  const hasNewUpdates = Object.keys(upstreamUpdates).length > 0;
  const newUpdatesCount = Object.values(upstreamUpdates).filter((u) => u.hasUpdate).length;

  const filteredRepos = repos.filter((repo) => {
    if (search) {
      const q = search.toLowerCase();
      if (!repo.full_name.toLowerCase().includes(q) && 
          !(repo.description || "").toLowerCase().includes(q) &&
          !(repo.language || "").toLowerCase().includes(q)) {
        return false;
      }
    }
    if (statusFilter === "forked") return repo.fork;
    if (statusFilter === "owned") return !repo.fork;
    if (statusFilter === "has-updates") return upstreamUpdates[repo.full_name]?.hasUpdate;
    return true;
  });

  return (
    <div className="px-6 py-6 lg:px-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Repositories</h1>
          <p className="text-sm text-warm-400 mt-1">
            {repos.length} total · {forkedRepos.length} forks · {newUpdatesCount} with updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={detectAllUpdates}
            disabled={detectingUpdates || forkedRepos.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-[#1a1f35] bg-[#0c0f1a] px-4 py-2.5 text-sm font-medium text-warm-200 hover:bg-[#1a1f35] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${detectingUpdates ? "animate-spin" : ""}`} />
            {detectingUpdates ? "Checking..." : newUpdatesCount > 0 ? `${newUpdatesCount} Updates Found` : "Check Updates"}
          </button>
          <button
            onClick={loadRepos}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-[#0a0d18] transition-colors shadow-sm"
            style={{ background: "linear-gradient(135deg, #e8f553, #c8d930)" }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#1a1f35] bg-[#0c0f1a] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-warm-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#1a1f35] bg-[#0c0f1a] px-4 py-2.5 text-sm text-warm-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All</option>
          <option value="forked">Forked</option>
          <option value="owned">Owned</option>
          <option value="has-updates">Has Updates</option>
        </select>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1a1f35] bg-[#0f1530] p-4">
          <p className="text-xs text-warm-400 uppercase tracking-wide">Total</p>
          <p className="mt-1 text-2xl font-bold text-white">{repos.length}</p>
        </div>
        <div className="rounded-xl border border-[#1a1f35] bg-[#0f1530] p-4">
          <p className="text-xs text-warm-400 uppercase tracking-wide">Forks</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">{forkedRepos.length}</p>
        </div>
        <div className="rounded-xl border border-[#1a1f35] bg-[#0f1530] p-4">
          <p className="text-xs text-warm-400 uppercase tracking-wide">Updates</p>
          <p className={`mt-1 text-2xl font-bold ${newUpdatesCount > 0 ? "text-rose-400" : "text-green-400"}`}>
            {newUpdatesCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#1a1f35] bg-[#0f1530] p-4">
          <p className="text-xs text-warm-400 uppercase tracking-wide">Own</p>
          <p className="mt-1 text-2xl font-bold text-brand-400">{ownedRepos.length}</p>
        </div>
      </div>

      {/* Repos Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#1a1f35] bg-[#0f1530] p-5">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-[#1a1f35] rounded w-3/4" />
                <div className="h-3 bg-[#1a1f35] rounded w-1/2" />
                <div className="h-3 bg-[#1a1f35] rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="rounded-xl border border-[#1a1f35] bg-[#0f1530] p-12 text-center">
          <GitFork className="h-12 w-12 mx-auto text-warm-500 mb-3" />
          <h3 className="text-sm font-semibold text-white">No repositories found</h3>
          <p className="mt-2 text-sm text-warm-400">
            {search ? "Try adjusting your search." : "Connect your GitHub account to see repos."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRepos.map((repo) => {
            const update = upstreamUpdates[repo.full_name];
            const syncMsg = syncStatuses[repo.full_name];
            return (
              <div
                key={repo.id}
                className="relative rounded-xl border border-[#1a1f35] bg-[#0f1530] p-5 shadow-sm hover:shadow-md hover:border-brand-500/20 transition-all"
              >
                {/* Update badge */}
                {update?.hasUpdate && (
                  <div className="absolute -top-2.5 right-4 z-10">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500 text-[10px] font-semibold text-white shadow-lg animate-pulse">
                      <AlertCircle className="h-3 w-3" />
                      New update available
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`rounded-lg p-2 flex-shrink-0 ${repo.fork ? "bg-amber-500/15" : "bg-brand-500/15"}`}>
                      <GitFork className={`h-4 w-4 ${repo.fork ? "text-amber-400" : "text-brand-400"}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate max-w-[200px]">
                        {repo.name}
                      </h3>
                      <p className="text-xs text-warm-400 truncate">
                        {repo.full_name}
                      </p>
                    </div>
                  </div>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-white/5 text-warm-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <p className="mt-3 text-xs text-warm-500 line-clamp-2 min-h-[2rem]">
                  {repo.description || "No description"}
                </p>

                <div className="mt-3 flex items-center gap-3 text-xs text-warm-400">
                  {repo.fork ? (
                    <span className="flex items-center gap-1">
                      <GitFork className="h-3 w-3" /> Forked
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <GitCommit className="h-3 w-3" /> Own
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />{repo.stargazers_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{timeAgo(repo.updated_at)}
                  </span>
                </div>

                {repo.language && (
                  <div className="mt-2">
                    <span className="inline-flex items-center rounded-md bg-[#1a1f35] px-2 py-0.5 text-[10px] font-medium text-warm-400">
                      {repo.language}
                    </span>
                  </div>
                )}

                {/* Update details */}
                {update?.hasUpdate && (
                  <div className="mt-3 rounded-lg bg-rose-500/5 border border-rose-500/15 p-3">
                    <p className="text-xs font-medium text-rose-400">
                      Behind by {update.behindBy} commit{update.behindBy > 1 ? 's' : ''}
                    </p>
                    <p className="mt-1 text-[10px] text-warm-400 line-clamp-1">
                      {update.latestCommitMessage.slice(0, 80)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-warm-500">
                      {update.latestCommitDate ? new Date(update.latestCommitDate).toLocaleDateString() : ''}
                    </p>
                  </div>
                )}

                {/* Sync message */}
                {syncMsg && (
                  <div className={`mt-2 text-xs ${syncMsg.includes('✓') ? 'text-green-400' : syncMsg.includes('Syncing') ? 'text-brand-400' : 'text-warm-400'}`}>
                    {syncMsg}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-[#1a1f35]">
                  <span className="text-[10px] text-warm-500">
                    {repo.default_branch}
                  </span>
                  <div className="flex items-center gap-1">
                    {repo.fork && repo.parent && (
                      <>
                        <button
                          onClick={() => handleSyncRepo(repo.full_name)}
                          className="p-1.5 rounded-md hover:bg-brand-500/10 text-warm-400 hover:text-brand-400 transition-colors"
                          title="Sync with upstream"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-warm-600 mx-0.5">|</span>
                      </>
                    )}
                    <button className="p-1.5 rounded-md hover:bg-white/5 text-warm-400 hover:text-white transition-colors">
                      <Bookmark className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}