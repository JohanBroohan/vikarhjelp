import { hasSupabaseEnv } from "@/lib/supabase/config";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            V
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-ink">
            Kom i gang med Vikarhjelp
          </h1>
          <p className="mt-1 text-sm text-muted">
            Opprett en konto og sett opp skolen din.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          {hasSupabaseEnv ? (
            <SignupForm />
          ) : (
            <p className="text-sm text-muted">Supabase er ikke konfigurert ennå.</p>
          )}
        </div>
      </div>
    </main>
  );
}
