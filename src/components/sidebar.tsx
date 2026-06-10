import { Link } from "@tanstack/react-router";
import { GitFork, Home, Bell, BarChart3, Settings, User } from "lucide-react";

const navItems = [
  { to: "/dashboard", icon: Home, label: "Overview" },
  { to: "/dashboard/repositories", icon: GitFork, label: "Repositories" },
  { to: "/dashboard/updates", icon: Bell, label: "Updates" },
  { to: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 w-64 border-r bg-card">
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-rosegold-600 text-white">
          <GitFork className="h-4 w-4" />
        </div>
        <div>
          <span className="font-display font-semibold text-sm">Fork Tracker</span>
          <p className="text-xs text-muted-foreground">GitHub Monitor</p>
        </div>
      </div>
      <nav className="space-y-1 p-4">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            activeProps={{ className: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary" }}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="absolute bottom-4 left-4 right-4">
        <div className="rounded-lg bg-muted/50 p-3">
          <User className="h-4 w-4 text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Logged in via GitHub PAT</p>
        </div>
      </div>
    </aside>
  );
}
