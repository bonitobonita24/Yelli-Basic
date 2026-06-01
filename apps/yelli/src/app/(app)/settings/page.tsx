import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getServerSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-6 md:py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and notifications.</p>
      </header>

      <Card className="border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><span className="text-muted-foreground">Email:</span> {session.user.email}</div>
          <Separator />
          <div><span className="text-muted-foreground">Tenant:</span> {session.user.tenantSlug}</div>
          <Separator />
          <div><span className="text-muted-foreground">Role:</span> {session.user.role}</div>
        </CardContent>
      </Card>

      <Card className="border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            TODO Phase 7: Web Push opt-in (LOCKED Web Push UX — tap-to-open).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
