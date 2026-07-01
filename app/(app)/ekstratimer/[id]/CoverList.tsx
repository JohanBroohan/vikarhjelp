import type { CoverRow } from "@/lib/queries/extraHours";
import { formatDateCompact, capitalize } from "@/lib/format";

export function CoverList({ rows }: { rows: CoverRow[] }) {
  return (
    <div>
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm text-muted">{rows.length} vikartimer</p>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
