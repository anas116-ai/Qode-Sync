import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  BarChart3,
  TrendingUp,
  Activity,
  GitFork,
  Star,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/analytics")({
  component: AnalyticsPage,
});

interface RepoAnalytic {
  id: string;
  name: string;
  behind: number;
  stars: number;
  sync_status?: string;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, subtitle }: StatCardProps) {
  return (
    <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-warm-500 dark:text-warm-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-warm-900 dark:text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-warm-500 dark:text-warm-400">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-primary/10 dark:bg-primary/20 p-3">
          <Icon className="h-5 w-5 text-primary dark:text-primary" />
        </div>
      </div>
    </div>
  );
}

interface BarChartProps {
  data: { name: string; value: number; color: string }[];
  maxValue: number;
}

function SimpleBarChart({ data, maxValue }: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-warm-400">
        No data available
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-warm-500 dark:text-warm-400 w-28 truncate">{item.name}</span>
          <div className="flex-1 h-6 bg-warm-100 dark:bg-warm-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(4, (item.value / Math.max(maxValue, 1)) * 100)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <span className="text-xs font-semibold text-warm-700 dark:text-warm-300 w-12 text-right">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<{
    total_forks: number;
    updated_forks: number;
    critical_updates: number;
    last_sync: string | null;
  } | null>(null);
  const [topRepos, setTopRepos] = useState<RepoAnalytic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    Promise.all([
      fetch(`/api/v1/analytics/stats?user_id=${profile.id}`).then((r) => r.json()),
      fetch(`/api/v1/analytics/top-repositories?user_id=${profile.id}&limit=10`).then((r) => r.json()),
    ])
      .then(([statsData, reposData]) => {
        setStats(statsData);
        setTopRepos(reposData || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile?.id]);

  const behindData = topRepos
    .filter((r) => r.behind > 0)
    .sort((a, b) => b.behind - a.behind)
    .slice(0, 8)
    .map((r) => ({
      name: r.name,
      value: r.behind,
      color: r.behind > 20 ? "#ef4444" : r.behind > 10 ? "#f97316" : "#f59e0b",
    }));

  const starsData = topRepos.slice(0, 8).map((r) => ({
    name: r.name,
    value: r.stars || 0,
    color: "#6366f1",
  }));

  const maxStars = Math.max(...starsData.map((d) => d.value), 1);
  const maxBehind = Math.max(...behindData.map((d) => d.value), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-warm-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
          Repository insights and trends across your forks
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Forks"
          value={loading ? "—" : stats?.total_forks || 0}
          icon={GitFork}
        />
        <StatCard
          title="Out of Sync"
          value={loading ? "—" : stats?.updated_forks || 0}
          icon={AlertTriangle}
          subtitle={
            stats && stats.total_forks > 0
              ? `${Math.round((stats.updated_forks / stats.total_forks) * 100)}% need attention`
              : "No data"
          }
        />
        <StatCard
          title="Critical Updates"
          value={loading ? "—" : stats?.critical_updates || 0}
          icon={TrendingUp}
          subtitle={stats && stats.critical_updates > 0 ? "Requires immediate action" : "All clear"}
        />
        <StatCard
          title="Last Sync"
          value={
            loading
              ? "—"
              : stats?.last_sync
                ? new Date(stats.last_sync).toLocaleString()
                : "Never"
          }
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 shadow-sm">
          <div className="px-6 py-4 border-b border-warm-200 dark:border-warm-800">
            <h2 className="text-base font-semibold text-warm-900 dark:text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Commits Behind Upstream
            </h2>
            <p className="text-xs text-warm-500 dark:text-warm-400 mt-1">
              How many commits your forks are behind
            </p>
          </div>
          <div className="p-6">
            <SimpleBarChart data={behindData} maxValue={maxBehind} />
          </div>
        </div>

        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 shadow-sm">
          <div className="px-6 py-4 border-b border-warm-200 dark:border-warm-800">
            <h2 className="text-base font-semibold text-warm-900 dark:text-white flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Star Count by Repository
            </h2>
            <p className="text-xs text-warm-500 dark:text-warm-400 mt-1">
              Top repositories by stars
            </p>
          </div>
          <div className="p-6">
            <SimpleBarChart data={starsData} maxValue={maxStars} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 shadow-sm">
        <div className="px-6 py-4 border-b border-warm-200 dark:border-warm-800">
          <h2 className="text-base font-semibold text-warm-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            All Repositories
          </h2>
        </div>
        {loading ? (
          <div className="divide-y divide-warm-200 dark:divide-warm-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4">
                <div className="animate-pulse flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-warm-200 dark:bg-warm-700 rounded w-40" />
                    <div className="h-3 bg-warm-200 dark:bg-warm-700 rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : topRepos.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-warm-300 dark:text-warm-600" />
            <p className="mt-3 text-sm text-warm-500 dark:text-warm-400">
              No analytics data yet. Sync your repositories first.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-warm-200 dark:divide-warm-800">
            {topRepos.map((repo) => (
              <div
                key={repo.id || repo.name}
                className="px-6 py-4 flex items-center justify-between hover:bg-warm-50 dark:hover:bg-warm-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 dark:bg-primary/20 p-2">
                    <GitFork className="h-4 w-4 text-primary dark:text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-warm-900 dark:text-white">{repo.name}</p>
                    <p className="text-xs text-warm-500 dark:text-warm-400">
                      {repo.sync_status || "unknown"} status
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {repo.behind > 0 && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {repo.behind} behind
                    </span>
                  )}
                  <span className="text-xs text-warm-500 dark:text-warm-400 flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {repo.stars || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
