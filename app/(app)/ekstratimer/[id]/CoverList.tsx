"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CoverRow } from "@/lib/queries/extraHours";
import { formatDateCompact, capitalize } from "@/lib/format";
import { Button } from "@/components/ui";
import { setSettled } from "@/lib/actions/reports";

export function CoverList({ rows }: { rows: CoverRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const unsettledIds = rows.filter((r) => !r.isSettled).map((r) => r.id);

  function toggle(row: CoverRow) {
    startTransition(async () => {
      await setSettled([row.id], !row.isSettled);
      router.refresh();
    });
  }

  function settleAll() {
    if (unsettledIds.length === 0) return;
    startTransition(async () => {
      await setSettled(unsettledIds, true);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-sm text-muted">
          {rows.length} ekstratimer · {unsettledIds.length} utestående
        </p>
        <Button onClick={settleAll} disabled={pending || unsettledIds.length === 0}>
          Marker alle utestående som oppgjort
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Dato</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Klasse</th>
              <th className="px-4 py-3 font-medium">Fag</th>
              <th className="px-4 py-3 font-medium">Dekket for</th>
              <th className="px-4 py-3 text-right font-medium">Oppgjort</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/70 last:border-0 hover:bg-canvas/50">
                <td className="px-4 py-3 text-ink">{capitalize(formatDateCompact(r.date))}</td>
                <td className="px-4 py-3 tabular">{r.period}.</td>
                <td className="px-4 py-3">{r.classGroup ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{r.subject ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{r.absentTeacherName}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggle(r)}
                    disabled={pending}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition ${
                      r.isSettled
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                        : "bg-amber-50 text-amber-700 ring-amber-600/20"
                    }`}
                    title="Klikk for å endre"
                  >
                    {r.isSettled ? "Oppgjort" : "Utestående"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
