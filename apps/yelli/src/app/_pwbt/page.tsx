import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServerSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Powerbyte console",
  robots: { index: false, follow: false },
};

/**
 * Super-Admin console (LOCKED Tenancy Model — _pwbt slug).
 * Reachable only by users in the _pwbt tenant with role:"admin".
 * Returns 404 (not 403) for everyone else to avoid revealing the route exists.
 */
export default async function PwbtConsolePage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");
  if (session.user.tenantSlug !== "_pwbt" || session.user.role !== "admin") {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-6 md:py-10">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Powerbyte console</h1>
          <Badge variant="outline">platform</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Cross-tenant operations. Every action here is logged with the{" "}
          <code className="text-foreground">PLATFORM:</code> prefix.
        </p>
      </header>

      <Card className="border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Tenants</CardTitle>
          <CardDescription>
            TODO Phase 7: wire to <code>trpc.platform.listTenants</code>. Inline suspend / unsuspend
            controls. LAN import via <code>trpc.platform.importTenant</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No tenants list rendered yet.</p>
        </CardContent>
      </Card>
    </main>
  );
}
