"""Multi-provider AI abstraction (OpenAI, Anthropic, Ollama, OpenRouter, custom)."""
from abc import ABC, abstractmethod
from typing import List, Dict, Any
import httpx
from app.config import settings


class AIProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def chat(self, prompt: str, system: str = "") -> str: ...

    async def summarize_commits(self, commits: List[Dict]) -> Dict[str, str]:
        commit_list = "\n".join(
            f"- {c.get('sha', '')[:7]}: {c.get('message', '')}" for c in commits
        )
        prompt = (
            "Summarize the following commits. Provide: short (1-2 lines), "
            "detailed, technical, and business-impact sections.\n\n"
            f"{commit_list}"
        )
        content = await self.chat(prompt)
        return _split_sections(content)

    async def summarize_release(self, name: str, body: str) -> Dict[str, str]:
        prompt = (
            f"Summarize this release titled '{name}'. Provide: short, detailed, "
            f"technical, and business-impact sections.\n\n{body or '(no body)'}"
        )
        return _split_sections(await self.chat(prompt))

    async def explain_breaking_changes(self, diff: str) -> Dict[str, str]:
        prompt = (
            "Analyze this diff for breaking changes. List what breaks, why, "
            "and migration steps. Provide: short, detailed, technical, and "
            f"business-impact sections.\n\n```diff\n{diff[:3000]}\n```"
        )
        return _split_sections(await self.chat(prompt))

    async def generate_update_insight(
        self, title: str, description: str, update_type: str
    ) -> Dict[str, Any]:
        prompt = (
            f"Analyze this {update_type} update titled '{title}'.\n{description}\n\n"
            "Reply with: severity (critical|high|medium|low), one-line summary, "
            "and a recommended action."
        )
        content = await self.chat(prompt)
        severity = "medium"
        for s in ("critical", "high", "medium", "low"):
            if s in content.lower():
                severity = s
                break
        first_line = content.split("\n", 1)[0].strip()
        return {
            "severity": severity,
            "summary": first_line,
            "recommendation": "Review before syncing",
        }


def _split_sections(text: str) -> Dict[str, str]:
    """Best-effort split of AI output into 4 buckets."""
    lines = text.split("\n")
    short = next((l.strip("-•* ").strip() for l in lines if l.strip()), "")
    return {"short": short, "detailed": text, "technical": text, "business": text}


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(self, api_key: str, model: str = "gpt-4-turbo-preview", base_url: str | None = None):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    async def chat(self, prompt: str, system: str = "") -> str:
        msgs = []
        if system:
            msgs.append({"role": "system", "content": system})
        msgs.append({"role": "user", "content": prompt})
        r = await self.client.chat.completions.create(model="gpt-4-turbo-preview", messages=msgs, max_tokens=500)
        return r.choices[0].message.content or ""


class AnthropicProvider(AIProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022"):
        self.api_key = api_key
        self.model = model

    async def chat(self, prompt: str, system: str = "") -> str:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": 500,
                    "system": system or "You are a helpful assistant.",
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            r.raise_for_status()
            data = r.json()
            return data.get("content", [{}])[0].get("text", "")


class OllamaProvider(AIProvider):
    name = "ollama"

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.1"):
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def chat(self, prompt: str, system: str = "") -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{self.base_url}/api/generate",
                json={"model": self.model, "prompt": prompt, "stream": False},
            )
            r.raise_for_status()
            return r.json().get("response", "")


class OpenRouterProvider(AIProvider):
    name = "openrouter"

    def __init__(self, api_key: str, model: str = "openai/gpt-4o-mini"):
        self.api_key = api_key
        self.model = model

    async def chat(self, prompt: str, system: str = "") -> str:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system or "You are a helpful assistant."},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]


# Backwards-compatible wrapper used by ai.py
class MultiAIProvider(AIProvider):
    """Resolves a provider from settings. Falls back to OpenAI if available,
    then a stub that returns a friendly default."""

    def __init__(self):
        self.provider: AIProvider = self._resolve()

    def _resolve(self) -> AIProvider:
        if settings.OPENAI_API_KEY:
            return OpenAIProvider(settings.OPENAI_API_KEY)
        if getattr(settings, "ANTHROPIC_API_KEY", None):
            return AnthropicProvider(settings.ANTHROPIC_API_KEY)
        if getattr(settings, "OLLAMA_BASE_URL", None):
            return OllamaProvider(settings.OLLAMA_BASE_URL)
        if getattr(settings, "OPENROUTER_API_KEY", None):
            return OpenRouterProvider(settings.OPENROUTER_API_KEY)
        return _StubProvider()

    async def chat(self, prompt: str, system: str = "") -> str:
        return await self.provider.chat(prompt, system)


class _StubProvider(AIProvider):
    name = "stub"

    async def chat(self, prompt: str, system: str = "") -> str:
        first_line = prompt.split("\n", 1)[0][:120]
        return f"{first_line} — (AI not configured; set OPENAI_API_KEY for real summaries.)"


multi_ai = MultiAIProvider()
