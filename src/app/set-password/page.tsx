import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase/server";
import { Mark } from "@/components/app-shell";
import { SetPasswordForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Set password" };

export default async function SetPassword() {
  const { data } = await (await authClient()).auth.getUser();
  if (!data.user) redirect("/login?error=link");
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4">
      <div className="w-full max-w-[360px]">
        <Mark />
        <h1 className="mt-10 text-lg font-semibold">Set your password</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Signed in as {data.user.email}</p>
        <SetPasswordForm />
      </div>
    </main>
  );
}
