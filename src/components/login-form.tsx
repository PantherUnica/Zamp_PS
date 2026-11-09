"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { Button } from "./ui";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await browserClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message);
      setBusy(false);
      return;
    }
    // Full navigation so the server sees the new session cookie.
    window.location.assign(next);
  }

  const input = "t-colors h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-base hover:border-muted";
  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
        <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      </div>
      {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
