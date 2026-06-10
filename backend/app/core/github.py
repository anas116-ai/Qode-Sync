"""Async GitHub REST API client.

Uses a shared ``httpx.AsyncClient`` via context-manager wrappers and supports
per-request timeouts, rate-limit detection and retry-after handling.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings


class GitHubAPIError(Exception):
    """Raised for non-recoverable GitHub API failures."""


class GitHubRateLimitError(GitHubAPIError):
    """Raised when GitHub rate limit is hit; exposes the retry-after seconds."""

    def __init__(self, retry_after: int = 60) -> None:
        super().__init__("GitHub API rate limit exceeded")
        self.retry_after = retry_after


class GitHubClient:
    """Lightweight async wrapper around the GitHub REST API."""

    BASE_URL = "https://api.github.com"

    def __init__(self, token: str, timeout: float = 30.0) -> None:
        if not token:
            raise ValueError("GitHubClient requires a non-empty token")
        self.token = token
        self.timeout = timeout
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "fork-tracker/1.0",
        }

    async def _request(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        _retries: int = 2,
    ) -> Any:
        """GET ``path`` and return JSON. Retries transient errors with backoff."""
        url = f"{self.BASE_URL}{path}"
        last_exc: Optional[Exception] = None

        for attempt in range(_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(
                        url, headers=self.headers, params=params
                    )

                if response.status_code == 403 and "rate limit" in response.text.lower():
                    retry_after = int(response.headers.get("Retry-After", "60"))
                    raise GitHubRateLimitError(retry_after=retry_after)

                if response.status_code == 401:
                    raise GitHubAPIError("Invalid or expired GitHub token")

                if response.status_code >= 500 and attempt < _retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue

                response.raise_for_status()
                if not response.content:
                    return None
                return response.json()
            except httpx.HTTPError as exc:
                last_exc = exc
                if attempt < _retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                raise GitHubAPIError(f"HTTP error calling GitHub: {exc}") from exc

        # Should be unreachable, but make the type-checker happy.
        if last_exc:
            raise GitHubAPIError(str(last_exc)) from last_exc
        return None

    # --- user ----------------------------------------------------------------
    async def get_user(self) -> Dict[str, Any]:
        return await self._request("/user")

    # --- repositories --------------------------------------------------------
    async def get_forks(self, per_page: int = 100) -> List[Dict[str, Any]]:
        """Return all forked repositories of the authenticated user."""
        all_repos: List[Dict[str, Any]] = []
        page = 1
        while True:
            repos = await self._request(
                "/user/repos",
                params={"per_page": per_page, "page": page, "type": "forks"},
            )
            if not repos:
                break
            all_repos.extend(repos)
            if len(repos) < per_page:
                break
            page += 1
            await asyncio.sleep(0.1)  # Be nice to the API
        return all_repos

    async def get_repo(self, owner: str, repo: str) -> Dict[str, Any]:
        return await self._request(f"/repos/{owner}/{repo}")

    # --- commits / comparisons ----------------------------------------------
    async def get_commits(
        self, owner: str, repo: str, sha: str, per_page: int = 10
    ) -> List[Dict[str, Any]]:
        return await self._request(
            f"/repos/{owner}/{repo}/commits",
            params={"sha": sha, "per_page": per_page},
        )

    async def compare_commits(
        self, owner: str, repo: str, base: str, head: str
    ) -> Dict[str, Any]:
        return await self._request(f"/repos/{owner}/{repo}/compare/{base}...{head}")

    # --- releases / tags -----------------------------------------------------
    async def get_releases(
        self, owner: str, repo: str, per_page: int = 5
    ) -> List[Dict[str, Any]]:
        return await self._request(
            f"/repos/{owner}/{repo}/releases",
            params={"per_page": per_page},
        )

    async def get_tags(
        self, owner: str, repo: str, per_page: int = 10
    ) -> List[Dict[str, Any]]:
        return await self._request(
            f"/repos/{owner}/{repo}/tags",
            params={"per_page": per_page},
        )

    # --- security ------------------------------------------------------------
    async def get_security_advisories(
        self, owner: str, repo: str
    ) -> List[Dict[str, Any]]:
        return await self._request(f"/repos/{owner}/{repo}/security-advisories")

    async def get_dependabot_alerts(
        self, owner: str, repo: str
    ) -> List[Dict[str, Any]]:
        return await self._request(
            f"/repos/{owner}/{repo}/dependabot/alerts",
            params={"state": "open", "per_page": 20},
        )

    # --- pull requests -------------------------------------------------------
    async def get_pull_requests(
        self, owner: str, repo: str, state: str = "closed", per_page: int = 20
    ) -> List[Dict[str, Any]]:
        return await self._request(
            f"/repos/{owner}/{repo}/pulls",
            params={"state": state, "per_page": per_page},
        )


def create_github_client(token: str) -> GitHubClient:
    """Convenience factory."""
    return GitHubClient(token)
