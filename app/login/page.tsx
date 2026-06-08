import { hasSupabaseEnv } from "@/lib/supabase/config";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            V
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Vikarhjelp
          </h1>
          <p className="mt-1 text-sm text-muted">
            Logg inn for å administrere fravær og vikardekning.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          {hasSupabaseEnv ? (
            <LoginForm next={safeNext} />
          ) : (
            <div className="space-y-2 text-sm text-muted">
              <p className="font-medium text-ink">Supabase er ikke konfigurert</p>
              <p>
                Sett <code className="rounded bg-canvas px-1">NEXT_PUBLIC_SUPABASE_URL</code> og{" "}
                <code className="rounded bg-canvas px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> i{" "}
                <code className="rounded bg-canvas px-1">.env.local</code>, og start på nytt. Se
                README for oppsett.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
