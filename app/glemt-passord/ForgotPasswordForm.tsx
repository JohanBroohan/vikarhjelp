"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      // Send the recovery email. The link lands on /auth/confirm (recovery),
      // which establishes a session and forwards to /tilbakestill-passord.
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/tilbakestill-passord`,
      });
    } catch {
      /* ignore — we show the same message regardless (no email enumeration) */
    } finally {
      // Always show success so we don't reveal whether the address exists.
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-sm">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700 ring-1 ring-emerald-600/20">
          Hvis det finnes en konto for{" "}
          <span className="font-medium">{email.trim()}</span>, har vi sendt en e-post
          med en lenke for å lage nytt passord. Sjekk innboksen (og søppelpost).
        </p>
        <Link
          href="/login"
          className="block text-center font-medium text-brand-700 hover:underline"
        >
          Tilbake til innlogging
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          E-post
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT}
          placeholder="rektor@skolen.no"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Sender …" : "Send lenke"}
      </button>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Tilbake til innlogging
        </Link>
      </p>
    </form>
  );
}
