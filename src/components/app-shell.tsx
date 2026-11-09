"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/cases", label: "Cases" },
  { href: "/onboard", label: "New submission" },
];

export function Mark() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-6 place-items-center rounded-md bg-ink text-[11px] font-semibold text-white">VO</span>
      <span className="text-sm font-semibold">Vendor Onboarding</span>
    </span>
  );
}

export function AppShell({ email, children }: { email: string; children: ReactNode }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[224px_1fr]">
      <aside className="hidden border-r border-line bg-surface lg:flex lg:min-h-dvh lg:flex-col">
        <div className="px-4 py-4">
          <Link href="/dashboard"><Mark /></Link>
        </div>
        <nav className="flex flex-col gap-1 px-2" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`t-colors rounded-md px-2 py-2 text-base ${active(n.href) ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-neutral-soft"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-line px-4 py-4">
          <div className="text-xs text-muted">Signed in as reviewer</div>
          <div className="truncate text-sm" title={email}>{email}</div>
          <form action="/auth/signout" method="post" className="mt-2">
            <button className="t-colors text-sm text-muted underline-offset-4 hover:text-ink hover:underline">Sign out</button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-line bg-surface lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard"><Mark /></Link>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-muted">Sign out</button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-sm ${active(n.href) ? "bg-accent-soft font-medium text-accent" : "text-ink-2"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="min-w-0 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
