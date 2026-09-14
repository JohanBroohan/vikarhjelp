import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { getUser } from "@/lib/auth";
import { getMembership } from "@/lib/membership";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { MobileEntryRedirect } from "@/components/MobileEntryRedirect";

// Every page in this group is per-request (auth + live data), so never
// statically prerender them at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Before Supabase is configured, point the user at the login page which
  // explains setup (the proxy lets everything through in that state).
  if (!hasSupabaseEnv) redirect("/login");

  const user = await getUser();
  if (!user) redirect("/login");

  // Signed in but not yet attached to a school → onboarding.
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <MobileEntryRedirect />
      <div className="hidden shrink-0 py-3 pl-3 md:block">
        <Sidebar />
      </div>
      {/* Main content sits in a white, rounded "frame" floating on the canvas. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-2 md:p-3 md:pl-3">
        <MobileNav />
        <main className="min-h-0 flex-1 overflow-y-auto rounded-[16px] border border-[#cececc] bg-[#fafafa] shadow-[0px_8px_28px_0px_rgba(0,0,0,0.04)] dark:border-line dark:bg-surface dark:shadow-none">
          {children}
        </main>
      </div>
    </div>
  );
}
