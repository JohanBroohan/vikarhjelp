"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * On phones the app is used almost exclusively to register absence, so when the
 * app is opened at the root (Oversikt) we send them to Registrer fravær.
 *
 * Fires ONCE per browser session (guarded by sessionStorage), so:
 *  - a fresh app open on a phone lands on /fravaer,
 *  - tapping "Oversikt" afterwards stays on Oversikt (no bounce),
 *  - a reload keeps you where you are.
 * Desktop and any non-root entry are untouched.
 */
export function MobileEntryRedirect() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (sessionStorage.getItem("vh:entered")) return;
      sessionStorage.setItem("vh:entered", "1");
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      if (isMobile && window.location.pathname === "/") {
        router.replace("/fravaer");
      }
    } catch {
      /* ignore (private mode / no sessionStorage) */
    }
  }, [router]);

  return null;
}
