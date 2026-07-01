import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMembership, getPendingInvite } from "@/lib/membership";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();

  // Already in a school → go to the app.
  const membership = await getMembership();
  if (membership) redirect("/");

  const invite = await getPendingInvite(user.email);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            V
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-ink">
            {invite ? "Bli med i skolen" : "Sett opp skolen din"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {invite
              ? "Du er invitert til en skole på Vikarhjelp."
              : "Gi skolen et navn for å komme i gang."}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <OnboardingClient invite={invite ? { schoolName: invite.schoolName } : null} />
        </div>

        <form action="/auth/signout" method="post" className="mt-4 text-center">
          <button type="submit" className="text-sm text-muted hover:text-ink">
            Logg ut
          </button>
        </form>
      </div>
    </main>
  );
}
