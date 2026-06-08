// Shared types/helpers for server actions.

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/** Trim a string; turn empty/whitespace into null (for optional columns). */
export function nullableText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** Required, trimmed text. Returns null when empty (caller validates). */
export function requiredText(v: unknown): string | null {
  return nullableText(v);
}
