import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  // The recovery link (via /auth/confirm) establishes a session before landing
  // here. Without one, the link was invalid or expired.
  const user = await getUser();
  if (!user) redirect("/login?error=recovery");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            V
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-ink">
            Lag nytt passord
          </h1>
          <p className="mt-1 text-sm text-muted">
            Velg et nytt passord for kontoen din.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
