import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  FileCode,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Archive,
  RefreshCw,
  GitBranch,
  Tag,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/patches")({
  component: PatchesPage,
});

function PatchesPage() {
  const { profile } = useAuth();
  const [patches, setPatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!profile?.id) return;
    loadPatches();
  }, [profile?.id, statusFilter]);

  async function loadPatches() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/v1/auto-merge/patches?${params}`);
      const json = await res.json();
      setPatches(Array.isArray(json) ? json : []);
    } catch {
      setPatches([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-warm-900 dark:text-white">
            <span className="inline-flex items-center gap-2">
              <FileCode className="h-6 w-6 text-primary" />
              Patch Engine
            </span>
          </h1>
          <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
            Generate and manage custom patches for upstream merges
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPatches}
            className="inline-flex items-center gap-2 rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            placeholder="Search patches..."
            className="w-full rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 pl-10 pr-4 py-2.5 text-sm placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="applied">Applied</option>
          <option value="conflicted">Conflicted</option>
          <option value="deprecated">Deprecated</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-warm-200 dark:bg-warm-700 rounded w-3/4" />
                <div className="h-3 bg-warm-200 dark:bg-warm-700 rounded w-1/2" />
                <div className="h-3 bg-warm-200 dark:bg-warm-700 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : patches.length === 0 ? (
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warm-100 dark:bg-warm-800">
            <FileCode className="h-8 w-8 text-warm-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-warm-900 dark:text-white">No patches found</h3>
          <p className="mt-2 text-sm text-warm-500 dark:text-warm-400 max-w-sm mx-auto">
            Create patches to manage custom changes when merging upstream updates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patches.map((patch) => (
            <div
              key={patch.id}
              className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-lg bg-rosegold-50 dark:bg-rosegold-950 p-2 flex-shrink-0">
                    <FileCode className="h-4 w-4 text-rosegold-600 dark:text-rosegold-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-warm-900 dark:text-white truncate">{patch.name}</h3>
                    <p className="text-[11px] text-warm-500 dark:text-warm-400 truncate">{patch.target_branch}</p>
                  </div>
                </div>
                <PatchStatusBadge status={patch.status} />
              </div>
              {patch.description && (
                <p className="mt-3 text-xs text-warm-500 dark:text-warm-400 line-clamp-2">{patch.description}</p>
              )}
              <div className="mt-4 flex items-center gap-3 text-xs text-warm-400">
                {patch.tags?.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {patch.tags.slice(0, 3).map((tag: string) => (
                      <span key={tag} className="rounded bg-warm-100 dark:bg-warm-800 px-1.5 py-0.5 text-[10px]">{tag}</span>
                    ))}
                  </div>
                )}
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{patch.created_at ? new Date(patch.created_at).toLocaleDateString() : ""}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`text-xs ${patch.applies_cleanly ? "text-green-600" : "text-red-600"} flex items-center gap-1`}>
                  {patch.applies_cleanly ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {patch.applies_cleanly ? "Applies cleanly" : "Has conflicts"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PatchStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    active: { bg: "bg-green-100 dark:bg-green-950", text: "text-green-700 dark:text-green-400" },
    applied: { bg: "bg-blue-100 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-400" },
    conflicted: { bg: "bg-red-100 dark:bg-red-950", text: "text-red-700 dark:text-red-400" },
    deprecated: { bg: "bg-warm-100 dark:bg-warm-800", text: "text-slate-600 dark:text-warm-400" },
    archived: { bg: "bg-amber-100 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-400" },
  };
  const c = config[status] || config.active;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}
