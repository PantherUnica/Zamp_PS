import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getReviewer } from "@/lib/auth";
import { Mark } from "@/components/app-shell";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Reviewer sign in" };

export default async function Login({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/dashboard";
  if (await getReviewer()) redirect(next);
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-[360px]">
        <Mark />
        <h1 className="mt-8 text-lg font-semibold">Reviewer sign in</h1>
        <p className="mt-1 text-sm text-muted">Procurement reviewers approve, reject and follow up on vendor submissions.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
