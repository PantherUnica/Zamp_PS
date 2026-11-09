"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Finding } from "@/lib/types";
import { Link as LinkIcon, Mail, Spark } from "./icons";
import { Button, Chip, inputClass } from "./ui";
import { fmtDate, fmtDateTime } from "./format";

async function post(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error ?? "Request failed"), { details: json.details });
  return json;
}

/** Magic-link status and controls: create, send/resend, copy, regenerate (revokes the old link). */
export function InvitePanel(p: { vendorId: string; hasEmail: boolean; url: string | null; sentAt: string | null; expiresAt: string | null; expired: boolean; status: string | null; submitted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const expired = p.expired;
  const final = p.status === "approved" || p.status === "rejected";

  async function act(kind: string, body: { send: boolean; regenerate: boolean }) {
    setBusy(kind);
    setMsg(null);
    try {
      const r = await post(`/api/vendors/${p.vendorId}/invite`, body);
      if (r.email?.status === "failed") setMsg({ tone: "danger", text: `Link ready, but the email failed: ${r.email.error}` });
      else setMsg({ tone: "ok", text: r.email ? "Invitation emailed." : "Link created." });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-4 py-4">
      {!p.url ? (
        <>
          <p className="text-sm text-ink-2">No onboarding link yet.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" disabled={!!busy || !p.hasEmail} onClick={() => act("send", { send: true, regenerate: false })}><Mail className="size-3.5" /> {busy === "send" ? "Sending…" : "Create and email link"}</Button>
            <Button size="sm" disabled={!!busy} onClick={() => act("create", { send: false, regenerate: false })}>Create only</Button>
          </div>
          {!p.hasEmail && <p className="mt-2 text-xs text-muted">Add a contact email to send the link.</p>}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-md border border-line bg-subtle px-2 py-1.5">
            <LinkIcon className="size-3.5 shrink-0 text-muted" />
            <span className="mono min-w-0 flex-1 truncate text-xs" title={p.url}>{p.url.replace(/^https?:\/\//, "")}</span>
            <button className="t-colors shrink-0 text-xs font-medium text-ink-2 hover:text-ink" onClick={async () => { await navigator.clipboard.writeText(p.url!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
            <dt className="text-muted">Emailed</dt>
            <dd>{p.sentAt ? fmtDateTime(p.sentAt) : <span className="text-accent">Not sent yet</span>}</dd>
            <dt className="text-muted">Valid until</dt>
            <dd className={expired ? "text-accent" : ""}>{fmtDate(p.expiresAt)}{expired ? " · expired" : ""}</dd>
          </dl>
          {!final && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant={!p.sentAt || expired ? "primary" : "secondary"} disabled={!!busy || !p.hasEmail} onClick={() => act("send", { send: true, regenerate: false })}>
                <Mail className="size-3.5" /> {busy === "send" ? "Sending…" : p.sentAt ? "Resend" : "Email link"}
              </Button>
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => confirm("Create a new link? The current link will stop working immediately.") && act("regen", { send: p.hasEmail, regenerate: true })}>
                {busy === "regen" ? "Working…" : "New link"}
              </Button>
              <a href={p.url} target="_blank" rel="noreferrer" className="t-colors inline-flex h-8 items-center rounded-md px-3 text-sm text-ink-2 hover:bg-subtle">Open form</a>
            </div>
          )}
        </>
      )}
      {msg && <p className={`mt-3 rounded-md px-3 py-2 text-xs ${msg.tone === "ok" ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{msg.text}</p>}
    </div>
  );
}

const FIELDS = [
  ["company_name", "Company name"],
  ["contact_name", "Contact person"],
  ["contact_email", "Contact email"],
  ["contact_phone", "Mobile"],
  ["city", "City"],
  ["supplies", "Supplies"],
  ["source", "Source"],
] as const;

/** Inline editor for the vendor record (lead details). Changes are audit-logged server-side. */
export function VendorDetailsEditor({ vendor }: { vendor: Record<string, string | null> & { id: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(() => Object.fromEntries([...FIELDS.map(([k]) => [k, vendor[k] ?? ""]), ["notes", vendor.notes ?? ""]]));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <div className="px-4 py-2">
        <dl className="divide-y divide-line">
          {FIELDS.map(([k, l]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-3 py-2 text-sm">
              <dt className="text-muted">{l}</dt>
              <dd className="min-w-0 break-words">{vendor[k] || <span className="text-muted">-</span>}</dd>
            </div>
          ))}
          {vendor.notes && (
            <div className="py-2 text-sm">
              <dt className="text-muted">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap">{vendor.notes}</dd>
            </div>
          )}
        </dl>
        <Button size="sm" variant="ghost" className="my-2 -ml-3" onClick={() => setEditing(true)}>Edit details</Button>
      </div>
    );
  }
  return (
    <form
      className="grid gap-3 px-4 py-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await post(`/api/vendors/${vendor.id}`, v, "PATCH");
          setEditing(false);
          router.refresh();
        } catch (err) {
          const errs: Record<string, string> = {};
          for (const d of ((err as { details?: { path: string; message: string }[] }).details ?? [])) errs[d.path] = d.message;
          setErrors(errs);
        } finally {
          setBusy(false);
        }
      }}
    >
      {FIELDS.map(([k, l]) => (
        <div key={k}>
          <label htmlFor={`ve-${k}`} className="mb-1 block text-xs text-muted">{l}</label>
          <input id={`ve-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={`${inputClass} h-8 text-sm ${errors[k] ? "border-danger" : ""}`} />
          {errors[k] && <p className="mt-1 text-xs text-danger">{errors[k]}</p>}
        </div>
      ))}
      <div>
        <label htmlFor="ve-notes" className="mb-1 block text-xs text-muted">Notes</label>
        <textarea id="ve-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} rows={3} className="w-full rounded-md border border-line-strong px-3 py-2 text-sm" />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" type="button" onClick={() => setEditing(false)}>Cancel</Button>
        <Button size="sm" variant="dark" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

export function ReprocessButton({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <Button disabled={busy} onClick={async () => {
        setBusy(true);
        setError(null);
        try {
          const r = await post(`/api/vendors/${vendorId}/reprocess`);
          router.push(`/runs/${r.runId}`);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed");
          setBusy(false);
        }
      }}>{busy ? "Starting…" : "Re-run verification"}</Button>
      {error && <span className="mt-1 text-xs text-danger">{error}</span>}
    </span>
  );
}

/** Ask the agent to write a correction email from selected findings; the draft then appears for review. */
export function DraftCorrection({ vendorId, findings }: { vendorId: string; findings: Finding[] }) {
  const router = useRouter();
  const actionable = findings.filter((f) => f.severity === "fixable" || f.severity === "review");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set(actionable.filter((f) => f.severity === "fixable").map((f) => f.code)));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!actionable.length) return null;
  if (!open) return <Button size="sm" onClick={() => setOpen(true)}><Spark className="size-3.5" /> Draft correction email</Button>;
  return (
    <div className="mt-3 rounded-md border border-line p-3">
      <div className="mb-2 text-sm font-medium">What should the vendor fix?</div>
      <ul className="space-y-1.5">
        {actionable.map((f) => (
          <li key={f.code}>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-[var(--color-accent)]" checked={picked.has(f.code)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(f.code); else n.delete(f.code); setPicked(n); }} />
              <span>{f.title} {f.severity === "review" && <Chip tone="neutral" className="ml-1">judgment</Chip>}</span>
            </label>
          </li>
        ))}
      </ul>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note to include (e.g. what you discussed on the call)" className="mt-3 w-full rounded-md border border-line-strong px-3 py-2 text-sm" />
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" variant="dark" disabled={busy || picked.size === 0} onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await post(`/api/vendors/${vendorId}/emails`, { mode: "agent", codes: [...picked], note: note || undefined });
            setOpen(false);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}><Spark className="size-3.5" /> {busy ? "Agent is writing…" : "Write draft"}</Button>
      </div>
    </div>
  );
}

export function BlankEmailButton({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="ghost" disabled={busy} onClick={async () => { setBusy(true); await post(`/api/vendors/${vendorId}/emails`, { mode: "blank" }).catch(() => null); setBusy(false); router.refresh(); }}>
      <Mail className="size-3.5" /> {busy ? "…" : "New email"}
    </Button>
  );
}
