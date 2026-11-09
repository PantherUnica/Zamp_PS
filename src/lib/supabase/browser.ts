"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser client: used for sign-in and for uploading files to server-issued signed upload URLs. */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
