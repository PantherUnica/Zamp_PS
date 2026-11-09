import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";

/** Cookie-bound client used only for Supabase Auth (session of the signed-in reviewer). */
export async function authClient() {
  const store = await cookies();
  return createServerClient(serverEnv.supabaseUrl(), serverEnv.supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; proxy.ts refreshes them.
        }
      },
    },
  });
}
