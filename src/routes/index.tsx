import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Zap,
  Bell,
  ShieldCheck,
  BarChart3,
  Lock,
  Sparkles,
  Globe,
  GitBranch,
  Cpu,
  Layers,
  Cloud,
  Github,
  Twitter,
  Linkedin,
  Menu,
  X,
  Quote,
  ArrowUpRight,
  Code2,
  Workflow,
  RefreshCw,
} from "lucide-react";
import { Logo } from "../components/ui/logo";

/* ═══ Qode Sync brand gradients ═══ */
const brandGrad = "from-brand-500 via-violet-500 to-cyan-400";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } } };

export const Route = createFileRoute("/")({
  component: LandingPage,
});

/* ═══ REUSABLE COMPONENTS ═══ */

function Section({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`relative py-24 md:py-32 ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium mb-6">
      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
      {children}
    </div>
  );
}

function Btn({ children, href, variant = "primary", className = "", icon }: {
  children: React.ReactNode; href: string; variant?: "primary" | "secondary" | "ghost"; className?: string; icon?: React.ReactNode;
}) {
  const styles = {
    primary: "bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/35 active:scale-[0.97]",
    secondary: "bg-white/5 hover:bg-white/10 text-white border border-white/10 active:scale-[0.97]",
    ghost: "text-white/60 hover:text-white hover:bg-white/5",
  };
  return (
    <motion.a
      href={href}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${styles[variant]} ${className}`}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
      {icon && <span className="transition-transform group-hover:translate-x-0.5">{icon}</span>}
    </motion.a>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={`relative rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 transition-all hover:border-brand-500/20 hover:bg-white/[0.05] hover:shadow-lg hover:shadow-brand-500/[0.03] ${className}`}
      whileHover={{ y: -3 }}
    >
      {children}
    </motion.div>
  );
}

/* ═══ NAVBAR ═══ */
function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how" },
    { label: "Pricing", href: "#pricing" },
    { label: "Testimonials", href: "#testimonials" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <motion.header
      className="fixed top-0 inset-x-0 z-50"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={`absolute inset-0 transition-all duration-300 ${
        scrolled ? "glass border-b border-brand-500/20" : "bg-transparent"
      }`} />
      <div className="relative max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Logo size="sm" />
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="px-3 py-2 text-sm text-white/50 hover:text-brand-300 transition-colors rounded-lg hover:bg-brand-500/10">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Btn href="/login" variant="ghost">Sign in</Btn>
          <Btn href="/login" variant="primary" className="text-[#0a0d18]" icon={<ArrowRight className="w-3.5 h-3.5" />}>Get started</Btn>
        </div>
        <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-white/60 hover:text-white">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="md:hidden absolute top-16 inset-x-0 glass border-b border-brand-500/10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <nav className="flex flex-col p-4 gap-1">
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="px-4 py-3 text-white/60 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg transition-colors">
                  {l.label}
                </a>
              ))}
              <div className="flex gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                <Btn href="/login" variant="secondary">Sign in</Btn>
                <Btn href="/login" variant="primary" className="text-[#0a0d18]">Get started</Btn>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

