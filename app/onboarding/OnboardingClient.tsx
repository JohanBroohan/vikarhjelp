"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSchool, acceptInvite } from "@/lib/actions/members";

export function OnboardingClient({
  invite,
}: {
  invite: { schoolName: string } | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function done() {
    router.replace("/");
    router.refresh();
  }

  function join() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInvite();
      if (!res.ok) return setError(res.error);
      done();
    });
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createSchool(name);
      if (!res.ok) return setError(res.error);
      done();
    });
  }

  if (invite) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Du er invitert til{" "}
          <span className="font-medium text-ink">{invite.schoolName}</span>.
        </p>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button
          onClick={join}
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Blir med …" : `Bli med i ${invite.schoolName}`}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={create} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="school" className="block text-sm font-medium text-ink">
          Navn på skolen
        </label>
        <input
          id="school"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          placeholder="F.eks. Opdøl skole"
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Oppretter …" : "Opprett skole"}
      </button>
    </form>
  );
}
