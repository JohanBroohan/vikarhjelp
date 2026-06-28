"use client";

import { useRouter } from "next/navigation";
import type { DateRange, RangePreset } from "@/lib/reports";
import { RANGE_LABELS } from "@/lib/reports";

const PRESETS: RangePreset[] = ["week", "month", "custom"];

export function RangeFilter({ range }: { range: DateRange }) {
  const router = useRouter();

  function go(preset: RangePreset, from?: string, to?: string) {
    const p = new URLSearchParams();
    p.set("preset", preset);
    if (preset === "custom") {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    router.push(`/ekstratimer?${p.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex rounded-lg bg-canvas p-0.5 ring-1 ring-line">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => go(p, range.from ?? undefined, range.to ?? undefined)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              range.preset === p ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {RANGE_LABELS[p]}
          </button>
        ))}
      </div>

      {range.preset === "custom" && (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={range.from ?? ""}
            onChange={(e) => go("custom", e.target.value, range.to ?? undefined)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 outline-none focus:border-brand-500"
          />
          <span className="text-muted">til</span>
          <input
            type="date"
            value={range.to ?? ""}
            onChange={(e) => go("custom", range.from ?? undefined, e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 outline-none focus:border-brand-500"
          />
        </div>
      )}
    </div>
  );
}
