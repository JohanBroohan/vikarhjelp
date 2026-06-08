// Browser-side Supabase client (used inside Client Components).
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";
import { requireSupabaseEnv } from "./config";

export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
