import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  FlaskConical,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Filter,
  RefreshCw,
  BarChart3,
  Clock,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/testing-pipeline")({
  component: TestingPipelinePage,
});

function TestingPipelinePage() {
  const { profile } = useAuth();
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [testRuns, setTestRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pipelines" | "runs">("runs");

  useEffect(() => {
    if (!profile?.id) return;
    loadAll();
  }, [profile?.id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [pipelinesRes, runsRes] = await Promise.all([
        fetch(`/api/v1/auto-merge/test-pipelines?user_id=${profile!.id}`),
        fetch(`/api/v1/auto-merge/test-runs?limit=50`),
      ]);
      if (pipelinesRes.ok) {
        const data = await pipelinesRes.json();
        setPipelines(Array.isArray(data) ? data : []);
      }
      if (runsRes.ok) {
        const data = await runsRes.json();
        setTestRuns(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const stats = {
    total: testRuns.length,
    passed: testRuns.filter((r) => r.status === "passed").length,
    failed: testRuns.filter((r) => r.status === "failed").length,
    running: testRuns.filter((r) => r.status === "running" || r.status === "queued").length,
  };

  return (
    <div className="space-y-6 px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-warm-900 dark:text-white">
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-primary" />
              Testing Pipeline
            </span>
          </h1>
          <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
            Automated test execution with coverage reporting
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
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
          <p className="text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wide">Total Runs</p>
          <p className="mt-2 text-3xl font-bold text-warm-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
          <p className="text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wide">Passed</p>
          <p className="mt-2 text-3xl font-bold text-green-600">{stats.passed}</p>
        </div>
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
          <p className="text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wide">Failed</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{stats.failed}</p>
        </div>
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
          <p className="text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wide">Running</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{stats.running}</p>
        </div>
      </div>

      <div className="border-b border-warm-200 dark:border-warm-800">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("runs")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "runs"
                ? "border-primary text-primary dark:text-primary"
                : "border-transparent text-warm-500 hover:text-slate-700"
            }`}
          >
            Test Runs
          </button>
          <button
            onClick={() => setActiveTab("pipelines")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "pipelines"
                ? "border-primary text-primary dark:text-primary"
                : "border-transparent text-warm-500 hover:text-slate-700"
            }`}
          >
            Pipelines ({pipelines.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-warm-200 dark:bg-warm-700 rounded w-3/4" />
                <div className="h-3 bg-warm-200 dark:bg-warm-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === "runs" && testRuns.length === 0 ? (
        <div className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-12 text-center shadow-sm">
          <FlaskConical className="mx-auto h-8 w-8 text-warm-400" />
          <h3 className="mt-4 text-sm font-semibold text-warm-900 dark:text-white">No test runs yet</h3>
          <p className="mt-2 text-sm text-warm-500 dark:text-warm-400">Tests run automatically before each merge.</p>
        </div>
      ) : activeTab === "runs" ? (
        <div className="space-y-3">
          {testRuns.map((run) => (
            <div key={run.id} className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start gap-4">
                <div className={`rounded-lg p-2 flex-shrink-0 ${
                  run.status === "passed" ? "bg-green-100 dark:bg-green-950 text-green-600" :
                  run.status === "failed" ? "bg-red-100 dark:bg-red-950 text-red-600" :
                  "bg-amber-100 dark:bg-amber-950 text-amber-600"
                }`}>
                  {run.status === "passed" ? <CheckCircle2 className="h-5 w-5" /> :
                   run.status === "failed" ? <XCircle className="h-5 w-5" /> :
                   <Loader2 className="h-5 w-5 animate-spin" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${
                      run.status === "passed" ? "text-green-700 dark:text-green-400" :
                      run.status === "failed" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
                    }`}>
                      {run.status === "passed" ? "Passed" : run.status === "failed" ? "Failed" : "Running"}
                    </span>
                    <span className="text-xs text-warm-400">•</span>
                    <span className="text-xs text-warm-500">{run.total_tests || 0} tests</span>
                    {run.coverage_percent !== null && run.coverage_percent !== undefined && (
                      <>
                        <span className="text-xs text-warm-400">•</span>
                        <span className="text-xs text-warm-500">{run.coverage_percent.toFixed(1)}% coverage</span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-warm-400">
                    <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{run.passed_tests || 0}/{run.total_tests || 0} passed</span>
                    {run.duration_ms > 0 && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{(run.duration_ms / 1000).toFixed(1)}s</span>
                    )}
                    <span>{run.created_at ? new Date(run.created_at).toLocaleString() : ""}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {pipelines.map((pipeline) => (
            <div key={pipeline.id} className="rounded-xl border border-warm-200 dark:border-warm-800 bg-white dark:bg-warm-900 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 dark:bg-primary/20 p-2">
                  <Activity className="h-4 w-4 text-primary dark:text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-warm-900 dark:text-white">{pipeline.name}</h3>
                  <p className="text-xs text-warm-500 mt-0.5">{pipeline.framework} • {pipeline.command}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {pipeline.run_on_merge && <span className="rounded bg-green-100 dark:bg-green-950 px-2 py-0.5 text-green-700 dark:text-green-400">pre-merge</span>}
                  {pipeline.collect_coverage && <span className="rounded bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-blue-700 dark:text-blue-400">coverage</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
