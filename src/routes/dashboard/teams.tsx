import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import { Users, Plus, Shield, Crown, UserCheck, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard/teams")({
  component: TeamsPage,
});

const ROLE_DESCRIPTIONS: Record<string, { label: string; description: string; icon: any }> = {
  admin: { label: "Admin", description: "Full control: manage members, billing, and settings.", icon: Crown },
  manager: { label: "Manager", description: "Manage repositories and approve sync changes.", icon: Shield },
  member: { label: "Member", description: "View repositories and acknowledge updates.", icon: UserCheck },
  viewer: { label: "Viewer", description: "Read-only access to dashboards and reports.", icon: Eye },
};

function TeamsPage() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<"team" | "organization">("team");

  useEffect(() => {
    if (!profile?.id) return;
    void loadAll();
     
  }, [profile?.id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [t, o] = await Promise.all([
        fetch("/api/v1/teams/teams"),
        fetch("/api/v1/teams/organizations"),
      ]);
      if (t.ok) setTeams(await t.json());
      if (o.ok) setOrgs(await o.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!name || !slug) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/v1/teams/${type === "team" ? "teams" : "organizations"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description: "" }),
      });
      if (res.ok) {
        setName("");
        setSlug("");
        await loadAll();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 dark:bg-primary/20 p-2.5">
          <Users className="h-6 w-6 text-primary dark:text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-warm-900 dark:text-white">Teams & Organizations</h1>
          <p className="text-sm text-warm-500 dark:text-warm-400">
            Manage teams, organizations, and member roles.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create new</CardTitle>
          <CardDescription>Spin up a team or organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={type === "team" ? "default" : "outline"}
              onClick={() => setType("team")}
            >
              Team
            </Button>
            <Button
              size="sm"
              variant={type === "organization" ? "default" : "outline"}
              onClick={() => setType("organization")}
            >
              Organization
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <Button onClick={create} disabled={creating || !name || !slug}>
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="teams">
        <TabsList>
          <TabsTrigger value="teams">Teams ({teams.length})</TabsTrigger>
          <TabsTrigger value="orgs">Organizations ({orgs.length})</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="space-y-2">
          {loading ? (
            <p className="text-sm text-warm-500">Loading…</p>
          ) : teams.length === 0 ? (
            <p className="text-sm text-warm-500 py-8 text-center">No teams yet.</p>
          ) : (
            teams.map((t: any) => (
              <Card key={t.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-warm-500">/{t.slug}</p>
                  </div>
                  <Badge variant="outline">team</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="orgs" className="space-y-2">
          {loading ? (
            <p className="text-sm text-warm-500">Loading…</p>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-warm-500 py-8 text-center">No organizations yet.</p>
          ) : (
            orgs.map((o: any) => (
              <Card key={o.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{o.name}</p>
                    <p className="text-xs text-warm-500">/{o.slug}</p>
                  </div>
                  <Badge variant="outline">organization</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="roles" className="space-y-2">
          {Object.entries(ROLE_DESCRIPTIONS).map(([key, role]) => {
            const Icon = role.icon;
            return (
              <Card key={key}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 dark:bg-primary/20 p-2">
                    <Icon className="h-5 w-5 text-primary dark:text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{role.label}</p>
                      <Badge variant="secondary">{key}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-warm-500">{role.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
