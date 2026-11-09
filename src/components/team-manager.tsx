"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, inputClass } from "./ui";
import { fmtDate } from "./format";

type Role = "sales" | "reviewer" | "admin";
const ROLES: { value: Role; label: string; help: string }[] = [
  { value: "sales", label: "Salesperson", help: "Logs calls, adds vendors, sends links and correction requests" },
  { value: "reviewer", label: "Reviewer", help: "Everything above, plus approve and reject vendors they don't own" },
  { value: "admin", label: "Admin", help: "Everything, plus manage the team" },
];

export function TeamManager({ members, meId }: { members: { id: string; email: string; full_name: string | null; role: Role; created_at: string }[]; meId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", role: "sales" as Role });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="overflow-x-auto glass rounded-[16px]">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2 font-normal">Member</th>
              <th className="px-4 py-2 font-normal">Role</th>
              <th className="px-4 py-2 text-right font-normal">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{m.full_name ?? m.email.split("@")[0]}{m.id === meId && <span className="ml-2 text-xs font-normal text-muted">you</span>}</div>
                  <div className="text-xs text-muted">{m.email}</div>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    aria-label={`Role for ${m.email}`}
                    value={m.role}
                    disabled={busy === m.id}
                    onChange={async (e) => {
                      setBusy(m.id);
                      setMsg(null);
                      const res = await fetch(`/api/team/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: e.target.value }) });
                      const b = await res.json();
                      if (!res.ok) setMsg({ ok: false, text: b.error });
                      setBusy(null);
                      router.refresh();
                    }}
                    className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm"
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </td>
                <td className="mono px-4 py-2.5 text-right text-xs text-muted">{fmtDate(m.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        className="glass rounded-[16px] p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy("add");
          setMsg(null);
          const res = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
          const b = await res.json();
          if (!res.ok) setMsg({ ok: false, text: b.details?.[0]?.message ?? b.error });
          else {
            setMsg(b.email?.status === "sent" ? { ok: true, text: `Invitation sent to ${form.email}.` } : { ok: false, text: `Account created, but the invitation email failed: ${b.email?.error}` });
            setForm({ full_name: "", email: "", role: "sales" });
            router.refresh();
          }
          setBusy(null);
        }}
      >
        <h2 className="font-semibold">Add a teammate</h2>
        <p className="mt-1 text-sm text-muted">They get an email to set their password.</p>
        <div className="mt-4 grid gap-3">
          <input aria-label="Full name" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputClass} />
          <input aria-label="Email" type="email" placeholder="name@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
          <fieldset className="grid gap-2">
            {ROLES.map((r) => (
              <label key={r.value} className={`flex cursor-pointer gap-2 rounded-md border px-3 py-2 text-sm ${form.role === r.value ? "border-ink" : "border-line"}`}>
                <input type="radio" name="role" checked={form.role === r.value} onChange={() => setForm({ ...form, role: r.value })} className="mt-1 accent-[var(--color-accent)]" />
                <span><span className="font-medium">{r.label}</span><span className="block text-xs text-muted">{r.help}</span></span>
              </label>
            ))}
          </fieldset>
        </div>
        {msg && <p className={`mt-3 rounded-md px-3 py-2 text-xs ${msg.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{msg.text}</p>}
        <Button variant="dark" className="mt-4 w-full" disabled={busy === "add" || !form.email || form.full_name.length < 2}>{busy === "add" ? "Adding…" : "Add and send invite"}</Button>
      </form>
    </div>
  );
}
