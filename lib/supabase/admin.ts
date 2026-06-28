// Service-role Supabase client — bypasses RLS. SERVER-ONLY: never import this
// from a Client Component. Used by trusted membership/onboarding actions that
// must read/write across tenants (e.g. creating a school + its first member).

import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { requireSupabaseEnv } from "./config";

export function createAdminClient() {
  const { url } = requireSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY mangler i miljøet.");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
