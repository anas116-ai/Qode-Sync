import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  Rocket,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Clock,
  Server,
  Globe,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/deployments")({
  component: DeploymentsPage,
});

function DeploymentsPage() {
  const { profile } = useAuth();
  const [deployments, setDeployments] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    loadAll();
  }, [profile?.id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [configsRes, deploysRes] = await Promise.all([
        fetch(`/api/v1/auto-merge/deployment-configs`),
        fetch(`/api/v1/auto-merge/deployments?limit=50`),
      ]);
      if (configsRes.ok) {
        const data = await configsRes.json();
        setConfigs(Array.isArray(data) ? data : []);
      }
      if (deploysRes.ok) {
        const data = await deploysRes.json();
        setDeployments(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const stats = {
    total: deployments.length,
    healthy: deployments.filter((d) => d.status === "healthy").length,
    failed: deployments.filter((d) => d.status === "failed").length,
    deploying: deployments.filter((d) => d.status === "deploying" || d.status === "building").length,
  };

  return (
    <div className="space-y-6 px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-warm-900 dark:text-white">
            <span className="inline-flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" />
              GitOps Deployments
            </span>
          </h1>
          <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
            Auto-deploy to Kubernetes/Cloud when sync completes
          </p>
        </div>
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Deployments" value={stats.total} icon={Rocket} color="amber" />
        <StatCard title="Healthy" value={stats.healthy} icon={CheckCircle2} color="brand" />
        <StatCard title="Failed" value={stats.failed} icon={XCircle} color="red" />
        <StatCard title="In Progress" value={stats.deploying} icon={Loader2} color="amber" />
      </div>

      {configs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-warm-900 dark:text-white mb-3">Deployment Configs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {configs.map((config) => (
              <div key={config.id} className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gradient-to-br from-primary to-rosegold-500 p-2 text-white">
                    <Server className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold truncate">{config.name}</h3>
                    <p className="text-xs text-warm-500">{config.provider} • {config.environment}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  {config.auto_deploy && <span className="rounded bg-brand-100 dark:bg-brand-950 px-2 py-0.5 text-brand-700 dark:text-brand-400">auto-deploy</span>}
                  {config.deploy_on_sync && <span className="rounded bg-warm-100 dark:bg-warm-950 px-2 py-0.5 text-warm-700 dark:text-warm-400">on sync</span>}
                  {config.last_deployed_at && (
                    <span className="text-warm-400 ml-auto">{new Date(config.last_deployed_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-warm-900 dark:text-white mb-3">Recent Deployments</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-warm-200 dark:bg-warm-700 rounded w-1/2" />
                  <div className="h-3 bg-warm-200 dark:bg-warm-700 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : deployments.length === 0 ? (
          <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-12 text-center shadow-sm">
            <Rocket className="mx-auto h-8 w-8 text-warm-400" />
            <h3 className="mt-4 text-sm font-semibold">No deployments yet</h3>
            <p className="mt-2 text-xs text-warm-500">Configure deployment targets to auto-deploy on sync.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deployments.map((dep) => (
              <div key={dep.id} className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className={`rounded-lg p-2 flex-shrink-0 ${
                    dep.status === "healthy" ? "bg-brand-100 dark:bg-brand-950 text-brand-600" :
                    dep.status === "failed" ? "bg-red-100 dark:bg-red-950 text-red-600" :
                    "bg-amber-100 dark:bg-amber-950 text-amber-600"
                  }`}>
                    {dep.status === "healthy" ? <CheckCircle2 className="h-5 w-5" /> :
                     dep.status === "failed" ? <XCircle className="h-5 w-5" /> :
                     <Loader2 className="h-5 w-5 animate-spin" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{dep.version || dep.id.slice(0, 8)}</span>
                      <DeployStatusBadge status={dep.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-warm-400">
                      {dep.external_url && (
                        <a href={dep.external_url} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-1 text-primary dark:text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      )}
                      {dep.duration_ms && (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{(dep.duration_ms / 1000).toFixed(0)}s</span>
                      )}
                      <span>{dep.created_at ? new Date(dep.created_at).toLocaleString() : ""}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  const colors: Record<string, string> = {
    amber: "from-amber-500 to-orange-500",
    brand: "from-brand-500 to-brand-600",
    red: "from-red-500 to-rose-500",
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

function DeployStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    healthy: "bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-400",
    failed: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",        deploying: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
    rolled_back: "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config[status] || config.failed}`}>
      {status}
    </span>
  );
}
