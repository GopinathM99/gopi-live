import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

let client: SupabaseClient | null = null;

/** Browser Supabase client, or null when sign-in isn't configured. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!supabaseConfig) return null;
  client ??= createBrowserClient(supabaseConfig.url, supabaseConfig.key);
  return client;
}
