import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/**
 * Build a Supabase client even when env vars are missing.
 *
 * `createClient` throws if either value is empty, so we use safe
 * placeholders that allow the app to boot in local-dev mode. Any
 * actual auth call will fail with a clear network error, but the UI
 * (login page, dashboard) still renders.
 */
const PLACEHOLDER_URL = "https://placeholder.supabase.invalid";
const PLACEHOLDER_KEY =
  "placeholder.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.placeholder";

function buildClient(): SupabaseClient {
  const url = supabaseUrl && supabaseUrl.length > 0 ? supabaseUrl : PLACEHOLDER_URL;
  const key = supabaseAnonKey && supabaseAnonKey.length > 0 ? supabaseAnonKey : PLACEHOLDER_KEY;
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = buildClient();

/** True if real Supabase credentials are configured. */
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
