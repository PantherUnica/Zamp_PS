import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

// Errors that happen before any bytes reach Supabase: always safe to retry, even for writes.
const CONNECT_PHASE = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "ENETUNREACH", "EHOSTUNREACH"]);

function causeCode(err: unknown): string {
  const cause = (err as { cause?: { code?: string } })?.cause;
  return cause?.code ?? "";
}

/**
 * fetch with a few retries for transient network drops between this server and Supabase
 * (Wi-Fi blips, serverless cold sockets). Reads are always retried. Writes are retried only when the
 * failure happened while connecting, so a request that may already have been applied is never repeated.
 */
async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const idempotent = method === "GET" || method === "HEAD";
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastErr = err;
      const code = causeCode(err);
      const retryable = err instanceof TypeError && (idempotent || CONNECT_PHASE.has(code));
      if (!retryable || attempt === 3) break;
      console.warn(`supabase fetch ${method} failed (${code || "network"}), retry ${attempt + 1}`);
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
    }
  }
  if (lastErr instanceof Error) console.error("supabase fetch gave up:", causeCode(lastErr) || lastErr.message);
  throw lastErr;
}

/** Service-role client. Server only: bypasses RLS, so every caller must authorise first. */
export function admin(): SupabaseClient {
  if (!client) {
    client = createClient(serverEnv.supabaseUrl(), serverEnv.serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: resilientFetch },
    });
  }
  return client;
}
