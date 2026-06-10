import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  Share2,
  GitFork,
  Plus,
  CheckCircle2,
  RefreshCw,
  Activity,
  Network,
  Globe,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/sync-network")({
  component: SyncNetworkPage,
});

function SyncNetworkPage() {
  const { profile } = useAuth();
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNetwork, setSelectedNetwork] = useState<any>(null);

  useEffect(() => {
    if (!profile?.id) return;
    loadNetworks();
  }, [profile?.id]);

  async function loadNetworks() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/auto-merge/sync-networks`);
      const json = await res.json();
      setNetworks(Array.isArray(json) ? json : []);
    } catch {
      setNetworks([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadNetworkDetail(id: string) {
    try {
      const res = await fetch(`/api/v1/auto-merge/sync-networks/${id}`);
      const json = await res.json();
      setSelectedNetwork(json);
    } catch {
      setSelectedNetwork(null);
    }
  }

  async function triggerSync(networkId: string) {
    try {
      const res = await fetch(`/api/v1/auto-merge/sync-networks/${networkId}/sync`, { method: "POST" });
      const json = await res.json();
      alert(`Sync triggered: ${json.total_forks} fork(s) being synced`);
      await loadNetworkDetail(networkId);
    } catch {
      alert("Failed to trigger sync");
    }
  }

  return (
    <div className="space-y-6 px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-warm-900 dark:text-white">
            <span className="inline-flex items-center gap-2">
              <Share2 className="h-6 w-6 text-indigo-500" />
              Sync Networks
            </span>
          </h1>
          <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
            Federated auto-sync between multiple forks
          </p>
        </div>
        <button
          onClick={() => loadNetworks()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-warm-200 dark:bg-warm-700 rounded w-1/2" />
                <div className="h-3 bg-warm-200 dark:bg-warm-700 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : networks.length === 0 && !selectedNetwork ? (
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warm-100 dark:bg-warm-800">
            <Network className="h-8 w-8 text-warm-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-warm-900 dark:text-white">No sync networks</h3>
          <p className="mt-2 text-sm text-warm-500 dark:text-warm-400 max-w-sm mx-auto">
            Create a sync network to auto-synchronize multiple forks with their upstream repositories.
          </p>
        </div>
      ) : selectedNetwork ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedNetwork(null)}
            className="text-sm text-primary dark:text-primary hover:underline"
          >
            ← Back to networks
          </button>

          <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-warm-900 dark:text-white">{selectedNetwork.name}</h2>
                <p className="text-sm text-warm-500 mt-1">{selectedNetwork.description || "No description"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-green-100 dark:bg-green-950 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                  {selectedNetwork.status}
                </span>
                <button
                  onClick={() => triggerSync(selectedNetwork.id)}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700 transition-colors"
                >
                  <RefreshCw className="h-3 w-3 inline mr-1" />
                  Sync All
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-warm-500">Frequency</p>
                <p className="font-semibold">{selectedNetwork.sync_frequency}</p>
              </div>
              <div>
                <p className="text-warm-500">Conflict Strategy</p>
                <p className="font-semibold">{selectedNetwork.conflict_strategy}</p>
              </div>
              <div>
                <p className="text-warm-500">Last Sync</p>
                <p className="font-semibold">{selectedNetwork.last_sync_at ? new Date(selectedNetwork.last_sync_at).toLocaleString() : "Never"}</p>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-warm-900 dark:text-white">Network Nodes ({selectedNetwork.nodes?.length || 0})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedNetwork.nodes?.map((node: any) => (
              <div key={node.id} className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${node.is_upstream ? "bg-amber-100 dark:bg-amber-950 text-amber-600" : "bg-primary/10 dark:bg-primary/20 text-primary"}`}>
                    {node.is_upstream ? <Globe className="h-4 w-4" /> : <GitFork className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold truncate">{node.repo_name}</h4>
                    <p className="text-xs text-warm-500">{node.is_upstream ? "Upstream" : "Fork"}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {node.auto_merge && <span className="rounded bg-green-100 dark:bg-green-950 px-2 py-0.5 text-green-700 dark:text-green-400">auto-merge</span>}
                    {node.sync_enabled && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedNetwork.recent_events?.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-warm-900 dark:text-white mb-3">Recent Events</h3>
              <div className="space-y-2">
                {selectedNetwork.recent_events.map((event: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-warm-500">
                    <Activity className="h-3 w-3" />
                    <span>{event.event_type}</span>
                    <span className="text-xs text-warm-400">{event.created_at ? new Date(event.created_at).toLocaleString() : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {networks.map((network) => (
            <div
              key={network.id}
              onClick={() => loadNetworkDetail(network.id)}
              className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-primary to-rosegold-500 p-2 text-white">
                  <Share2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-warm-900 dark:text-white">{network.name}</h3>
                  <p className="text-xs text-warm-500">{network.node_count || 0} nodes • {network.sync_frequency}</p>
                </div>
                <NetworkStatusBadge status={network.status} />
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-warm-400">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{network.node_count || 0} forks</span>
                <span>Conflict: {network.conflict_strategy}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NetworkStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    active: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
    paused: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
    error: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
    archived: "bg-warm-100 dark:bg-warm-800 text-slate-600 dark:text-warm-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config[status] || config.active}`}>
      {status}
    </span>
  );
}
