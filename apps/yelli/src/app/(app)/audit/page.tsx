import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServerSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Audit log",
};

export default async function AuditPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-6 md:py-10">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
          <Badge variant="secondary">admin</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Immutable record of every mutation. Retention: 7 years (PH BIR compliance).
        </p>
      </header>

      <Card className="border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Recent activity</CardTitle>
          <CardDescription>
            TODO Phase 7: wire to <code>trpc.audit.list</code> with cursor pagination and
            action-prefix filter. Render as <code>&lt;Table&gt;</code> at md+ and card list at &lt;md
            per LOCKED Mobile-First.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No entries yet — start using the app to populate the audit trail.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
