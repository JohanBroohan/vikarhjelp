// Root proxy (Next.js 16). Runs before every matched request to refresh the
// Supabase session and redirect unauthenticated users to /login.

import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything except Next internals, static assets, and common files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|csv|xlsx)$).*)",
  ],
};
