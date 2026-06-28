"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input } from "@/components/ui";
import { renameSchool, updateProfile } from "@/lib/actions/members";
import { MembersSection } from "./MembersSection";

type Tab = "konto" | "medlemmer" | "fakturering";

const TABS: { key: Tab; label: string }[] = [
  { key: "konto", label: "Konto" },
  { key: "medlemmer", label: "Medlemmer" },
  { key: "fakturering", label: "Fakturering" },
];

interface Member {
  id: string;
  email: string | null;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}
interface Invite {
  id: string;
  email: string;
}

export function SettingsTabs({
  members,
  invites,
  currentUserId,
  email,
  firstName,
  lastName,
  schoolName,
}: {
  members: Member[];
  invites: Invite[];
  currentUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  schoolName: string;
}) {
  const [tab, setTab] = useState<Tab>("konto");

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg bg-canvas p-0.5 ring-1 ring-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
              tab === t.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "medlemmer" && (
        <MembersSection
          members={members}
          invites={invites}
          currentUserId={currentUserId}
        />
      )}
      {tab === "konto" && (
        <AccountSection
          email={email}
          firstName={firstName}
          lastName={lastName}
          schoolName={schoolName}
        />
      )}
      {tab === "fakturering" && <BillingSection schoolName={schoolName} />}
    </div>
  );
}

function AccountSection({
  email,
  firstName,
  lastName,
  schoolName,
}: {
  email: string;
  firstName: string;
  lastName: string;
  schoolName: string;
}) {
  const router = useRouter();
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profilePending, startProfile] = useTransition();
  const [name, setName] = useState(schoolName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    startProfile(async () => {
      const res = await updateProfile(first, last);
      if (!res.ok) return setProfileError(res.error);
      setProfileSaved(true);
      router.refresh();
    });
  }

  function saveSchool(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await renameSchool(name);
      if (!res.ok) return setError(res.error);
      setSaved(true);
      router.refresh();
    });
  }

  const profileUnchanged =
    (first.trim() === firstName && last.trim() === lastName) ||
    !first.trim() ||
    !last.trim();
  const unchanged = name.trim() === schoolName || !name.trim();

  return (
    <Card className="max-w-xl divide-y divide-line">
      <Row label="Innlogget som" value={email} />

      <div className="px-5 py-4">
        <form onSubmit={saveProfile} className="space-y-2">
          <label className="block text-sm text-muted">Navn</label>
          <div className="flex gap-2">
            <Input
              value={first}
              placeholder="Fornavn"
              onChange={(e) => {
                setFirst(e.target.value);
                setProfileSaved(false);
              }}
              className="flex-1"
            />
            <Input
              value={last}
              placeholder="Etternavn"
              onChange={(e) => {
                setLast(e.target.value);
                setProfileSaved(false);
              }}
              className="flex-1"
            />
            <Button type="submit" disabled={profilePending || profileUnchanged}>
              {profilePending ? "Lagrer …" : "Lagre"}
            </Button>
          </div>
          {profileError && <p className="text-sm text-red-700">{profileError}</p>}
          {profileSaved && <p className="text-sm text-emerald-700">Lagret ✓</p>}
        </form>
      </div>

      <div className="px-5 py-4">
        <form onSubmit={saveSchool} className="space-y-2">
          <label className="block text-sm text-muted">Skolenavn</label>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              className="flex-1"
            />
            <Button type="submit" disabled={pending || unchanged}>
              {pending ? "Lagrer …" : "Lagre"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {saved && <p className="text-sm text-emerald-700">Lagret ✓</p>}
        </form>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div>
          <div className="text-sm font-medium text-ink">Logg ut</div>
          <div className="text-xs text-muted">Avslutt økten på denne enheten.</div>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 transition hover:bg-red-50"
          >
            Logg ut
          </button>
        </form>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

function BillingSection({ schoolName }: { schoolName: string }) {
  return (
    <div className="max-w-xl space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-muted">Nåværende plan</div>
            <div className="mt-0.5 text-lg font-semibold text-ink">Prøveperiode</div>
            <div className="mt-1 text-sm text-muted">
              {schoolName} bruker Vikarhjelp gratis i prøveperioden. Alle funksjoner
              er tilgjengelige.
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
            Aktiv
          </span>
        </div>
        <button
          disabled
          className="mt-4 cursor-not-allowed rounded-lg bg-brand-600/60 px-3.5 py-2 text-sm font-medium text-white"
          title="Kommer snart"
        >
          Administrer abonnement
        </button>
      </Card>
      <p className="text-xs text-muted">
        Fakturering og abonnement kommer snart. Ta kontakt på{" "}
        <a href="mailto:hei@vikarhjelp.no" className="text-brand-700 hover:underline">
          hei@vikarhjelp.no
        </a>{" "}
        hvis du har spørsmål.
      </p>
    </div>
  );
}