/* ═══ HERO ═══ */
function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden bg-brand-space">
      {/* Aurora glow orbs — lemon yellow */}
      <div className="absolute top-20 left-[15%] w-[500px] h-[500px] rounded-full bg-brand-500/15 blur-[150px] animate-aurora" />
      <div className="absolute bottom-20 right-[15%] w-[400px] h-[400px] rounded-full bg-brand-400/10 blur-[120px] animate-aurora-slow" />
      <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-brand-300/8 blur-[100px] animate-aurora" />

      <div className="absolute inset-0 bg-grid opacity-40" />

      <motion.div style={{ y, opacity }} className="relative z-10 max-w-4xl mx-auto px-4 text-center pt-24 pb-32">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.1 }}>
          <Badge>AI-powered fork monitoring</Badge>
        </motion.div>

        <motion.h1
          initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.2, duration: 0.6 }}
          className="font-display text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]"
        >
          Stop checking forks
          <br />
          <span className="text-gradient-warm">
            one by one.
          </span>
        </motion.h1>

        <motion.p
          initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.35 }}
          className="mt-5 text-lg text-white/45 max-w-2xl mx-auto leading-relaxed"
        >
          Qode Sync monitors your upstream repositories 24/7 with AI intelligence.
          Get notified about commits, releases, and security patches — automatically.
        </motion.p>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.5 }} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Btn href="/login" variant="primary" className="px-7 py-3 text-base text-[#0a0d18]" icon={<ArrowRight className="w-5 h-5" />}>
            Get started free
          </Btn>
          <Btn href="#features" variant="secondary" className="px-7 py-3 text-base">
            See features
          </Btn>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} transition={{ delay: 0.7 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-white/35"
        >
          {["Free during beta", "No credit card", "Self-hostable", "Open source"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand-400/70" />{t}
            </span>
          ))}
        </motion.div>

        {/* Dashboard preview */}
        <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
          transition={{ delay: 0.8, duration: 0.7 }} className="mt-14 max-w-4xl mx-auto"
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/20 via-violet-500/15 to-cyan-500/10 rounded-xl blur-lg group-hover:from-brand-500/30 group-hover:via-violet-500/20 group-hover:to-cyan-500/15 transition-all duration-500" />
            <div className="relative rounded-xl border border-brand-500/15 bg-[#0f1525]/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-brand-500/5">
              <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5 bg-white/[0.02]">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500/30" />
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500/30" />
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500/30" />
                <span className="ml-2 text-[11px] text-white/25 font-mono">app.qodesync.dev</span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
                {[
                  { label: "Total forks", value: "47", color: "text-brand-400" },
                  { label: "Out of date", value: "8", color: "text-amber-400" },
                  { label: "Critical", value: "3", color: "text-rose-400" },
                ].map((s) => (
                  <div key={s.label} className="p-5 text-left">
                    <p className="text-[11px] uppercase tracking-wider text-white/30">{s.label}</p>
                    <p className={`mt-1 text-3xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 space-y-2 border-t border-white/[0.06]">
                {[
                  { tag: "Critical", tagStyle: "bg-rose-500/15 text-rose-300 border border-rose-500/20", text: "XSS in markdown renderer (CVE-2026-1234)", repo: "facebook/react" },
                  { tag: "High", tagStyle: "bg-amber-500/15 text-amber-300 border border-amber-500/20", text: "v15.0.0 breaking changes released", repo: "vercel/next.js" },
                  { tag: "Medium", tagStyle: "bg-brand-500/15 text-brand-300 border border-brand-500/20", text: "28 new commits in main branch", repo: "microsoft/vscode" },
                ].map((u, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 hover:bg-brand-500/5 transition-colors">
                    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${u.tagStyle}`}>{u.tag}</span>
                    <span className="text-sm text-white/60 truncate flex-1">{u.text}</span>
                    <span className="text-xs text-white/25 font-mono hidden sm:block">{u.repo}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ═══ TRUST BAR ═══ */
function TrustBar() {
  return (
    <section className="border-y border-brand-500/10 bg-brand-space">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-white/20 mb-8">Trusted by developers at</p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
          {["GitHub", "Stripe", "Vercel", "Linear", "Supabase", "Cloudflare", "Shopify"].map((n) => (
            <span key={n} className="text-sm font-medium text-white/15 hover:text-brand-300/40 transition-colors cursor-default">{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══ FEATURES ═══ */
function Features() {
  const items = [
    { icon: Zap, title: "Auto-discovery", desc: "Connect once. We find every fork, detect the upstream, and start monitoring instantly.", color: "text-brand-400" },
    { icon: Bell, title: "Smart notifications", desc: "Slack, Discord, Telegram, Teams, email, web push. Choose per repo or per event.", color: "text-violet-400" },
    { icon: Sparkles, title: "AI summaries", desc: "Each update gets a one-line summary plus detailed explanation from our AI assistant.", color: "text-cyan-400" },
    { icon: ShieldCheck, title: "Security alerts", desc: "CVEs and Dependabot advisories affecting your upstreams. Never miss a critical patch.", color: "text-rose-400" },
    { icon: BarChart3, title: "Analytics", desc: "See which upstreams change most, active maintainers, and fork health scores.", color: "text-brand-400" },
    { icon: Lock, title: "Safe auto-sync", desc: "One-click sync with conflict detection, backup branches, and rollback.", color: "text-violet-400" },
    { icon: Layers, title: "Multi-repo dashboards", desc: "Organize by team, project, or priority. Filter, sort, and bulk-apply.", color: "text-cyan-400" },
    { icon: Cpu, title: "Custom AI agents", desc: "Configure per-repo AI behavior. Get diffs summarized and release notes generated.", color: "text-brand-400" },
    { icon: Cloud, title: "Self-host or cloud", desc: "Docker Compose, Helm charts, or managed cloud. Full data control either way.", color: "text-violet-400" },
  ];

  return (
    <Section id="features">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
        <Badge>Features</Badge>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-3">
          Everything you need to keep{" "}
          <span className="text-gradient-warm">your forks in sync</span>
        </h2>
        <p className="mt-4 text-white/40 max-w-xl mx-auto">Built for developers who maintain dozens of forks across multiple upstreams.</p>
      </motion.div>
      <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <motion.div key={it.title} variants={fadeUp} className="group">
            <Card>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/20 flex items-center justify-center mb-4 border border-brand-500/15 group-hover:border-brand-500/30 transition-colors">
                <it.icon className={`w-5 h-5 ${it.color}`} />
              </div>
              <h3 className="font-display font-semibold text-white mb-2">{it.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{it.desc}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}

/* ═══ HOW IT WORKS ═══ */
function HowItWorks() {
  const steps = [
    { num: "01", title: "Sign in with GitHub", desc: "Paste a fine-grained PAT. We verify, encrypt, and store it securely.", icon: Github },
    { num: "02", title: "Discover your forks", desc: "We scan your repos, detect upstreams, and build a dashboard.", icon: GitBranch },
    { num: "03", title: "Get notified", desc: "Configure channels once. We only ping you for what matters.", icon: Bell },
  ];

  return (
    <Section id="how" className="border-y border-primary/[0.06]">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
        <Badge>How it works</Badge>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-3">
          Up and running in{" "}
          <span className="text-gradient-warm">60 seconds</span>
        </h2>
      </motion.div>
      <div className="grid md:grid-cols-3 gap-8 md:gap-12">
        {steps.map((s, i) => (
          <motion.div key={s.num} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.1 }} className="text-center group">
            <div className="relative inline-flex mb-5">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-500 via-violet-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 group-hover:shadow-brand-500/40 transition-shadow">
                <s.icon className="w-7 h-7" />
              </div>
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#0c0f1a] border border-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400">
                {s.num}
              </span>
            </div>
            <h3 className="font-display font-semibold text-white mb-2">{s.title}</h3>
            <p className="text-sm text-white/40 max-w-xs mx-auto">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ═══ STATS ═══ */
function Stats() {
  const stats = [
    { val: "2.4M+", label: "Forks monitored" },
    { val: "180k+", label: "Developers" },
    { val: "14M+", label: "Updates delivered" },
    { val: "99.98%", label: "Uptime" },
  ];
  return (
    <Section>
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
        className="rounded-2xl border border-brand-500/10 bg-gradient-to-br from-brand-500/[0.08] via-violet-500/[0.04] to-cyan-500/[0.03] p-10 md:p-14 shadow-xl shadow-brand-500/[0.03]"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl md:text-4xl font-bold bg-gradient-to-b from-brand-200 to-brand-400 bg-clip-text text-transparent">{s.val}</p>
              <p className="mt-1 text-xs text-white/35 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </Section>
  );
}

/* ═══ PRICING ═══ */
function Pricing() {
  const tiers = [
    {
      name: "Hobby",
      price: "$0",
      desc: "For individual developers",
      features: ["Up to 50 forks", "Email notifications", "Community support", "All AI features"],
      cta: "Get started",
      popular: false,
    },
    {
      name: "Pro",
      price: "$9",
      period: "/mo",
      desc: "For power users",
      features: ["Unlimited forks", "Slack / Discord / Teams", "Auto-sync with safety", "Priority AI", "Email support"],
      cta: "Start free trial",
      popular: true,
    },
    {
      name: "Team",
      price: "$29",
      period: "/seat/mo",
      desc: "For organizations",
      features: ["Everything in Pro", "Org-wide dashboards", "Audit log & RBAC", "SSO + SLA", "Dedicated support"],
      cta: "Contact sales",
      popular: false,
    },
  ];

  return (
    <Section id="pricing">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
        <Badge>Pricing</Badge>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-3">
          Simple. Transparent.{" "}
          <span className="text-gradient-warm">Free during beta.</span>
        </h2>
      </motion.div>
      <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
        {tiers.map((t) => (
          <motion.div key={t.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className={`relative rounded-xl border p-6 flex flex-col transition-all hover:-translate-y-1 ${
              t.popular
              ? "border-brand-500/20 bg-brand-500/[0.08] shadow-lg shadow-brand-500/10"
              : "border-white/[0.06] bg-white/[0.02] hover:border-brand-500/20 hover:shadow-lg hover:shadow-brand-500/5"
            }`}
          >
            {t.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-brand-500 via-violet-500 to-cyan-500 text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-brand-500/30">
                Most popular
              </span>
            )}
            <h3 className="font-display font-semibold text-white">{t.name}</h3>
            <p className="text-xs text-white/35 mt-0.5">{t.desc}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">{t.price}</span>
              {t.period && <span className="text-xs text-white/30">{t.period}</span>}
            </div>
            <ul className="mt-6 space-y-3 text-sm flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-brand-400/70 shrink-0" />
                  <span className="text-white/50">{f}</span>
                </li>
              ))}
            </ul>
            <a href="/dashboard" className={`mt-6 block text-center py-2.5 rounded-lg text-sm font-medium transition-all ${
              t.popular
                ? "bg-gradient-to-r from-brand-500 via-violet-500 to-cyan-500 hover:from-brand-400 hover:via-violet-400 hover:to-cyan-400 text-white shadow-lg shadow-brand-500/25 active:scale-[0.97]"
                : "border border-white/10 text-white/60 hover:bg-brand-500/5 hover:border-brand-500/20"
            }`}>
              {t.cta}
            </a>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ═══ TESTIMONIALS ═══ */
function Testimonials() {
  const items = [
    { quote: "I used to spend an hour every Monday catching up on forks. Now I get a single Slack message.", name: "Priya R.", role: "Senior Engineer @ Acme", initials: "PR" },
    { quote: "The AI summaries are shockingly good. It's like having an intern who reads every commit log.", name: "Marcus T.", role: "Tech Lead @ Linear", initials: "MT" },
    { quote: "The security alerts alone saved us. We had no idea one of our upstreams had a critical CVE.", name: "Sara L.", role: "DevSecOps @ Stripe", initials: "SL" },
    { quote: "Setting up took less than 2 minutes. Auto-discovery found all 47 of my team's forks instantly.", name: "Alex K.", role: "Eng Manager @ Vercel", initials: "AK" },
  ];

  return (
    <Section id="testimonials" className="border-y border-primary/[0.06]">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
        <Badge>Testimonials</Badge>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-3">
          Loved by{" "}
          <span className="text-gradient-warm">developers</span>
        </h2>
      </motion.div>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((t) => (
          <Card key={t.name}>
            <Quote className="w-6 h-6 text-brand-500/30 mb-3" />
            <p className="text-sm text-white/50 leading-relaxed">"{t.quote}"</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-xs font-semibold shadow-lg shadow-brand-500/20">
                {t.initials}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{t.name}</p>
                <p className="text-xs text-white/30">{t.role}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}

/* ═══ FAQ ═══ */
function FAQ() {
  const items = [
    { q: "Is it really free?", a: "Yes, during the public beta every feature is available at no cost." },
    { q: "Do you store my GitHub token?", a: "Tokens are encrypted at rest using Fernet symmetric encryption. We never log or share them." },
    { q: "Can I self-host?", a: "Yes. Full source is MIT-licensed and ships with Docker Compose and Helm charts." },
    { q: "Which AI providers do you support?", a: "OpenAI, Anthropic, OpenRouter, Google Gemini, and any local Ollama installation." },
    { q: "How do I revoke access?", a: "From GitHub settings → Developer settings → Personal access tokens." },
  ];

  return (
    <Section id="faq">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
        <Badge>FAQ</Badge>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-3">
          Frequently asked{" "}
          <span className="text-gradient-warm">questions</span>
        </h2>
      </motion.div>
      <div className="max-w-2xl mx-auto space-y-2">
        {items.map((it, i) => (
          <FaqItem key={i} {...it} delay={i * 0.05} />
        ))}
      </div>
    </Section>
  );
}

function FaqItem({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay }}
      className={`rounded-lg border overflow-hidden transition-colors ${
        open ? "border-brand-500/20 bg-brand-500/[0.03]" : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-4 p-4 text-left">
        <span className="text-sm font-medium text-white/80">{q}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} className="text-brand-400 text-lg leading-none">+</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} className="overflow-hidden"
          >
            <p className="px-4 pb-4 text-sm text-white/35 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══ CTA ═══ */
function CTA() {
  return (
    <Section>
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
        className="text-center relative rounded-2xl border border-brand-500/10 bg-gradient-to-b from-brand-500/[0.1] via-violet-500/[0.05] to-transparent py-16 px-6 shadow-xl shadow-brand-500/[0.03]"
      >
        <Badge>Get started</Badge>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-3">
          Ready to stop checking forks{" "}
          <span className="text-gradient-warm">one by one?</span>
        </h2>
        <p className="mt-4 text-white/40 max-w-md mx-auto">Free during beta. No credit card required.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Btn href="/login" variant="primary" className="px-7 py-3 text-[#0a0d18]" icon={<ArrowRight className="w-4 h-4" />}>Get started for free</Btn>
          <Btn href="#features" variant="secondary" className="px-7 py-3">Talk to sales</Btn>
        </div>
      </motion.div>
    </Section>
  );
}

/* ═══ FOOTER ═══ */
function Footer() {
  const cols = [
    { title: "Product", links: ["Features", "Pricing", "Dashboard", "Changelog"] },
    { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
    { title: "Legal", links: ["Privacy", "Terms", "Security", "Licenses"] },
    { title: "Resources", links: ["Docs", "API", "Status", "Support"] },
  ];
  return (
    <footer className="border-t border-brand-500/10">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Logo size="md" />
            <p className="mt-3 text-xs text-white/30 leading-relaxed">AI-powered fork monitoring for developers.</p>
            <div className="mt-4 flex gap-2">
              {[Github, Twitter, Linkedin, Globe].map((I, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-lg border border-white/[0.06] flex items-center justify-center text-white/25 hover:text-brand-300/60 hover:border-brand-500/20 hover:bg-brand-500/5 transition-all">
                  <I className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">{c.title}</h4>
              <ul className="space-y-2">
                {c.links.map((l) => (
                  <li key={l}><a href="#" className="text-xs text-white/30 hover:text-brand-300/60 transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-white/20">© 2026 Qode Sync. All rights reserved.</span>
          <span className="text-xs text-white/20">Built with ❤️ for open source</span>
        </div>
      </div>
    </footer>
  );
}

/* ═══ PAGE ═══ */
function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-space text-white selection:bg-brand-500/30 overflow-x-hidden">
      <Navbar />
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <Stats />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}