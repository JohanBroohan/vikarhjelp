import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifies an email link (invite / recovery / signup confirmation) via the
 * token_hash flow and establishes a session, then forwards to `next`.
 * Used by the invitation email's link.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const dest = next.startsWith("/") ? next : "/";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invite", request.url));
}
