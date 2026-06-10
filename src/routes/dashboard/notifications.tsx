import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  Bell,
  Search,
  Inbox,
  CheckCircle2,
  Circle,
  Mail,
  MessageSquare,
  Webhook,
  CheckCheck,
  GitMerge,
  Loader2,
  RefreshCw,
  GitCommit,
  Tag,
  Shield,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/notifications")({
  component: NotificationsPage,
});

type NotificationChannel = "email" | "in_app" | "sms" | "webhook";

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
    committer: { name: string; date: string };
  };
  html_url: string;
}

interface RepoInfo {
  id: number;
  name: string;
  full_name: string;
  fork: boolean;
  description: string | null;
  html_url: string;
  parent?: { full_name: string; html_url: string };
  pushed_at: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function NotificationsPage() {
  const { profile, githubToken } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [upstreamUpdates, setUpstreamUpdates] = useState<Record<string, { behindBy: number; commits: GitHubCommit[] }>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, [profile?.id]);

  async function loadData() {
    setLoading(true);
    try {
      // Load notifications from GitHub API
      if (githubToken && githubToken !== "demo-token") {
        await loadNotifications(githubToken);
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  async function loadNotifications(token: string) {
    try {
      // Get all repos
      const reposRes = await fetch(
        "https://api.github.com/user/repos?per_page=100&type=all&sort=updated&direction=desc",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        }
      );
      if (!reposRes.ok) return;
      const reposData = await reposRes.json();
      setRepos(reposData);

      // Check forked repos for upstream updates
      const forkedRepos = reposData.filter((r: RepoInfo) => r.fork && r.parent);
      const notifs: any[] = [];
      const updates: Record<string, { behindBy: number; commits: GitHubCommit[] }> = {};

      // Process first 20 forks to avoid rate limits
      for (const repo of forkedRepos.slice(0, 20)) {
        try {
          // Get upstream latest commits
          const upstreamRes = await fetch(
            `https://api.github.com/repos/${repo.parent!.full_name}/commits?per_page=3`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
              },
            }
          );
          if (!upstreamRes.ok) continue;
          const upstreamCommits = await upstreamRes.json();
          if (!Array.isArray(upstreamCommits) || upstreamCommits.length === 0) continue;

          // Check if fork is behind
          const compareRes = await fetch(
            `https://api.github.com/repos/${repo.parent!.full_name}/compare/${repo.parent!.full_name.split("/")[1]}...${repo.full_name}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
              },
            }
          );

          let behindBy = 0;
          if (compareRes.ok) {
            const compareData = await compareRes.json();
            behindBy = compareData.behind_by || 0;
          } else {
            // Fallback: compare head commits
            const forkRes = await fetch(
              `https://api.github.com/repos/${repo.full_name}/commits/${repo.full_name.split("/")[1] || "main"}?per_page=1`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/vnd.github+json",
                },
              }
            );
            if (forkRes.ok) {
              const forkData = await forkRes.json();
              behindBy = upstreamCommits[0]?.sha !== forkData?.sha ? upstreamCommits.length : 0;
            }
          }

          if (behindBy > 0) {
            updates[repo.full_name] = {
              behindBy,
              commits: upstreamCommits,
            };

            notifs.push({
              id: `gh-${repo.id}`,
              title: `Upstream update: ${repo.parent!.full_name}`,
              body: `${repo.full_name} is ${behindBy} commit${behindBy > 1 ? 's' : ''} behind upstream. Latest: ${upstreamCommits[0]?.commit?.message?.slice(0, 80)}`,
              channel: "in_app",
              type: "fork_update",
              is_read: false,
              created_at: upstreamCommits[0]?.commit?.author?.date || repo.pushed_at,
              repo_full_name: repo.full_name,
              repository_id: repo.id,
              upstream_full_name: repo.parent!.full_name,
            });
          }
        } catch { /* silent */ }
      }

      setUpstreamUpdates(updates);
      setNotifications(notifs);
    } catch { /* silent */ }
  }

  async function handleSync(fullName: string) {
    if (!githubToken) return;
    setSyncing((prev) => ({ ...prev, [fullName]: true }));

    try {
      const repo = repos.find((r) => r.full_name === fullName);
      if (!repo || !repo.parent) return;

      // Get upstream default branch SHA
      const upstreamRes = await fetch(
        `https://api.github.com/repos/${repo.parent.full_name}/git/refs/heads/main`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
          },
        }
      );
      if (!upstreamRes.ok) return;
      const upstreamRef = await upstreamRes.json();
      const upstreamSha = upstreamRef.object.sha;

      // Update fork branch to match upstream
      const updateRes = await fetch(
        `https://api.github.com/repos/${fullName}/git/refs/heads/main`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sha: upstreamSha, force: false }),
        }
      );

      if (updateRes.ok) {
        // Remove from updates
        setUpstreamUpdates((prev) => {
          const next = { ...prev };
          delete next[fullName];
          return next;
        });
        setNotifications((prev) => prev.filter((n) => n.repo_full_name !== fullName));
      }
    } catch { /* silent */ }
    setSyncing((prev) => ({ ...prev, [fullName]: false }));
  }

  async function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, status: "read" } : n))
    );
  }

  async function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, status: "read" })));
  }

  const upstreamUpdatesCount = Object.keys(upstreamUpdates).length;

  const notificationStats = {
    total: notifications.length,
    unread: notifications.filter((n) => !n.is_read).length,
  };

  const filteredNotifs = notifications.filter((n) => {
    if (search) {
      const q = search.toLowerCase();
      if (!n.title?.toLowerCase().includes(q) && !n.body?.toLowerCase().includes(q)) return false;
    }
    if (statusFilter === "unread" && n.is_read) return false;
    if (statusFilter === "read" && !n.is_read) return false;
    return true;
  });

  return (
    <div className="px-6 py-6 lg:px-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fork Activity</h1>
          <p className="text-sm text-warm-400 mt-1">
            {notificationStats.total} upstream updates detected
          </p>
        </div>
        <div className="flex items-center gap-3">
          {upstreamUpdatesCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-400">
              <AlertTriangle className="h-3 w-3" />
              {upstreamUpdatesCount} need sync
            </span>
          )}
          {notificationStats.unread > 0 && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center gap-2 rounded-lg border border-[#1a1f35] bg-[#0c0f1a] px-4 py-2 text-sm font-medium text-warm-200 hover:bg-[#1a1f35] transition-colors"
            >
              <CheckCheck className="h-4 w-4" />
              Dismiss all
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#1a1f35] bg-[#0f1530] p-5">
          <p className="text-xs text-warm-400 uppercase tracking-wide">Updates Detected</p>
          <p className="mt-1 text-2xl font-bold text-white">{notificationStats.total}</p>
        </div>
        <div className="rounded-xl border border-[#1a1f35] bg-[#0f1530] p-5">
          <p className="text-xs text-warm-400 uppercase tracking-wide">Pending Sync</p>
          <p className="mt-1 text-2xl font-bold text-rose-400">{upstreamUpdatesCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            placeholder="Search fork activity..."
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
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#1a1f35] bg-[#0f1530] p-5">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-[#1a1f35] rounded w-3/4" />
                <div className="h-3 bg-[#1a1f35] rounded w-1/2" />
                <div className="h-3 bg-[#1a1f35] rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredNotifs.length === 0 ? (
        <div className="rounded-xl border border-[#1a1f35] bg-[#0f1530] p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1a1f35]">
            <Inbox className="h-8 w-8 text-warm-500" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-white">All forks are up to date</h3>
          <p className="mt-2 text-sm text-warm-400">No upstream updates detected.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifs.map((notification: any) => {
            const update = notification.repo_full_name ? upstreamUpdates[notification.repo_full_name] : null;
            const isSyncing = syncing[notification.repo_full_name];

            return (
              <div
                key={notification.id}
                className={`rounded-xl border p-5 shadow-sm transition-all ${
                  !notification.is_read
                    ? "border-rose-500/20 bg-rose-500/5"
                    : "border-[#1a1f35] bg-[#0f1530]"
                } hover:shadow-md`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 pt-0.5">
                    {!notification.is_read ? (
                      <Circle className="h-4 w-4 text-rose-400 fill-rose-400" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-warm-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-sm font-semibold truncate ${
                        !notification.is_read ? "text-white" : "text-warm-300"
                      }`}>
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-semibold text-rose-400 uppercase">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-warm-400 line-clamp-2">
                      {notification.body}
                    </p>

                    {/* Upstream commits */}
                    {update && update.commits && (
                      <div className="mt-3 space-y-1.5">
                        {update.commits.slice(0, 3).map((c: GitHubCommit, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-[11px] text-warm-400">
                            <GitCommit className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-1">{c.commit.message}</span>
                            <span className="shrink-0 text-warm-500">{timeAgo(c.commit.author.date)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-2 text-[11px] text-warm-500">
                      <span>{notification.repo_full_name}</span>
                      <span>·</span>
                      <span>{notification.created_at ? timeAgo(notification.created_at) : ''}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {!notification.is_read && notification.repo_full_name && (
                      <button
                        onClick={() => handleSync(notification.repo_full_name)}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50 btn-glow"
                        style={{
                          background: "linear-gradient(135deg, #e8f553, #c8d930)",
                          color: "#0a0d18",
                        }}
                      >
                        {isSyncing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        {isSyncing ? "Syncing..." : "Sync Code"}
                      </button>
                    )}
                    {!notification.is_read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="rounded-lg px-3 py-2 text-xs font-medium text-warm-400 hover:text-white hover:bg-white/5 transition-colors border border-[#1a1f35]"
                      >
                        Dismiss
                      </button>
                    )}
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