// Session-refresh + auth-gating logic used by the root `proxy.ts`.
// (In Next.js 16 the `middleware` convention was renamed to `proxy`.)

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../database.types";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

/** Routes reachable without a session. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth") || // auth callbacks / sign-out
    pathname.startsWith("/api/auth")
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname: earlyPath } = request.nextUrl;

  // Before Supabase is configured, send everything to /login (which renders a
  // friendly setup notice). This prevents authed pages from rendering and
  // throwing a "not configured" error during initial setup.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (isPublicPath(earlyPath)) return NextResponse.next({ request });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: getUser() refreshes the auth token cookies when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated → send to login (preserving where they were going).
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already signed in but visiting /login → bounce to dashboard.
  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
