import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { getUser } from "@/lib/auth";
import { getMembership } from "@/lib/membership";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

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
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:block">
        <Sidebar email={user.email ?? null} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileNav />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
