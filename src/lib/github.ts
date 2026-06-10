/**
 * GitHub REST API helper used by the frontend.
 *
 * Tokens are stored (obfuscated) in the user_profiles row. We always
 * round-trip through Supabase to fetch the token, but cache it for the
 * current page session to avoid hammering the database on every call.
 */
import { supabase } from "./supabase";

let _cachedToken: { value: string; expiresAt: number } | null = null;
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getToken(): Promise<string | null> {
  if (_cachedToken && _cachedToken.expiresAt > Date.now()) {
    return _cachedToken.value;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("github_pat_encrypted")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data?.github_pat_encrypted) return null;

  // The column may be obfuscated (obf1.* / obf2.*) or legacy base64. Extract
  // the raw token from whichever format we see.
  const stored: string = data.github_pat_encrypted;
  let raw: string | null = null;
  if (stored.startsWith("obf1.") || stored.startsWith("obf2.")) {
    const parts = stored.split(".");
    raw = parts.length >= 3 ? safeAtob(parts[parts.length - 1]) : null;
  } else {
    raw = safeAtob(stored);
  }

  if (!raw) return null;

  _cachedToken = { value: raw, expiresAt: Date.now() + TOKEN_TTL_MS };
  return raw;
}

function safeAtob(value: string): string | null {
  try {
    if (typeof atob === "undefined") return null;
    return atob(value);
  } catch {
    return null;
  }
}

class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public rateLimitResetAt?: number,
  ) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

async function ghFetch(path: string, token: string, params?: Record<string, string | number>) {
  const url = new URL(`https://api.github.com${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (res.status === 401) {
    throw new GitHubAPIError("Invalid or expired GitHub token", 401);
  }
  if (res.status === 403) {
    const reset = res.headers.get("X-RateLimit-Reset");
    const resetAt = reset ? Number(reset) * 1000 : undefined;
    throw new GitHubAPIError(
      "GitHub API rate limit exceeded",
      403,
      resetAt,
    );
  }
  if (!res.ok) {
    throw new GitHubAPIError(`GitHub API error: ${res.status}`, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const github = {
  clearTokenCache() {
    _cachedToken = null;
  },

  async getUser() {
    const token = await getToken();
    if (!token) throw new GitHubAPIError("Not authenticated", 401);
    return ghFetch("/user", token);
  },

  async getForks() {
    const token = await getToken();
    if (!token) throw new GitHubAPIError("Not authenticated", 401);
    const repos: unknown[] = [];
    let page = 1;
    // Safety cap: GitHub caps at ~1000 repos for type=forks across paginated calls.
    const MAX_PAGES = 10;
    while (page <= MAX_PAGES) {
      const data: unknown[] = await ghFetch(
        "/user/repos",
        token,
        { per_page: 100, page, type: "forks", sort: "updated" },
      );
      if (!Array.isArray(data) || data.length === 0) break;
      repos.push(...data);
      if (data.length < 100) break;
      page += 1;
    }
    return repos;
  },

  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ) {
    const token = await getToken();
    if (!token) throw new GitHubAPIError("Not authenticated", 401);
    return ghFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
      token,
    );
  },

  async getReleases(owner: string, repo: string) {
    const token = await getToken();
    if (!token) throw new GitHubAPIError("Not authenticated", 401);
    return ghFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`,
      token,
      { per_page: 5 },
    );
  },

  async getCommits(owner: string, repo: string, sha: string) {
    const token = await getToken();
    if (!token) throw new GitHubAPIError("Not authenticated", 401);
    return ghFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`,
      token,
      { sha, per_page: 10 },
    );
  },

  async getRepo(owner: string, repo: string) {
    const token = await getToken();
    if (!token) throw new GitHubAPIError("Not authenticated", 401);
    return ghFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      token,
    );
  },
};

export { GitHubAPIError };
