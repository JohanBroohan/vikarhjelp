"use client";

import { useState } from "react";
import { GridImportClient } from "./GridImportClient";
import { ImportClient } from "./ImportClient";

type Mode = "grid" | "list";

export function ImportTabs({
  teachers,
}: {
  teachers: { id: string; name: string }[];
}) {
  const [mode, setMode] = useState<Mode>("grid");

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl bg-canvas p-0.5 ring-1 ring-line">
        <button
          onClick={() => setMode("grid")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            mode === "grid" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Per lærer (timeplan-rutenett)
        </button>
        <button
          onClick={() => setMode("list")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            mode === "list" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Liste (CSV)
        </button>
      </div>

      {mode === "grid" ? (
        <GridImportClient teachers={teachers} />
      ) : (
        <ImportClient />
      )}
    </div>
  );
}
