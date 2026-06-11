import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import { AlertCircle, Sparkles, ShieldCheck, Bell, CheckCircle2, Github, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import ThreeScene from "@/components/three-scene";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signUpWithPAT } = useAuth();
  const [pat, setPat] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = pat.trim();
    if (!token) {
      toast.error("Please enter your GitHub Personal Access Token");
      return;
    }
    setLoading(true);
    try {
      const result = await signUpWithPAT(token);
      setPat("");
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Signed in successfully!");
        await new Promise(resolve => setTimeout(resolve, 100));
        window.location.href = "/dashboard";
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoMode() {
    try {
      const demoProfile = {
        id: "demo-user",
        username: "demo",
        display_name: "Demo User",
        avatar_url: null,
        email: "demo@qodesync.local",
        github_id: 0,
        token_status: "valid" as const,
        token_last_validated: new Date().toISOString(),
      };
      localStorage.setItem("qodesync_profile", JSON.stringify(demoProfile));
      localStorage.setItem("qodesync_github_token", "demo-token");
      window.location.href = "/dashboard";
    } catch {
      toast.error("Failed to start demo mode");
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] relative overflow-hidden">
      <ThreeScene />
      <aside className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden" style={{ background: "rgba(10, 13, 24, 0.02)", backdropFilter: "blur(1px)" }}>

        <div className="relative z-10">
          <Logo size="sm" variant="combination" />
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative z-10 space-y-8 max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.1em", lineHeight: "1.2" }}>
              Stop checking forks
            </span>
            <br />
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.1em", lineHeight: "1.2" }}>
              <span className="text-gradient-warm">one by one.</span>
            </span>
          </h2>
          <p className="text-base text-white/60 leading-relaxed">
            Qode Sync watches your upstream repositories 24/7 and tells you the
            moment a relevant commit, release, security patch or breaking change
            appears. Powered by AI, delivered to your favorite channel.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: "#e8f553" }} />
              <span>Auto-discover every GitHub fork you own</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: "#f97316" }} />
              <span>AI-generated summaries of every update</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: "#fb923c" }} />
              <span>Notifications to Slack, Discord, email & more</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: "#e8f553" }} />
              <span>One-click sync with safety checks & rollback</span>
            </li>
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="relative z-10 flex items-center gap-6 text-xs text-white/40">
          <span>© 2026 Qode Sync</span>
          <a className="hover:text-white transition-colors" href="#">Privacy</a>
          <a className="hover:text-white transition-colors" href="#">Terms</a>
          <a className="hover:text-white transition-colors" href="#">Status</a>
        </motion.div>
      </aside>

      <main className="flex items-center justify-end p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Logo size="sm" variant="combination" />
          </div>

          <div className="rounded-2xl p-6" style={{ background: "transparent", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-display font-bold text-white">Sign in to your workspace</h2>
            <p className="mt-2 text-sm text-warm-400">
              Use a GitHub Personal Access Token to connect your account and sync your repositories.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 mt-6">
            <div className="space-y-2">
              <label htmlFor="pat" className="text-sm font-medium text-warm-300">
                GitHub Personal Access Token
              </label>
              <div className="relative">
                <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
                <input
                  id="pat"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx or github_pat_..."
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.06] bg-transparent pl-10 pr-4 py-3 text-sm placeholder:text-warm-500 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  disabled={loading}
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-warm-400">
                Need one?{" "}
                <a
                  href="https://github.com/settings/tokens?type=beta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:underline"
                  style={{ color: "#e8f553" }}
                >
                  Create a fine-grained token
                </a>{" "}
                with <span className="font-medium">Repository permissions (read & write)</span>.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed neon-btn-glow"
              style={{
                background: "linear-gradient(135deg, #e8f553, #c8d930, #a8b820)",
                color: "#0a0d18",
              }}
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying with GitHub...
                </>
              ) : (
                <>
                  Sign in with GitHub
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <FeaturePill icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Encrypted" />
              <FeaturePill icon={<Sparkles className="h-3.5 w-3.5" />} label="AI summaries" />
              <FeaturePill icon={<Bell className="h-3.5 w-3.5" />} label="Alerts" />
            </div>
          </form>

          <div className="rounded-lg p-4" style={{ border: "1px solid rgba(200, 217, 48, 0.15)", backgroundColor: "transparent" }}>
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "#c8d930" }} />
              <div className="text-xs text-warm-300 space-y-1">
                <p className="font-semibold">Your token is verified and stored securely.</p>
                <p className="text-warm-400">
                  We use it to fetch your repositories, detect forks, and sync updates via the GitHub API.
                  You can revoke access any time from your GitHub settings.
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-warm-400">
            By continuing, you agree to our{" "}
            <a href="#" className="underline hover:text-warm-200">Terms</a>{" "}
            and{" "}
            <a href="#" className="underline hover:text-warm-200">Privacy Policy</a>.
          </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-md border border-white/[0.06] bg-transparent py-1.5 text-warm-400">
      {icon}
      <span>{label}</span>
    </div>
  );
}

