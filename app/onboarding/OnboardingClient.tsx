"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSchool, acceptInvite } from "@/lib/actions/members";

const INPUT =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function OnboardingClient({
  invite,
}: {
  invite: { schoolName: string } | null;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function done() {
    router.replace("/");
    router.refresh();
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await acceptInvite(firstName, lastName);
      if (!res.ok) return setError(res.error);
      done();
    });
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createSchool(name, firstName, lastName);
      if (!res.ok) return setError(res.error);
      done();
    });
  }

  const nameFields = (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label htmlFor="first" className="block text-sm font-medium text-ink">
          Fornavn
        </label>
        <input
          id="first"
          required
          autoFocus
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={INPUT}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="last" className="block text-sm font-medium text-ink">
          Etternavn
        </label>
        <input
          id="last"
          required
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={INPUT}
        />
      </div>
    </div>
  );

  if (invite) {
    return (
      <form onSubmit={join} className="space-y-4">
        <p className="text-sm text-muted">
          Du er invitert til{" "}
          <span className="font-medium text-ink">{invite.schoolName}</span>.
        </p>
        {nameFields}
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-brand-600 px-4 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Blir med …" : `Bli med i ${invite.schoolName}`}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={create} className="space-y-4">
      {nameFields}
      <div className="space-y-1.5">
        <label htmlFor="school" className="block text-sm font-medium text-ink">
          Navn på skolen
        </label>
        <input
          id="school"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={INPUT}
          placeholder="F.eks. Opdøl skole"
        />
      </div>
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand-600 px-4 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Oppretter …" : "Opprett skole"}
      </button>
    </form>
  );
}
