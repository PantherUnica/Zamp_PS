"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { Arrow } from "./icons";
import { Button, inputClass } from "./ui";

export function LoginForm({ next, error: initialError }: { next: string; error?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

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
    window.location.assign(next);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">Work email</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
        <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </div>
      {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" variant="dark" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

/** Vendors paste the link (or code) from their invitation email. */
export function LinkEntry() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const token = /([a-f0-9]{48})/.exec(value.trim())?.[1];
        if (!token) return setError("Paste the full link from your invitation email.");
        router.push(`/v/${token}`);
      }}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <label htmlFor="link" className="sr-only">Onboarding link</label>
      <input id="link" value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} placeholder="Paste your onboarding link" className={`${inputClass} sm:flex-1`} />
      <Button type="submit" variant="secondary">Continue <Arrow className="size-3.5" /></Button>
      {error && <p className="text-sm text-danger sm:hidden">{error}</p>}
      {error && <p className="hidden text-sm text-danger sm:absolute sm:mt-11 sm:block">{error}</p>}
    </form>
  );
}

export function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 8) return setError("Use at least 8 characters.");
        if (password !== confirm) return setError("The passwords do not match.");
        setBusy(true);
        const { error } = await browserClient().auth.updateUser({ password });
        if (error) {
          setError(error.message);
          setBusy(false);
          return;
        }
        window.location.href = "/dashboard";
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <label htmlFor="pw" className="mb-1 block text-sm font-medium">New password</label>
        <input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="pw2" className="mb-1 block text-sm font-medium">Confirm password</label>
        <input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
      </div>
      {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" variant="dark" disabled={busy}>{busy ? "Saving…" : "Set password and continue"}</Button>
    </form>
  );
}
