"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Finding } from "@/lib/types";
import { Button } from "./ui";

type Action = "approve" | "request_info" | "reject";

interface Props {
  caseId: string;
  refCode: string;
  legalName: string;
  status: string;
  recommendation: string | null;
  findings: Finding[];
}

const ACTIONS: { key: Action; label: string }[] = [
  { key: "approve", label: "Approve" },
  { key: "request_info", label: "Request info" },
  { key: "reject", label: "Reject" },
];

export function DecisionPanel({ caseId, refCode, legalName, status, recommendation, findings }: Props) {
  const router = useRouter();
  const flagged = findings.filter((f) => f.severity === "review" || f.severity === "block");
  const fixable = findings.filter((f) => f.severity === "fixable");
  const requestable = [...fixable, ...findings.filter((f) => f.severity === "review")];

  const initialAction: Action = recommendation === "reject" ? "reject" : fixable.length ? "request_info" : "approve";
  const [action, setAction] = useState<Action>(initialAction);
  const [ack, setAck] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<Set<string>>(new Set(fixable.map((f) => f.code + (f.slot ?? f.field ?? ""))));
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keyOf = (f: Finding) => f.code + (f.slot ?? f.field ?? "");
  const canDecide = ["awaiting_review", "error", "awaiting_vendor"].includes(status);
  const approveBlocked = fixable.length > 0 ? `${fixable.length} item${fixable.length > 1 ? "s" : ""} must be fixed by the vendor first.` : null;
  const allAcked = flagged.every((f) => ack.has(keyOf(f)));

  const ready =
    note.trim().length >= 10 &&
    (action === "approve" ? !approveBlocked && allAcked && status === "awaiting_review" : action === "request_info" ? items.size > 0 : true);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const chosen = requestable.filter((f) => items.has(keyOf(f)));
      const res = await fetch(`/api/cases/${caseId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note,
          acknowledged: flagged.filter((f) => ack.has(keyOf(f))).map((f) => f.code),
          items:
            action === "request_info"
              ? chosen.map((f) => ({ code: f.code, title: f.title, action: f.vendorAction ?? `Please clarify: ${f.title}. ${f.detail}`, slot: f.slot, field: f.field }))
              : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Decision failed");
      setConfirmOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setBusy(false);
    }
  }

  if (!canDecide) return null;

  return (
    <section className="rounded-lg border border-line bg-surface" aria-label="Decision">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-md font-semibold">Your decision</h2>
        <p className="text-sm text-muted">The system recommends; only you can approve or reject.</p>
      </header>
      <div className="px-4 py-4">
        <div role="tablist" className="grid grid-cols-3 rounded-md border border-line-strong p-0.5">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              role="tab"
              aria-selected={action === a.key}
              onClick={() => {
                setAction(a.key);
                setError(null);
              }}
              className={`t-colors rounded-[5px] px-2 py-1.5 text-sm font-medium ${action === a.key ? (a.key === "reject" ? "bg-danger text-white" : "bg-ink text-white") : "text-ink-2 hover:bg-neutral-soft"}`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {action === "approve" && (
          <div className="mt-4 space-y-3">
            {status !== "awaiting_review" && <p className="text-sm text-warn">This case is not in the review queue, so it cannot be approved yet.</p>}
            {approveBlocked && <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">{approveBlocked} Use “Request info”.</p>}
            {flagged.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Acknowledge each flagged finding</legend>
                <ul className="space-y-2">
                  {flagged.map((f) => (
                    <li key={keyOf(f)}>
                      <label className="flex cursor-pointer gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1 accent-[var(--color-accent)]"
                          checked={ack.has(keyOf(f))}
                          onChange={(e) => {
                            const n = new Set(ack);
                            if (e.target.checked) n.add(keyOf(f));
                            else n.delete(keyOf(f));
                            setAck(n);
                          }}
                        />
                        <span>
                          <span className={f.severity === "block" ? "text-danger" : "text-warn"}>{f.severity === "block" ? "Hard stop" : "Review"}</span> · {f.title}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
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
                      <input
                        type="checkbox"
                        className="mt-1 accent-[var(--color-accent)]"
                        checked={items.has(keyOf(f))}
                        onChange={(e) => {
                          const n = new Set(items);
                          if (e.target.checked) n.add(keyOf(f));
                          else n.delete(keyOf(f));
                          setItems(n);
                        }}
                      />
                      <span>{f.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        )}

        {action === "reject" && (
          <p className="mt-4 text-sm text-ink-2">
            The vendor will be told the submission was not approved. Your note stays internal and in the audit log.
          </p>
        )}

        <label className="mt-4 block text-sm font-medium" htmlFor="note">
          {action === "request_info" ? "Note to include for the vendor" : "Reviewer note"} <span className="font-normal text-muted">(required)</span>
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={action === "approve" ? "e.g. Verified bank letter; suffix difference only." : action === "reject" ? "e.g. Bank account belongs to a different legal entity." : "e.g. Please send the bank letter for the company account."}
          className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm placeholder:text-muted"
        />
        <div className="mt-1 text-xs text-muted">{note.trim().length < 10 ? `${10 - note.trim().length} more characters` : "Recorded with your name in the decision history"}</div>

        {error && !confirmOpen && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <Button
          variant={action === "reject" ? "danger" : "primary"}
          className="mt-4 w-full"
          disabled={!ready}
          onClick={() => (action === "request_info" ? submit() : setConfirmOpen(true))}
        >
          {busy ? "Saving…" : action === "approve" ? "Approve vendor" : action === "reject" ? "Reject vendor" : "Send request to vendor"}
        </Button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="anim-dialog w-full max-w-md rounded-lg bg-surface p-6 shadow-overlay">
            <h3 id="confirm-title" className="text-md font-semibold">{action === "approve" ? "Approve" : "Reject"} {legalName}?</h3>
            <p className="mt-2 text-sm text-ink-2">
              <span className="mono">{refCode}</span> will be marked <strong>{action === "approve" ? "approved" : "rejected"}</strong>
              {recommendation && recommendation !== action && <> against the system recommendation ({recommendation})</>}. This is final and recorded under your name.
            </p>
            <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-sm text-ink-2">{note}</blockquote>
            {error && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={() => setConfirmOpen(false)} disabled={busy}>Cancel</Button>
              <Button variant={action === "reject" ? "danger" : "primary"} onClick={submit} disabled={busy} autoFocus>
                {busy ? "Saving…" : `Confirm ${action === "approve" ? "approval" : "rejection"}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function ReprocessButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/cases/${caseId}/reprocess`, { method: "POST" });
          const body = await res.json();
          if (res.ok) router.push(`/runs/${body.runId}`);
          else {
            setError(body.error);
            setBusy(false);
          }
        }}
      >
        {busy ? "Starting…" : "Re-run processing"}
      </Button>
      {error && <span className="mt-1 text-xs text-danger">{error}</span>}
    </span>
  );
}

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="t-colors text-sm text-accent underline-offset-4 hover:underline"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${path}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy vendor link"}
    </button>
  );
}
