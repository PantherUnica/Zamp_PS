import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { authClient } from "@/lib/supabase/server";
import { Mark } from "@/components/app-shell";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/dashboard";
  if (await getStaff()) redirect(next);
  const { data } = await (await authClient()).auth.getUser();
  const notMember = Boolean(data.user);
  const error = sp.error === "link" ? "That sign-in link has expired or was already used. Ask an admin for a new one." : notMember ? "Your login is not part of this workspace yet. Ask an admin to add you." : null;
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-[360px]">
        <Link href="/"><Mark /></Link>
        <h1 className="display mt-10 text-[48px]">Welcome back</h1>
        <p className="mt-2 mb-8 text-sm text-muted">Sign in to log calls, send onboarding links and review vendors.</p>
        <LoginForm next={next} error={error} />
        <p className="mt-8 text-xs text-muted">Vendors do not need an account. Use the link in your invitation email.</p>
      </div>
    </main>
  );
}
