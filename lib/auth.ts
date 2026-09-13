// Server-side auth helpers for Server Components / Actions.

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

// Wrapped in React `cache` so multiple callers within one request (e.g. the
// layout plus the membership lookup) share a single auth round-trip instead of
// each hitting Supabase's auth server.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Redirects to /login when there is no session. Returns the user otherwise. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
