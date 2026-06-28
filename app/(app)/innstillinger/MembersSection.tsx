"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, EmptyState } from "@/components/ui";
import { inviteMember, removeMember, cancelInvite } from "@/lib/actions/members";

interface Member {
  id: string;
  email: string | null;
  user_id: string;
}
interface Invite {
  id: string;
  email: string;
}

export function MembersSection({
  members,
  invites,
  currentUserId,
}: {
  members: Member[];
  invites: Invite[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await inviteMember(email);
      if (!res.ok) return setError(res.error);
      setEmail("");
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Fjerne dette medlemmet? De mister tilgang til skolen.")) return;
    startTransition(async () => {
      const res = await removeMember(id);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  function cancel(id: string) {
    startTransition(async () => {
      await cancelInvite(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Invite */}
      <Card className="p-5">
        <form onSubmit={invite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Inviter med e-post">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="navn@skolen.no"
                required
              />
            </Field>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Sender …" : "Send invitasjon"}
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Personen oppretter selv en konto med denne e-posten, og blir da automatisk
          lagt til i skolen.
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </Card>

      {/* Members */}
      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
          Medlemmer ({members.length})
        </div>
        <ul className="divide-y divide-line/70">
          {members.map((m) => {
            const isSelf = m.user_id === currentUserId;
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-ink">
                  {m.email ?? "—"}
                  {isSelf && (
                    <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-muted ring-1 ring-line">
                      Deg
                    </span>
                  )}
                </span>
                {!isSelf && (
                  <Button variant="danger" onClick={() => remove(m.id)} disabled={pending}>
                    Fjern
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Pending invitations */}
      {invites.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
            Inviterte ({invites.length})
          </div>
          <ul className="divide-y divide-line/70">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-ink">
                  {i.email}
                  <span className="ml-2 text-xs text-muted">venter på registrering</span>
                </span>
                <Button variant="ghost" onClick={() => cancel(i.id)} disabled={pending}>
                  Avbryt
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState
          title="Ingen ventende invitasjoner"
          description="Inviter en kollega med e-posten deres for å gi dem tilgang."
        />
      )}
    </div>
  );
}
