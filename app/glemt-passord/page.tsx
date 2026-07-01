import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            V
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-ink">
            Glemt passord?
          </h1>
          <p className="mt-1 text-sm text-muted">
            Skriv inn e-posten din, så sender vi deg en lenke for å lage nytt passord.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
