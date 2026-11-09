"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Finding } from "@/lib/types";
import { Lock } from "./icons";
import { celebrate } from "./mission";
import { Button } from "./ui";

type Action = "approve" | "request_info" | "reject";

interface Props {
  vendorId: string;
  refCode: string;
  legalName: string;
  status: string;
  recommendation: string | null;
  findings: Finding[];
  canDecide: boolean;
  isOwner: boolean;
}

const keyOf = (f: Finding) => f.code + (f.slot ?? f.field ?? "");

export function DecisionPanel({ vendorId, refCode, legalName, status, recommendation, findings, canDecide, isOwner }: Props) {
  const router = useRouter();
  const flagged = findings.filter((f) => f.severity === "review" || f.severity === "block");
  const fixable = findings.filter((f) => f.severity === "fixable");
  const requestable = [...fixable, ...findings.filter((f) => f.severity === "review")];
  const mayDecide = canDecide && !isOwner;
  const actions: Action[] = mayDecide ? ["approve", "request_info", "reject"] : ["request_info"];

  const [action, setAction] = useState<Action>(!mayDecide || fixable.length ? "request_info" : recommendation === "reject" ? "reject" : "approve");
  const [ack, setAck] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<Set<string>>(new Set(fixable.map(keyOf)));
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approveBlocked = fixable.length > 0 ? `${fixable.length} item${fixable.length > 1 ? "s" : ""} must be fixed by the vendor first.` : null;
  const allAcked = flagged.every((f) => ack.has(keyOf(f)));
  const ready = note.trim().length >= 10 && (action === "approve" ? !approveBlocked && allAcked && status === "awaiting_review" : action === "request_info" ? items.size > 0 : true);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const chosen = requestable.filter((f) => items.has(keyOf(f)));
      const res = await fetch(`/api/vendors/${vendorId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note,
          notify,
          acknowledged: flagged.filter((f) => ack.has(keyOf(f))).map((f) => f.code),
          items: action === "request_info" ? chosen.map((f) => ({ code: f.code, title: f.title, action: f.vendorAction ?? `Please check and correct: ${f.title}. ${f.detail}`, slot: f.slot, field: f.field })) : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Decision failed");
      if (body.email?.status === "failed") setError(`Saved, but the email to the vendor failed: ${body.email.error}. Retry it from Emails.`);
      setConfirmOpen(false);
      if (action === "approve") celebrate();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setBusy(false);
    }
  }

  const label = { approve: "Approve", request_info: "Request changes", reject: "Reject" };

  return (
    <section className="rounded-[10px] border border-line bg-surface" aria-label="Decision">
      <header className="border-b border-line px-4 py-3">
        <h2 className="font-semibold">Decision</h2>
        <p className="text-sm text-muted">The agent recommends. A person decides.</p>
      </header>
      <div className="px-4 py-4">
        {!mayDecide && (
          <p className="mb-3 flex gap-2 rounded-md bg-subtle px-3 py-2 text-xs text-ink-2">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            {isOwner && canDecide ? "You own this vendor, so another reviewer must approve or reject it." : "Approval and rejection are reserved for reviewers. You can send the vendor a correction request."}
          </p>
        )}
        {actions.length > 1 && (
          <div role="tablist" className="grid grid-cols-3 rounded-md border border-line-strong p-0.5">
            {actions.map((a) => (
              <button key={a} role="tab" aria-selected={action === a} onClick={() => { setAction(a); setError(null); }} className={`t-colors rounded-[5px] px-2 py-1.5 text-sm font-medium ${action === a ? (a === "reject" ? "bg-danger text-white" : "bg-ink text-white") : "text-ink-2 hover:bg-subtle"}`}>
                {label[a]}
              </button>
            ))}
          </div>
        )}

        {action === "approve" && (
          <div className="mt-4 space-y-3">
            {status !== "awaiting_review" && <p className="text-sm text-accent">This vendor is not in the review queue yet.</p>}
            {approveBlocked && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">{approveBlocked} Use “Request changes”.</p>}
            {flagged.length > 0 ? (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Confirm you have reviewed each flag</legend>
                <ul className="space-y-2">
                  {flagged.map((f) => (
                    <li key={keyOf(f)}>
                      <label className="flex cursor-pointer gap-2 text-sm">
                        <input type="checkbox" className="mt-1 accent-[var(--color-accent)]" checked={ack.has(keyOf(f))} onChange={(e) => { const n = new Set(ack); if (e.target.checked) n.add(keyOf(f)); else n.delete(keyOf(f)); setAck(n); }} />
                        <span><span className={f.severity === "block" ? "text-danger" : "text-accent"}>{f.severity === "block" ? "Hard stop" : "Judgment"}</span> · {f.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : (
              <p className="text-sm text-ink-2">Every automated check passed. Registry checks (GSTN, NSDL, penny drop) are not connected, so your sign-off is the final verification.</p>
            )}
          </div>
        )}

        {action === "request_info" && (
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium">Ask the vendor to fix</legend>
            {requestable.length === 0 ? (
              <p className="text-sm text-muted">No open findings. Describe what you need in the note.</p>
            ) : (
              <ul className="space-y-2">
                {requestable.map((f) => (
                  <li key={keyOf(f)}>
                    <label className="flex cursor-pointer gap-2 text-sm">
                      <input type="checkbox" className="mt-1 accent-[var(--color-accent)]" checked={items.has(keyOf(f))} onChange={(e) => { const n = new Set(items); if (e.target.checked) n.add(keyOf(f)); else n.delete(keyOf(f)); setItems(n); }} />
                      <span>{f.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">Sends immediately with your note. For an agent-written email you can edit first, use “Draft correction email”.</p>
          </fieldset>
        )}

        {action === "reject" && <p className="mt-4 text-sm text-ink-2">The vendor gets a short, neutral notice. Your note stays internal and in the audit trail.</p>}

        <label className="mt-4 block text-sm font-medium" htmlFor="note">
          {action === "request_info" ? "Note to the vendor" : "Reviewer note"} <span className="font-normal text-muted">(required)</span>
        </label>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={action === "approve" ? "e.g. Cheque name matches; suffix difference only." : action === "reject" ? "e.g. Bank account belongs to another legal entity." : "e.g. Please share a cheque in the LLP's own name."} className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm placeholder:text-muted" />
        <div className="mt-1 text-xs text-muted">{note.trim().length < 10 ? `${10 - note.trim().length} more characters` : "Recorded with your name in the audit trail"}</div>
        {action !== "request_info" && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-[var(--color-accent)]" /> Email the vendor the outcome
          </label>
        )}

        {error && !confirmOpen && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <Button variant={action === "reject" ? "danger" : action === "approve" ? "primary" : "dark"} className="mt-4 w-full" disabled={!ready || busy} onClick={() => (action === "request_info" ? submit() : setConfirmOpen(true))}>
          {busy ? "Saving…" : action === "approve" ? "Approve vendor" : action === "reject" ? "Reject vendor" : "Send request to vendor"}
        </Button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/20 px-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="anim-dialog w-full max-w-md rounded-[10px] bg-surface p-6 shadow-overlay">
            <h3 id="confirm-title" className="font-semibold">{action === "approve" ? "Approve" : "Reject"} {legalName}?</h3>
            <p className="mt-2 text-sm text-ink-2">
              <span className="mono">{refCode}</span> will be marked <strong>{action === "approve" ? "approved" : "rejected"}</strong>
              {recommendation && ((action === "approve" && recommendation !== "approve") || (action === "reject" && recommendation !== "reject")) && <> against the agent&apos;s recommendation</>}. This is final and recorded under your name.
            </p>
            <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-sm text-ink-2">{note}</blockquote>
            {error && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={() => setConfirmOpen(false)} disabled={busy}>Cancel</Button>
              <Button variant={action === "reject" ? "danger" : "primary"} onClick={submit} disabled={busy} autoFocus>{busy ? "Saving…" : `Confirm ${action === "approve" ? "approval" : "rejection"}`}</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
