import { Outlet, Navigate, createFileRoute, useRouterState, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import { hasSupabaseConfig } from "@/lib/supabase";
import {
  Home,
  GitFork,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  Shield,
  Users,
  Search,
  ChevronDown,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  XCircle,
  GitMerge,
  FileCode,
  FlaskConical,
  Rocket,
  Share2,
  ArrowLeft,
  GitBranch,
  Activity,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ParticleBackground } from "@/components/three-background";

export const Route = createFileRoute("/dashboard/_layout")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { profile, signOut, githubToken } = useAuth();
  const [dark, setDark] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const routerState = useRouterState();
  const router = useRouter();
  const currentPath = routerState.location.pathname;

  // Use auth profile (set after GitHub PAT verification)
  const effectiveProfile = profile || null;

  if (!effectiveProfile) return <Navigate to="/login" />;


  const navItems = [
    { to: "/dashboard", label: "Overview", icon: Home, exact: true },
    { to: "/dashboard/repositories", label: "Repositories", icon: GitFork },
    { to: "/dashboard/updates", label: "Updates", icon: Bell, badge: 3 },
    { to: "/dashboard/notifications", label: "Notifications", icon: BookOpen },
    { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/dashboard/auto-merge", label: "Auto-Merge", icon: GitMerge, accent: true },
    { to: "/dashboard/testing-pipeline", label: "Test Pipeline", icon: FlaskConical, accent: true },
    { to: "/dashboard/patches", label: "Patches", icon: FileCode },
    { to: "/dashboard/deployments", label: "Deployments", icon: Rocket },
    { to: "/dashboard/sync-network", label: "Sync Network", icon: Share2 },
    { to: "/dashboard/backport", label: "Backport", icon: GitBranch, accent: true },
    { to: "/dashboard/impact-analyzer", label: "Impact", icon: Activity, accent: true },
    { to: "/dashboard/ai-assistant", label: "AI Assistant", icon: Sparkles, accent: true },
    { to: "/dashboard/teams", label: "Teams", icon: Users },
    { to: "/dashboard/audit", label: "Audit Log", icon: Shield },
  ];

  const isActive = (to: string, exact?: boolean) =>
    exact ? currentPath === to : currentPath.startsWith(to);

  const goBack = () => {
    router.history.back();
  };

  return (
    <div className="min-h-screen text-white relative" style={{ backgroundColor: "#0a0d18" }}>
      <ParticleBackground />
      {/* ───────────────  TOP NAVBAR  ─────────────── */}
      <header className="sticky top-0 z-30 border-b" style={{ borderColor: "rgba(200, 217, 48, 0.1)", backgroundColor: "rgba(10, 13, 24, 0.8)", backdropFilter: "blur(12px)" }}>
        <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
          {/* Back button */}
          <button
            onClick={goBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-warm-400 hover:bg-white/5 transition-colors"
            title="Go back"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Logo + Brand */}
          <Logo size="sm" variant="lettermark" showText={false} />
          <a href="/" className="hidden sm:inline font-display text-lg font-bold" style={{ background: "linear-gradient(135deg, #e8f553, #c8d930, #a8b820)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Qode Sync
          </a>

          {/* Search */}
          <div className="relative ml-2 hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
            <input
              type="search"
              placeholder="Search repositories, updates…"
              className="w-72 rounded-lg border bg-white/5 pl-9 pr-3 py-2 text-sm placeholder:text-warm-400 text-warm-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              style={{ borderColor: "rgba(200, 217, 48, 0.1)" }}
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 rounded border bg-white/5 px-1.5 text-[10px] font-medium text-warm-400" style={{ borderColor: "rgba(200, 217, 48, 0.1)" }}>
              ⌘K
            </kbd>
          </div>

          <div className="flex-1" />

          {/* Sync */}
          <button
            className="hidden sm:inline-flex items-center gap-2 rounded-lg border bg-white/5 px-3 py-1.5 text-xs font-medium text-warm-200 hover:bg-white/10 transition-all"
            style={{ borderColor: "rgba(200, 217, 48, 0.1)" }}
            title="Sync all forks now"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setDark((d) => !d)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white/5 text-warm-400 hover:bg-white/10 transition-all"
            style={{ borderColor: "rgba(200, 217, 48, 0.1)" }}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {dark ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Token status */}
          <div className="hidden sm:flex items-center gap-2 rounded-lg border bg-white/5 px-2.5 py-1.5" style={{ borderColor: "rgba(200, 217, 48, 0.1)" }}>
            {effectiveProfile?.token_status === "valid" || !effectiveProfile?.token_status ? (
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#c8d930" }} />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-rose-400" />
            )}
            <span className="text-xs font-medium text-warm-300">
              {effectiveProfile?.token_status || "valid"}
            </span>
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-lg border bg-white/5 pl-1 pr-2 py-1 hover:bg-white/10 transition-all" style={{ borderColor: "rgba(200, 217, 48, 0.1)" }}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold" style={{ background: "linear-gradient(135deg, #e8f553, #c8d930)", color: "#0a0d18" }}>
                {effectiveProfile?.username?.slice(0, 1).toUpperCase() || "U"}
              </div>
              <span className="hidden md:inline text-sm font-medium text-warm-200">
                {effectiveProfile?.username || "user"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-warm-400" />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border bg-[#0a0d18] shadow-xl" style={{ borderColor: "rgba(200, 217, 48, 0.15)" }}>
                  <div className="p-2">
                    <div className="px-3 py-2 text-xs text-warm-400 border-b border-white/[0.06] mb-1">
                      Signed in as <span className="font-medium text-warm-200">{effectiveProfile?.username}</span>
                    </div>
                    <button
                      onClick={async () => {
                        setUserMenuOpen(false);
                        await signOut();
                        window.location.href = "/login";
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* ───────────────  SIDEBAR  ─────────────── */}
        <aside className="sticky top-16 h-[calc(100vh-4rem)] w-60 shrink-0 border-r bg-white/[0.02] hidden md:block" style={{ borderColor: "rgba(200, 217, 48, 0.1)" }}>
          <nav className="space-y-0.5 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to, item.exact);
              return (
                <a
                  key={item.to}
                  href={item.to}
                  className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "text-white"
                      : item.accent
                        ? "text-warm-300 hover:bg-white/5 hover:text-white"
                        : "text-warm-400 hover:bg-white/5 hover:text-warm-200"
                  }`}
                  style={active ? { backgroundColor: "rgba(200, 217, 48, 0.1)", color: "#e8f553" } : undefined}
                >
                  <Icon className={`h-4 w-4 ${active ? "" : "opacity-80"}`} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: "#c8d930", color: "#0a0d18" }}>
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 border-t p-3 space-y-2" style={{ borderColor: "rgba(200, 217, 48, 0.1)" }}>
            <a
              href="/dashboard/settings"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-warm-400 hover:bg-white/5 hover:text-warm-200 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </a>
            <button
              onClick={async () => {
                await signOut();
                window.location.href = "/login";
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-warm-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        {/* ───────────────  MAIN  ─────────────── */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}