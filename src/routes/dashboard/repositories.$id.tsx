import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import {
  Star,
  Eye,
  EyeOff,
  Bookmark,
  BookmarkCheck,
  ArrowLeft,
  RefreshCw,
  GitCommit,
  Tag,
  Shield,
  AlertTriangle,
  GitPullRequest,
  GitMerge,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/dashboard/repositories/$id")({
  component: RepositoryDetailPage,
});

function RepositoryDetailPage() {
  const { profile, session } = useAuth();
  const { id } = Route.useParams();
  const [repo, setRepo] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMerging, setIsMerging] = useState(false);

  useEffect(() => {
    if (!profile?.id || !id) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, id]);

  async function loadAll() {
    if (!profile) return;
    setLoading(true);
    try {
      const token = (session as any)?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const [r, u] = await Promise.all([
        fetch(`/api/v1/repositories/${id}?user_id=${profile.id}`, { headers }),
        fetch(`/api/v1/updates?user_id=${profile.id}&page_size=20`, { headers }),
      ]);
      if (r.ok) setRepo(await r.json());
      if (u.ok) {
        const json = await u.json();
        setUpdates((json.data || []).filter((x: any) => x.repository_id === id));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleUpstreamMerge() {
    if (!profile?.id || !repo?.id) return;
    setIsMerging(true);
    try {
      // 1. Assess risk
      const assessRes = await fetch(
        `/api/v1/auto-merge/repositories/${repo.id}/assess-risk?base_branch=${repo.default_branch || "main"}&head_branch=${repo.parent_default_branch || "main"}`,
        { method: "POST" }
      );
      if (!assessRes.ok) {
        const err = await assessRes.json();
        alert(`Risk assessment failed: ${err.detail || "Unknown error"}`);
        return;
      }
      const assessment = await assessRes.json();

      if (!assessment.can_auto_merge) {
        const proceed = window.confirm(
          `Risk level: ${assessment.risk_level}. This merge has risk factors:\n${(assessment.risk_factors || []).join("\n")}\n\nProceed with merge anyway?`
        );
        if (!proceed) return;
      }

      // 2. Execute merge
      const mergeRes = await fetch(
        `/api/v1/auto-merge/repositories/${repo.id}/merge?merge_job_id=${assessment.merge_job_id}&force=true`,
        { method: "POST" }
      );
      const result = await mergeRes.json();

      if (result.status === "completed") {
        alert(`✓ Merge successful!\nCommit: ${result.merge_commit_sha?.slice(0, 12) || "N/A"}`);
        await loadAll();
      } else if (result.status === "conflict") {
        alert(`⚠ Merge conflict detected. Manual resolution required.`);
      } else {
        alert(`✗ Merge failed: ${result.error_message || result.status}`);
      }
    } catch (err) {
      alert(`Merge failed: ${(err as Error).message}`);
    } finally {
      setIsMerging(false);
    }
  }

  async function toggle(action: "bookmark" | "watch") {
    if (!profile) return;
    const res = await fetch(`/api/v1/repositories/${id}/${action}?user_id=${profile.id}`, {
      method: "POST",
    });
    if (res.ok) {
      const json = await res.json();
      setRepo((prev: any) => ({
        ...prev,
        is_bookmarked: action === "bookmark" ? json.bookmarked : prev?.is_bookmarked,
        is_watched: action === "watch" ? json.watched : prev?.is_watched,
      }));
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-warm-500">Loading repository…</div>;
  }
  if (!repo) {
    return (
      <div className="p-8 text-center space-y-2">
        <p className="text-sm text-warm-500">Repository not found.</p>
        <Link to="/dashboard/repositories">
          <Button variant="link">← Back to repositories</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/dashboard/repositories">
          <Button size="icon" variant="ghost">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-warm-900 dark:text-white truncate">{repo.name}</h1>
            <Badge variant="outline">{repo.sync_status}</Badge>
            {repo.archived && <Badge variant="secondary">archived</Badge>}
            {repo.is_fork && <Badge>fork</Badge>}
          </div>
          <p className="text-sm text-warm-500 dark:text-warm-400 truncate">{repo.full_name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => toggle("watch")}>
            {repo.is_watched ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {repo.is_watched ? "Watching" : "Watch"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => toggle("bookmark")}>
            {repo.is_bookmarked ? (
              <BookmarkCheck className="h-4 w-4 mr-2 text-yellow-500" />
            ) : (
              <Bookmark className="h-4 w-4 mr-2" />
            )}
            {repo.is_bookmarked ? "Bookmarked" : "Bookmark"}
          </Button>
          {repo.parent_full_name && repo.behind_count > 0 && (
            <Button size="sm" className="bg-primary text-white hover:bg-primary-700" onClick={handleUpstreamMerge}>
              {isMerging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitMerge className="h-4 w-4 mr-2" />}
              {isMerging ? "Merging..." : "Merge Upstream"}
            </Button>
          )}
          <Button size="sm" onClick={loadAll}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-warm-500">Stars</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Star className="h-4 w-4" />{repo.stars_count || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-warm-500">Behind</p>
            <p className="text-2xl font-bold text-red-600">{repo.behind_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-warm-500">Ahead</p>
            <p className="text-2xl font-bold text-primary">{repo.ahead_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-warm-500">Health Score</p>
            <p className="text-2xl font-bold text-primary">{(repo.health_score ?? 100).toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="updates">Updates ({updates.length})</TabsTrigger>
          <TabsTrigger value="upstream">Upstream</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{repo.description || "No description provided."}</p>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-warm-500">Language:</span> {repo.language || "—"}</div>
                <div><span className="text-warm-500">Default branch:</span> {repo.default_branch}</div>
                <div><span className="text-warm-500">Forks:</span> {repo.forks_count || 0}</div>
                <div><span className="text-warm-500">Open issues:</span> {repo.open_issues_count || 0}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates" className="space-y-2">
          {updates.length === 0 ? (
            <p className="text-sm text-warm-500 py-8 text-center">No updates for this repository.</p>
          ) : (
            updates.map((u: any) => (
              <Card key={u.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {u.update_type === "release" ? (
                      <Tag className="h-4 w-4 text-rosegold-500 mt-0.5" />
                    ) : u.update_type === "security_advisory" ? (
                      <Shield className="h-4 w-4 text-red-500 mt-0.5" />
                    ) : u.update_type === "breaking_change" ? (
                      <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                    ) : u.update_type === "pull_request_merged" ? (
                      <GitPullRequest className="h-4 w-4 text-warm-500 mt-0.5" />
                    ) : (
                      <GitCommit className="h-4 w-4 text-warm-500 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{u.title}</p>
                        <Badge variant="outline" className="capitalize">{u.severity}</Badge>
                      </div>
                      {u.ai_summary && (
                        <p className="mt-1 text-xs text-warm-500">{u.ai_summary}</p>
                      )}
                      <p className="mt-1 text-[10px] text-warm-400">
                        {u.created_at ? new Date(u.created_at).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="upstream" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upstream Repository</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-warm-500">Name:</span> {repo.parent_full_name || "—"}</div>
              <div><span className="text-warm-500">Owner:</span> {repo.parent_owner || "—"}</div>
              <div><span className="text-warm-500">Default branch:</span> {repo.parent_default_branch || "main"}</div>
              <Separator />
              <p className="text-xs text-warm-500">
                Divergence: {repo.divergence_count ?? 0} commits ({repo.ahead_count ?? 0} ahead, {repo.behind_count ?? 0} behind)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
