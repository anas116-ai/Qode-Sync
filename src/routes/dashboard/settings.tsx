import { createFileRoute } from "@tanstack/react-router";
import { Bell, User, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/providers/auth-provider";
import type { UserProfile } from "@/lib/providers/auth-provider";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-2" />Profile</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-2" />Notifications</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-4 w-4 mr-2" />Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileSettings profile={profile} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationSettings />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecuritySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileSettings({ profile }: { profile: UserProfile | null }) {
  if (!profile) return null;
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">Profile Settings</h2>
      <div>
        <label className="text-sm font-medium">Username</label>
        <p className="text-sm text-muted-foreground">{profile.username}</p>
      </div>
      <div>
        <label className="text-sm font-medium">Email</label>
        <p className="text-sm text-muted-foreground">{profile.email || "Not provided"}</p>
      </div>
    </div>
  );
}

function NotificationSettings() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">Notification Preferences</h2>
      <label className="flex items-center gap-2">
        <input type="checkbox" defaultChecked className="rounded" />
        <span className="text-sm">Email notifications</span>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" defaultChecked className="rounded" />
        <span className="text-sm">Instant alerts for critical updates</span>
      </label>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">Security Settings</h2>
      <p className="text-sm text-muted-foreground">Token status: Valid</p>
      <button className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">
        Refresh GitHub Token
      </button>
    </div>
  );
}