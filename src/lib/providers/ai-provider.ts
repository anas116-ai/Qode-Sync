// AI Provider Abstraction Layer
// V1: Lovable AI Gateway
// Future: OpenAI, Anthropic, Gemini, Groq, OpenRouter, Ollama

export interface AISummary {
  short: string;
  detailed: string;
  technical: string;
  business: string;
}

export interface AIProvider {
  name: string;
  summarizeCommits(commits: { sha: string; message: string }[]): Promise<AISummary>;
  summarizeRelease(name: string, body: string): Promise<AISummary>;
  explainBreakingChanges(diff: string): Promise<AISummary>;
  generateUpdateInsight(title: string, description: string, type: string): Promise<{ severity: string; summary: string; recommendation: string }>;
}

// V1: Lovable AI Gateway Provider
class LovableAIGatewayProvider implements AIProvider {
  name = "lovable";

  private async callAI(prompt: string): Promise<string> {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) throw new Error("AI request failed");
    const data = await response.json();
    return data.content || "";
  }

  async summarizeCommits(commits: { sha: string; message: string }[]): Promise<AISummary> {
    const commitList = commits.map((c) => `- ${c.sha.slice(0, 7)}: ${c.message}`).join("\n");
    const prompt = `Summarize these commits concisely:\n${commitList}\n\nProvide: short (1-2 lines), detailed, technical, and business impact summaries.`;
    const result = await this.callAI(prompt);
    return { short: result.split("\n")[0] || result, detailed: result, technical: result, business: result };
  }

  async summarizeRelease(name: string, body: string): Promise<AISummary> {
    const prompt = `Summarize release "${name}":\n${body}\n\nProvide: short (1-2 lines), detailed, technical, and business impact summaries.`;
    const result = await this.callAI(prompt);
    return { short: result.split("\n")[0] || result, detailed: result, technical: result, business: result };
  }

  async explainBreakingChanges(diff: string): Promise<AISummary> {
    const prompt = `Analyze this diff for breaking changes:\n${diff.slice(0, 3000)}\n\nExplain what breaks and migration steps.`;
    const result = await this.callAI(prompt);
    return { short: result.split("\n")[0] || result, detailed: result, technical: result, business: result };
  }

  async generateUpdateInsight(title: string, description: string, type: string) {
    const prompt = `Analyze update: "${title}" (${type})\n${description}\n\nProvide severity (critical/high/medium/low), summary, and recommended action.`;
    const result = await this.callAI(prompt);
    return { severity: "medium", summary: result.split("\n")[0], recommendation: "Review before syncing" };
  }
}

// Provider Factory
let currentProvider: AIProvider = new LovableAIGatewayProvider();

export function setAIProvider(provider: AIProvider) {
  currentProvider = provider;
}

export function getAIProvider(): AIProvider {
  return currentProvider;
}

// Future provider placeholder
// class OpenAIProvider implements AIProvider { ... }
// class AnthropicProvider implements AIProvider { ... }
// class GeminiProvider implements AIProvider { ... }