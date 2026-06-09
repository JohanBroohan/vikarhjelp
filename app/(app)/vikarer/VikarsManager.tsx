"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Vikar } from "@/lib/database.types";
import { WEEKDAYS, WEEKDAY_NAMES, WEEKDAY_SHORT } from "@/lib/constants";
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
                  <th className="px-4 py-3 font-medium">Utilgjengelig</th>
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
                      {v.unavailable_weekdays?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {[...v.unavailable_weekdays]
                            .sort()
                            .map((d) => (
                              <span
                                key={d}
                                className="rounded bg-canvas px-1.5 py-0.5 text-xs text-muted ring-1 ring-line"
                                title={WEEKDAY_NAMES[d]}
                              >
                                {WEEKDAY_SHORT[d]}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
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
  const [unavailableDays, setUnavailableDays] = useState<number[]>([]);
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
    setUnavailableDays(vikar?.unavailable_weekdays ?? []);
    setError(null);
  }

  function toggleDay(day: number) {
    setUnavailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = { name, phone, email, notes, unavailable_weekdays: unavailableDays };
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
        <Field label="Notater" hint="F.eks. «foretrekker yngre klasser».">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-ink">Ikke tilgjengelig på</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const active = unavailableDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-ink text-white"
                      : "text-muted ring-1 ring-line hover:bg-canvas"
                  }`}
                >
                  {WEEKDAY_NAMES[d]}
                </button>
              );
            })}
          </div>
          <span className="block text-xs text-muted">
            Merk dagene vikaren ikke kan jobbe (f.eks. studerer på tirsdager). Disse
            dagene foreslås ikke når du registrerer fravær.
          </span>
        </div>

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
