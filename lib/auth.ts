// Server-side auth helpers for Server Components / Actions.

import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Redirects to /login when there is no session. Returns the user otherwise. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
