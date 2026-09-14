"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { ChevronDown } from "lucide-react";
import { EMPLOYEE_ROLES } from "@/lib/constants";

const FILTERS_KEY = "oversikt-filters";

export type Filters = {
  /** Which employee "stillinger" to show, keyed by role slug. */
  stillinger: Record<string, boolean>;
  hideAbsent: boolean;
  onlyFree: boolean;
  onlyInClass: boolean;
  showVikars: boolean;
};

const DEFAULT_FILTERS: Filters = {
  stillinger: Object.fromEntries(EMPLOYEE_ROLES.map((r) => [r.value, true])),
  hideAbsent: false,
  onlyFree: false,
  onlyInClass: false,
  showVikars: true,
};

function isDefaultFilters(f: Filters): boolean {
  return (
    !f.hideAbsent &&
    !f.onlyFree &&
    !f.onlyInClass &&
    f.showVikars &&
    EMPLOYEE_ROLES.every((r) => f.stillinger[r.value] !== false)
  );
}

// The selection is persisted per-browser in localStorage and exposed through
// useSyncExternalStore, so the server/first-hydration render uses the defaults
// and the saved value is applied right after — no hydration mismatch and no
// setState-in-effect. An in-memory cache is the source of truth (loaded from
// storage once) and gives getSnapshot a referentially stable value between
// changes, as useSyncExternalStore requires. Because the store lives at module
// scope, the Filter button and the board share it even in different subtrees.
let filtersLoaded = false;
let cachedFilters: Filters = DEFAULT_FILTERS;
const filterListeners = new Set<() => void>();

function readFilters(): Filters {
  if (!filtersLoaded) {
    filtersLoaded = true;
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Filters>;
        cachedFilters = {
          ...DEFAULT_FILTERS,
          ...saved,
          stillinger: { ...DEFAULT_FILTERS.stillinger, ...(saved.stillinger ?? {}) },
        };
      }
    } catch {
      /* storage unavailable or corrupt — keep the defaults */
    }
  }
  return cachedFilters;
}

function subscribeFilters(cb: () => void): () => void {
  filterListeners.add(cb);
  return () => filterListeners.delete(cb);
}

function writeFilters(next: Filters) {
  cachedFilters = next;
  filtersLoaded = true;
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — value still lives in memory for this session */
  }
  filterListeners.forEach((l) => l());
}

/** Shared board filters. Any component calling this hook stays in sync. */
export function useBoardFilters(): [Filters, Dispatch<SetStateAction<Filters>>] {
  const filters = useSyncExternalStore(
    subscribeFilters,
    readFilters,
    () => DEFAULT_FILTERS,
  );
  const setFilters: Dispatch<SetStateAction<Filters>> = (action) =>
    writeFilters(
      typeof action === "function"
        ? (action as (prev: Filters) => Filters)(readFilters())
        : action,
    );
  return [filters, setFilters];
}

/** Number of filters narrowing the board — shown as a badge on the button. */
function activeFilterCount(f: Filters, showStatus: boolean): number {
  let n = 0;
  for (const r of EMPLOYEE_ROLES) if (f.stillinger[r.value] === false) n += 1;
  if (!f.showVikars) n += 1;
  if (f.hideAbsent) n += 1;
  if (showStatus && f.onlyFree) n += 1;
  if (showStatus && f.onlyInClass) n += 1;
  return n;
}

export function FilterMenu({ showStatus }: { showStatus: boolean }) {
  const [filters, setFilters] = useBoardFilters();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape (mirrors ExportCsvMenu).
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleStilling = (v: string) =>
    setFilters((f) => ({
      ...f,
      stillinger: { ...f.stillinger, [v]: f.stillinger[v] === false },
    }));

  const count = activeFilterCount(filters, showStatus);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#bbb] px-3 py-1.5 text-sm font-medium text-[#030303] transition hover:bg-black/[0.03] dark:border-line dark:text-muted"
      >
        Filter
        {count > 0 && (
          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-semibold text-white">
            {count}
          </span>
        )}
        <ChevronDown className="h-4 w-4" strokeWidth={2} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-line bg-surface p-3 shadow-xl">
          <FilterSection title="Stilling">
            {EMPLOYEE_ROLES.map((r) => (
              <CheckRow
                key={r.value}
                label={r.label}
                checked={filters.stillinger[r.value] !== false}
                onChange={() => toggleStilling(r.value)}
              />
            ))}
          </FilterSection>

          <div className="my-2 border-t border-line" />

          <CheckRow
            label="Vis vikarer"
            checked={filters.showVikars}
            onChange={() => setFilters((f) => ({ ...f, showVikars: !f.showVikars }))}
          />
          <CheckRow
            label="Skjul fraværende"
            checked={filters.hideAbsent}
            onChange={() => setFilters((f) => ({ ...f, hideAbsent: !f.hideAbsent }))}
          />

          {showStatus && (
            <>
              <div className="my-2 border-t border-line" />
              <FilterSection title="Status nå">
                <CheckRow
                  label="Bare ledige nå"
                  checked={filters.onlyFree}
                  onChange={() => setFilters((f) => ({ ...f, onlyFree: !f.onlyFree }))}
                />
                <CheckRow
                  label="Bare i klasse"
                  checked={filters.onlyInClass}
                  onChange={() =>
                    setFilters((f) => ({ ...f, onlyInClass: !f.onlyInClass }))
                  }
                />
              </FilterSection>
            </>
          )}

          {!isDefaultFilters(filters) && (
            <>
              <div className="my-2 border-t border-line" />
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="px-1.5 text-xs text-muted underline hover:text-ink"
              >
                Nullstill filtre
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 px-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm text-ink hover:bg-canvas">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-brand-600"
      />
      {label}
    </label>
  );
}
