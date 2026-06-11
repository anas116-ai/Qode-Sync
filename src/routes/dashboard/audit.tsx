import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import { ScrollText, Filter, Shield, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/audit")({
  component: AuditPage,
});

const ACTION_COLORS: Record<string, string> = {
  login: "bg-warm-100 text-warm-700",
  logout: "bg-warm-100 text-warm-700",
  token_refresh: "bg-rosegold-50 text-rosegold-700",
  repository_sync: "bg-brand-100 text-brand-700",
  update_acknowledged: "bg-yellow-100 text-yellow-700",
  notification_sent: "bg-primary/20 text-primary",
  webhook_received: "bg-orange-100 text-orange-700",
};

function AuditPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("all");

  useEffect(() => {
    if (!profile?.id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, action]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", page_size: "100" });
      if (action !== "all") params.set("action", action);
      const res = await fetch(`/api/v1/audit/?${params}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
        setTotal(json.total || 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 dark:bg-primary/20 p-2.5">
          <ScrollText className="h-6 w-6 text-primary dark:text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-warm-900 dark:text-white">Audit Logs</h1>
          <p className="text-sm text-warm-500 dark:text-warm-400">
            All security-relevant actions on your account.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" /> Events
            </span>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
            >
              <option value="all">All actions</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="token_refresh">Token refresh</option>
              <option value="repository_sync">Repository sync</option>
              <option value="update_acknowledged">Update acknowledged</option>
              <option value="notification_sent">Notification sent</option>
              <option value="webhook_received">Webhook received</option>
            </select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-warm-500">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-warm-500 py-8 text-center">No audit logs yet.</p>
          ) : (
            <div className="divide-y">
              {logs.map((l: any) => (
                <div key={l.id} className="py-3 flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={ACTION_COLORS[l.action] || "bg-warm-100 text-warm-700"}
                  >
                    {l.action}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{l.resource_type || "—"}</p>
                    {l.ip_address && (
                      <p className="text-xs text-warm-500">from {l.ip_address}</p>
                    )}
                  </div>
                  <span className="text-xs text-warm-400">
                    {l.created_at ? new Date(l.created_at).toLocaleString() : ""}
                  </span>
                  <ChevronRight className="h-4 w-4 text-warm-400" />
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-warm-500">Total: {total} events</p>
        </CardContent>
      </Card>
    </div>
  );
}
