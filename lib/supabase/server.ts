// Server-side Supabase client (Server Components, Route Handlers, Server
// Actions). In Next.js 16 `cookies()` is async, so this factory is async too.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../database.types";
import { requireSupabaseEnv } from "./config";

export async function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In Server Components cookie writes throw — that's fine, the proxy
        // refreshes the session on every request. We just swallow it.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // called from a Server Component; ignore
        }
      },
    },
  });
}
