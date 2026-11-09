import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

// Errors that happen before any bytes reach Supabase: always safe to retry, even for writes.
const CONNECT_PHASE = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "ENETUNREACH", "EHOSTUNREACH"]);

// Generous enough for downloading a 10 MB document on a slow link; short enough to recover from a hang.
const REQUEST_TIMEOUT_MS = 45_000;

function causeCode(err: unknown): string {
  const cause = (err as { cause?: { code?: string } })?.cause;
  return cause?.code ?? "";
}

/**
 * fetch with a few retries for transient network drops between this server and Supabase
 * (Wi-Fi blips, serverless cold sockets). Reads and idempotent writes (PATCH/PUT/DELETE) are retried.
 * Inserts are retried only when the failure happened while connecting, so a row is never created twice.
 */
async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  // PostgREST PATCH/PUT/DELETE set fixed values or remove rows, so repeating one is harmless.
  // POST (inserts, RPCs, storage uploads) is only retried when the connection never opened.
  const idempotent = ["GET", "HEAD", "PATCH", "PUT", "DELETE"].includes(method);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      // A dead socket can otherwise hang forever and leave a run stuck mid-stage.
      const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      return await fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
    } catch (err) {
      lastErr = err;
      const code = causeCode(err);
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      const retryable = (err instanceof TypeError && (idempotent || CONNECT_PHASE.has(code))) || (timedOut && idempotent);
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
