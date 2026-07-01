"use client";

import { useRouter } from "next/navigation";
import type { DateRange, RangePreset } from "@/lib/reports";
import { RANGE_LABELS } from "@/lib/reports";
import { DateField } from "@/components/DateField";

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
          <div className="w-52">
            <DateField
              value={range.from ?? ""}
              onChange={(iso) => go("custom", iso, range.to ?? undefined)}
            />
          </div>
          <span className="text-muted">til</span>
          <div className="w-52">
            <DateField
              value={range.to ?? ""}
              onChange={(iso) => go("custom", range.from ?? undefined, iso)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
