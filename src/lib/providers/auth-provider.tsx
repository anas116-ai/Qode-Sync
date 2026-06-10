import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, hasSupabaseConfig } from "../supabase";
import type { User, Session } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  supabase_id?: string | null;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  github_id?: number | null;
  token_status?: "valid" | "invalid" | "expired" | "revoked" | null;
  token_last_validated?: string | null;
  timezone?: string | null;
  language?: string | null;
  max_repositories?: number | null;
  email_notifications_enabled?: boolean | null;
  notification_frequency?: "instant" | "hourly" | "daily" | "weekly" | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_sync_at?: string | null;
  [key: string]: unknown;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  githubToken: string | null;
  signUpWithPAT: (pat: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  githubToken: null,
  signUpWithPAT: async () => ({}),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const LOCAL_PROFILE_KEY = "qodesync_profile";
const LOCAL_TOKEN_KEY = "qodesync_github_token";

function loadLocalProfile(): { profile: UserProfile | null; token: string | null } {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
    const token = localStorage.getItem(LOCAL_TOKEN_KEY);
    if (raw) return { profile: JSON.parse(raw), token };
  } catch {
    // localStorage parse error — fall through to null
  }
  return { profile: null, token: null };
}

function saveLocalProfile(profile: UserProfile, token: string) {
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(LOCAL_TOKEN_KEY, token);
}

function clearLocalProfile() {
  localStorage.removeItem(LOCAL_PROFILE_KEY);
  localStorage.removeItem(LOCAL_TOKEN_KEY);
  localStorage.removeItem("qodesync_demo");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [githubToken, setGithubToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (hasSupabaseConfig) {
        // Supabase mode
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          await loadProfile(data.session.user.id);
        } else {
          setLoading(false);
        }
      } else {
        // Local auth mode — load from localStorage
        const { profile: localProfile, token } = loadLocalProfile();
        if (!cancelled) {
          setProfile(localProfile);
          setGithubToken(token);
          setLoading(false);
        }
      }
    }

    void init();

    let subscription: { unsubscribe: () => void } | null = null;
    if (hasSupabaseConfig) {
      const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (cancelled) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await loadProfile(newSession.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      });
      subscription = data.subscription;
    }

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  async function loadProfile(userId: string) {
    try {
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      setProfile((data as UserProfile) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshProfile() {
    if (user && hasSupabaseConfig) await loadProfile(user.id);
  }

  async function signUpWithPAT(pat: string): Promise<{ error?: string }> {
    const token = pat.trim();
    if (!token) return { error: "Token is required" };

    // 1) Verify token against GitHub API
    let ghUser: {
      id: number;
      login: string;
      name?: string | null;
      email?: string | null;
      avatar_url?: string;
      public_repos?: number;
      followers?: number;
      following?: number;
    };

    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!response.ok) {
        return {
          error: `Invalid GitHub token (HTTP ${response.status}). Check the token and try again.`,
        };
      }
      ghUser = await response.json();
    } catch {
      return { error: "Failed to connect to GitHub. Please try again." };
    }

    // Build profile
    const profileData: UserProfile = {
      id: `gh-${ghUser.id}`,
      username: ghUser.login,
      display_name: ghUser.name || ghUser.login,
      avatar_url: ghUser.avatar_url || null,
      email: ghUser.email || null,
      github_id: ghUser.id,
      token_status: "valid",
      token_last_validated: new Date().toISOString(),
    };

    if (hasSupabaseConfig) {
      // Supabase mode — use existing flow
      const email = `pat-${ghUser.id}@users.forktracker.local`;
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password: token });
      let authUserId: string | null = null;
      if (!signInError && signInData.user) {
        authUserId = signInData.user.id;
      } else {
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({ email, password: token, options: { data: { username: ghUser.login } } });
        if (signUpError || !signUpData.user) return { error: signUpError?.message ?? "Failed" };
        authUserId = signUpData.user.id;
      }
      if (authUserId) {
        await supabase.from("user_profiles").upsert({ ...profileData, id: authUserId }, { onConflict: "id" });
        const { data: { session: s } } = await supabase.auth.getSession();
        setSession(s);
        setUser(s?.user ?? null);
        await loadProfile(authUserId);
      }
    } else {
      // Local mode — save to localStorage
      saveLocalProfile(profileData, token);
      setProfile(profileData);
      setGithubToken(token);
    }

    return {};
  }

  async function signOut() {
    if (hasSupabaseConfig) {
      await supabase.auth.signOut();
    }
    clearLocalProfile();
    setUser(null);
    setSession(null);
    setProfile(null);
    setGithubToken(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, githubToken, signUpWithPAT, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}