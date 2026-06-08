"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Vikar } from "@/lib/database.types";
import { Button, Card, Field, Input, Textarea, EmptyState } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { PhoneLink } from "@/components/PhoneLink";
import {
  createVikar,
  updateVikar,
  setVikarActive,
  deleteVikar,
} from "@/lib/actions/vikars";

type Editing = { mode: "new" } | { mode: "edit"; vikar: Vikar } | null;

export function VikarsManager({ vikars }: { vikars: Vikar[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [pending, startTransition] = useTransition();

  function toggleActive(v: Vikar) {
    startTransition(async () => {
      await setVikarActive(v.id, !v.is_active);
      router.refresh();
    });
  }

  function remove(v: Vikar) {
    if (!confirm(`Slette vikar ${v.name}?`)) return;
    startTransition(async () => {
      await deleteVikar(v.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ mode: "new" })}>+ Ny vikar</Button>
      </div>

      {vikars.length === 0 ? (
        <EmptyState
          title="Ingen vikarer ennå"
          description="Legg til eksterne vikarer med telefonnummer så de er klare når du trenger dem."
          action={<Button onClick={() => setEditing({ mode: "new" })}>+ Ny vikar</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Navn</th>
                  <th className="px-4 py-3 font-medium">Telefon</th>
                  <th className="px-4 py-3 font-medium">E-post</th>
                  <th className="px-4 py-3 font-medium">Notater</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {vikars.map((v) => (
                  <tr key={v.id} className="border-b border-line/70 last:border-0 hover:bg-canvas/50">
                    <td className="px-4 py-3 font-medium text-ink">{v.name}</td>
                    <td className="px-4 py-3">
                      <PhoneLink phone={v.phone} />
                    </td>
                    <td className="px-4 py-3 text-muted">{v.email ?? "—"}</td>
                    <td className="max-w-xs px-4 py-3 text-muted">{v.notes ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(v)}
                        disabled={pending}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition ${
                          v.is_active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                            : "bg-canvas text-muted ring-line"
                        }`}
                      >
                        {v.is_active ? "Aktiv" : "Inaktiv"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="ghost" onClick={() => setEditing({ mode: "edit", vikar: v })}>
                          Rediger
                        </Button>
                        <Button variant="danger" onClick={() => remove(v)} disabled={pending}>
                          Slett
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <VikarFormModal
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function VikarFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = editing?.mode === "edit";
  const vikar = editing?.mode === "edit" ? editing.vikar : null;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const key = editing?.mode === "edit" ? editing.vikar.id : editing?.mode ?? "closed";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setName(vikar?.name ?? "");
    setPhone(vikar?.phone ?? "");
    setEmail(vikar?.email ?? "");
    setNotes(vikar?.notes ?? "");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = { name, phone, email, notes };
      const res =
        isEdit && vikar
          ? await updateVikar(vikar.id, payload)
          : await createVikar(payload);
      if (!res.ok) return setError(res.error);
      onSaved();
    });
  }

  return (
    <Modal open={editing !== null} onClose={onClose} title={isEdit ? "Rediger vikar" : "Ny vikar"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Navn">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefon">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
          <Field label="E-post">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </Field>
        </div>
        <Field label="Notater" hint="F.eks. «foretrekker yngre klasser» eller «kun mandag–onsdag».">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Lagrer …" : "Lagre"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
