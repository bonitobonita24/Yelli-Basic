import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Create an account",
};

/**
 * Phase 5 scaffold placeholder.
 *
 * The full Cloud signup flow (org slug picker validating against the 18 reserved
 * slugs + email verification + first admin onboarding) is a Phase 7 task.
 * LAN install does NOT use this page — it has its own /setup wizard.
 *
 * For the scaffold we surface the page shell so /register doesn't 404.
 */
export default function RegisterPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <Card className="mx-auto w-full max-w-md border-border/40 shadow-sm">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Create an account
          </CardTitle>
          <CardDescription>
            Yelli Cloud signup opens in Phase 7. For now, contact Powerbyte to
            provision a tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Running Yelli LAN? Visit{" "}
            <code className="text-foreground">http://yelli.local/setup</code> on
            your local network to start the LAN onboarding wizard.
          </p>
          <Button asChild className="w-full h-11" variant="outline">
            <a href="/login">Back to sign in</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
