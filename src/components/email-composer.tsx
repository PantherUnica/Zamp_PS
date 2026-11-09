"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spark } from "./icons";
import { Button, Chip, StatusChip, inputClass } from "./ui";
import { EMAIL_KIND_LABEL, fmtDateTime } from "./format";

export interface EmailView {
  id: string;
  kind: string;
  audience: string;
  to_email: string;
  subject: string;
  body_text: string;
  cta_label: string | null;
  cta_url: string | null;
  status: string;
  generated_by: string;
  error: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
  provider_message_id: string | null;
}

async function call(url: string, init: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

/** Draft editor + sender. Drafts are editable; failed emails can be edited and retried; sent emails are read-only. */
export function EmailComposer({ email, highlight }: { email: EmailView; highlight?: boolean }) {
  const router = useRouter();
  const editable = email.status === "draft" || email.status === "failed";
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body_text);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = subject !== email.subject || body !== email.body_text;

  async function run(kind: string, fn: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }
  const save = () => call(`/api/emails/${email.id}`, { method: "PATCH", body: JSON.stringify({ subject, body_text: body }) });

  return (
    <div className={`rounded-[10px] border bg-surface ${highlight ? "border-accent-line" : "border-line"}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 ${highlight ? "border-accent-line bg-accent-soft" : "border-line"}`}>
        <div className="flex items-center gap-2 text-sm">
          {email.generated_by === "agent" && <span className="inline-flex items-center gap-1 text-xs font-medium text-accent"><Spark className="size-3" /> Written by the agent</span>}
          <span className="font-medium">{EMAIL_KIND_LABEL[email.kind]}</span>
          <span className="text-muted">to {email.to_email}</span>
        </div>
        <StatusChip status={email.status} />
      </div>
      <div className="px-4 py-4">
        {email.status === "failed" && <p className="mb-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">Delivery failed after {email.attempts} attempt{email.attempts === 1 ? "" : "s"}: {email.error}</p>}
        {editable ? (
          <>
            <label className="mb-1 block text-xs text-muted" htmlFor={`s-${email.id}`}>Subject</label>
            <input id={`s-${email.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
            <label className="mt-3 mb-1 block text-xs text-muted" htmlFor={`b-${email.id}`}>Message</label>
            <textarea id={`b-${email.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={Math.min(18, Math.max(8, body.split("\n").length + 1))} className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm leading-6" />
            {email.cta_label && <p className="mt-2 text-xs text-muted">Includes a “{email.cta_label}” button linking to the vendor’s secure form.</p>}
          </>
        ) : (
          <details>
            <summary className="text-sm"><span className="font-medium">{email.subject}</span> <span className="text-muted">· {fmtDateTime(email.sent_at ?? email.created_at)}</span></summary>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-ink-2">{email.body_text}</pre>
            {email.provider_message_id && <p className="mono mt-2 text-[11px] text-muted">Accepted by Gmail · {email.provider_message_id}</p>}
          </details>
        )}
        {error && <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
      {editable && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("discard", () => call(`/api/emails/${email.id}`, { method: "DELETE" }))}>Discard</Button>
          {dirty && <Button size="sm" disabled={!!busy} onClick={() => run("save", save)}>{busy === "save" ? "Saving…" : "Save draft"}</Button>}
          <Button size="sm" variant="primary" disabled={!!busy} onClick={() => run("send", async () => { if (dirty) await save(); await call(`/api/emails/${email.id}/send`, { method: "POST" }); })}>
            {busy === "send" ? "Sending…" : email.status === "failed" ? "Retry send" : "Send to vendor"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function EmailLog({ emails }: { emails: EmailView[] }) {
  if (!emails.length) return <p className="px-4 py-6 text-sm text-muted">No emails yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {emails.map((e) => (
        <li key={e.id} className="px-4 py-3">
          <details>
            <summary className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{e.subject}</span>
                <span className="block text-xs text-muted">{EMAIL_KIND_LABEL[e.kind]} · {e.audience === "staff" ? "to team" : `to ${e.to_email}`} · {fmtDateTime(e.sent_at ?? e.created_at)}{e.generated_by === "agent" ? " · agent-written" : ""}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">{e.status === "failed" ? <Chip tone="danger">Failed</Chip> : <StatusChip status={e.status} />}</span>
            </summary>
            {e.error && <p className="mt-2 text-xs text-danger">{e.error}</p>}
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink-2">{e.body_text}</pre>
          </details>
        </li>
      ))}
    </ul>
  );
}
