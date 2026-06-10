"""AI module — re-exports the multi-provider implementation for backwards-compat."""
from __future__ import annotations

from app.core.ai_providers import (
    AIProvider,
    AnthropicProvider,
    MultiAIProvider,
    OllamaProvider,
    OpenAIProvider,
    OpenRouterProvider,
    multi_ai,
)


class AIFacade:
    """Backwards-compatible facade used by older call-sites.

    The historical code instantiates ``AIProvider()`` and calls methods like
    ``summarize_commits`` on it. We keep that surface alive by delegating to
    the new ``multi_ai`` provider registry.
    """

    def __init__(self) -> None:
        self._inner: MultiAIProvider = multi_ai

    async def summarize_commits(self, commits):
        return await self._inner.summarize_commits(commits)

    async def summarize_release(self, name, body):
        return await self._inner.summarize_release(name, body)

    async def explain_breaking_changes(self, diff):
        return await self._inner.explain_breaking_changes(diff)

    async def generate_update_insight(self, title, description, update_type):
        return await self._inner.generate_update_insight(title, description, update_type)


# Singleton used everywhere in the codebase.
ai_provider = AIFacade()


__all__ = [
    "AIProvider",
    "AIFacade",
    "ai_provider",
    "multi_ai",
    "OpenAIProvider",
    "AnthropicProvider",
    "OllamaProvider",
    "OpenRouterProvider",
]
