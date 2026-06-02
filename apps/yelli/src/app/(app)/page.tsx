import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getServerSession } from "@/server/auth/session";
import { RegisterDeviceButton } from "@/components/devices/RegisterDeviceButton";
import { DeviceList } from "@/components/devices/DeviceList";

export const metadata: Metadata = {
  title: "Directory",
};

export default async function AppHomePage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-6 md:py-10">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{session.user.email}</span>
          {" "}<Badge variant="secondary" className="ml-1">{session.user.role}</Badge>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Directory</h1>
        <p className="text-sm text-muted-foreground">
          Tap a device to call. Long-press for actions.
        </p>
      </header>

      <DeviceList />

      <RegisterDeviceButton />
    </main>
  );
}
