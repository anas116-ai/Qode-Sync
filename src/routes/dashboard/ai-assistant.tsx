import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/providers/auth-provider";
import { Sparkles, Send, Bot, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/ai-assistant")({
  component: AIAssistantPage,
});

type Mode = "explain" | "summarize_commits" | "summarize_release" | "breaking" | "insight";

const MODE_LABELS: Record<Mode, { title: string; description: string; placeholder: string }> = {
  explain: {
    title: "Explain an update",
    description: "Paste commit messages, release notes, or a description to get a clear explanation.",
    placeholder: "Paste commit messages or release notes here...",
  },
  summarize_commits: {
    title: "Summarize commits",
    description: "Get a concise summary of multiple commits.",
    placeholder: "Paste JSON list of commits: [{sha, message}, ...]",
  },
  summarize_release: {
    title: "Summarize a release",
    description: "Provide a release name and body to get a structured summary.",
    placeholder: "Format: name: v1.0.0\nbody: ...",
  },
  breaking: {
    title: "Explain breaking changes",
    description: "Paste a diff to detect breaking changes and migration steps.",
    placeholder: "Paste a unified diff here...",
  },
  insight: {
    title: "Generate update insight",
    description: "Get a severity rating and recommended action for an update.",
    placeholder: "title: New MCP support\ndescription: ...\ntype: release",
  },
};

function AIAssistantPage() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>("explain");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const token = (session as any)?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const body = (() => {
        if (mode === "summarize_commits") {
          try {
            return { commits: JSON.parse(input) };
          } catch {
            return { commits: input.split("\n").filter(Boolean).map((l) => ({ message: l, sha: "" })) };
          }
        }
        if (mode === "summarize_release") {
          const [nameLine, ...rest] = input.split("\n");
          return { name: nameLine.replace(/^name:\s*/i, "").trim(), body: rest.join("\n") };
        }
        if (mode === "breaking") return { diff: input };
        if (mode === "insight") {
          const lines = input.split("\n");
          const obj: any = { title: "", description: "", type: "commit" };
          for (const l of lines) {
            const [k, ...v] = l.split(":");
            if (!k) continue;
            const key = k.trim().toLowerCase();
            if (key in obj) obj[key] = v.join(":").trim();
          }
          return obj;
        }
        return { prompt: input };
      })();

      const endpoint =
        mode === "summarize_commits"
          ? "/api/v1/ai/summarize-commits"
          : mode === "summarize_release"
            ? "/api/v1/ai/summarize-release"
            : mode === "breaking"
              ? "/api/v1/ai/explain-breaking-changes"
              : mode === "insight"
                ? "/api/v1/ai/update-insight"
                : "/api/v1/ai/summarize-commits";

      const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`AI request failed (${res.status})`);
      const data = await res.json();
      setOutput(data);
    } catch (e: any) {
      setError(e?.message || "Failed to get AI response");
    } finally {
      setLoading(false);
    }
  }

  const meta = MODE_LABELS[mode];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 dark:bg-primary/20 p-2.5">
          <Sparkles className="h-6 w-6 text-primary dark:text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-warm-900 dark:text-white">AI Assistant</h1>
          <p className="text-sm text-warm-500 dark:text-warm-400">
            Explain updates, summarize commits, and detect breaking changes.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" /> Mode
          </CardTitle>
          <CardDescription>Choose what you want the AI to do.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "default" : "outline"}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m].title}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{meta.title}</CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={meta.placeholder}
            rows={8}
          />
          <div className="flex items-center gap-2">
            <Button onClick={handleAsk} disabled={loading || !input.trim()}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Thinking…</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Ask AI</>
              )}
            </Button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </CardContent>
      </Card>

      {output && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {output.short !== undefined && (
              <div>
                <Badge variant="secondary" className="mb-2">Short</Badge>
                <p className="text-sm text-warm-700 dark:text-warm-300">{output.short}</p>
              </div>
            )}
            {output.severity && (
              <div className="flex items-center gap-2">
                <Badge variant={output.severity === "critical" ? "destructive" : "default"}>
                  {output.severity}
                </Badge>
                <span className="text-sm">{output.summary}</span>
              </div>
            )}
            {output.detailed && (
              <pre className="whitespace-pre-wrap rounded-md bg-warm-50 dark:bg-warm-900 p-4 text-xs">
                {output.detailed}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
