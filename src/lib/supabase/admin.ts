import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Service-role client. Server only: bypasses RLS, so every caller must authorise first. */
export function admin(): SupabaseClient {
  if (!client) {
    client = createClient(serverEnv.supabaseUrl(), serverEnv.serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
