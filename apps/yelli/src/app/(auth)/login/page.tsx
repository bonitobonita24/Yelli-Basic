import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getServerSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await getServerSession();
  if (session?.user) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <LoginForm />
    </main>
  );
}
