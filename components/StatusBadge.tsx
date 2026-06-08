import { STATUS_META, type CoverageStatus } from "@/lib/constants";

/** Coloured pill showing a coverage status in Norwegian. */
export function StatusBadge({ status }: { status: CoverageStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
