// Centralised, validated access to the Supabase environment variables. Keeping
// this in one place lets the rest of the app degrade gracefully (show a "set up
// Supabase" notice) instead of hard-crashing when env vars are missing.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both public Supabase env vars are present. */
export const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Throws a clear error if env is missing — used where we truly need a client. */
export function requireSupabaseEnv(): { url: string; anonKey: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase er ikke konfigurert. Sett NEXT_PUBLIC_SUPABASE_URL og " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY i .env.local (se README).",
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}
