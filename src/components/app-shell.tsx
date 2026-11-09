"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function Mark({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="shrink-0">
        <rect width="22" height="22" rx="5" fill="#1c1917" />
        <path d="M6 7.5h10M6 11h7M6 14.5h4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="15.5" cy="14.5" r="1.8" fill="#c2410c" />
      </svg>
      {!compact && <span className="text-sm font-semibold tracking-[-0.01em]">Onboard</span>}
    </span>
  );
}

interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

export function AppShell({ me, nav, children }: { me: { name: string; email: string; roleLabel: string }; nav: NavItem[]; children: ReactNode }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="px-4 pt-5 pb-6">
          <Link href="/dashboard" aria-label="Overview"><Mark /></Link>
        </div>
        <nav className="flex flex-col gap-0.5 px-2" aria-label="Main">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`t-colors relative flex items-center justify-between rounded-md px-3 py-1.5 text-base ${active(n.href) ? "bg-subtle font-medium text-ink" : "text-ink-2 hover:bg-subtle"}`}
            >
              {active(n.href) && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded bg-accent" aria-hidden />}
              {n.label}
              {!!n.badge && <span className="mono rounded bg-accent-soft px-1.5 text-xs font-medium text-accent">{n.badge}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-line px-4 py-4">
          <div className="truncate text-sm font-medium" title={me.email}>{me.name}</div>
          <div className="text-xs text-muted">{me.roleLabel}</div>
          <form action="/auth/signout" method="post" className="mt-3">
            <button className="t-colors text-sm text-muted hover:text-ink">Sign out</button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard"><Mark /></Link>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-muted">Sign out</button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-md px-3 py-1 text-sm ${active(n.href) ? "bg-subtle font-medium text-ink" : "text-ink-2"}`}>
              {n.label}
              {!!n.badge && <span className="ml-1 text-accent">{n.badge}</span>}
            </Link>
          ))}
        </nav>
      </header>

      <main className="min-w-0 px-4 py-8 lg:px-10">
        <div className="mx-auto max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
