"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Teacher } from "@/lib/database.types";
import { Button, Card, Field, Input, EmptyState } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { PhoneLink } from "@/components/PhoneLink";
import {
  createTeacher,
  updateTeacher,
  setTeacherActive,
  deleteTeacher,
} from "@/lib/actions/teachers";

type Editing = { mode: "new" } | { mode: "edit"; teacher: Teacher } | null;

export function TeachersManager({ teachers }: { teachers: Teacher[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [pending, startTransition] = useTransition();

  function toggleActive(t: Teacher) {
    startTransition(async () => {
      await setTeacherActive(t.id, !t.is_active);
      router.refresh();
    });
  }

  function remove(t: Teacher) {
    if (
      !confirm(
        `Slette ${t.name}? Dette fjerner også lærerens timeplan. Handlingen kan ikke angres.`,
      )
    )
      return;
    startTransition(async () => {
      await deleteTeacher(t.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ mode: "new" })}>+ Ny lærer</Button>
      </div>

      {teachers.length === 0 ? (
        <EmptyState
          title="Ingen lærere ennå"
          description="Legg til lærere manuelt, eller importer timeplanen for å opprette dem automatisk."
          action={<Button onClick={() => setEditing({ mode: "new" })}>+ Ny lærer</Button>}
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
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-line/70 last:border-0 hover:bg-canvas/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/laerere/${t.id}`}
                        className="font-medium text-ink hover:text-brand-700 hover:underline"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <PhoneLink phone={t.phone} />
                    </td>
                    <td className="px-4 py-3 text-muted">{t.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(t)}
                        disabled={pending}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition ${
                          t.is_active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                            : "bg-canvas text-muted ring-line"
                        }`}
                        title="Klikk for å endre"
                      >
                        {t.is_active ? "Aktiv" : "Inaktiv"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/laerere/${t.id}`}
                          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                        >
                          Timeplan
                        </Link>
                        <Button
                          variant="ghost"
                          onClick={() => setEditing({ mode: "edit", teacher: t })}
                        >
                          Rediger
                        </Button>
                        <Button variant="danger" onClick={() => remove(t)} disabled={pending}>
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

      <TeacherFormModal
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

function TeacherFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = editing?.mode === "edit";
  const teacher = editing?.mode === "edit" ? editing.teacher : null;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset fields whenever the modal target changes.
  const key = editing?.mode === "edit" ? editing.teacher.id : editing?.mode ?? "closed";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setName(teacher?.name ?? "");
    setPhone(teacher?.phone ?? "");
    setEmail(teacher?.email ?? "");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = { name, phone, email };
      const res =
        isEdit && teacher
          ? await updateTeacher(teacher.id, payload)
          : await createTeacher(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <Modal
      open={editing !== null}
      onClose={onClose}
      title={isEdit ? "Rediger lærer" : "Ny lærer"}
    >
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
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
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
