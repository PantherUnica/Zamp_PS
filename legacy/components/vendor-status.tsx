"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Slot, SubmissionData } from "@/lib/types";
import { Alert, Check, Cross } from "./icons";
import { StatusChip } from "./ui";
import { SubmissionForm } from "./submission-form";

interface VendorView {
  ref: string;
  status: string;
  legal_name: string;
  version: number;
  data: SubmissionData | null;
  documents: { slot: string; file_name: string }[];
  request: { items: { code: string; title: string; action: string; slot?: string }[]; message: string; created_at: string } | null;
  run: { status: string; stages: { key: string; label: string; status: string }[] } | null;
}

const COPY: Record<string, { title: string; body: string }> = {
  draft: { title: "Submission started", body: "Your documents have not finished uploading. Submit again from the registration page." },
  processing: { title: "Checking your submission", body: "We are reading your documents and verifying your details. This usually takes under a minute." },
  awaiting_vendor: { title: "Action needed", body: "We could not complete verification. Fix the items below and resubmit. You do not need to start over." },
  awaiting_review: { title: "Under review", body: "Your submission passed automated checks or needs a closer look. Our procurement team will make the final decision. No action needed." },
  approved: { title: "Approved", body: "You are registered as a supplier. Our accounts team will be in touch." },
  rejected: { title: "Not approved", body: "We could not approve this registration. Contact your procurement contact if you believe this is a mistake." },
  error: { title: "We hit a problem", body: "Something went wrong while checking your submission. Our team has been notified and will re-run it. No action needed." },
};

export function VendorStatus({ token, demoFiles }: { token: string; demoFiles?: { slot: Slot; url: string; name: string }[] }) {
  const [view, setView] = useState<VendorView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nonce, setNonce] = useState(0);
  const polling = useRef(true);
  const load = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    const fetchView = () =>
      fetch(`/api/submissions/${token}`, { cache: "no-store" })
        .then(async (res) => ({ ok: res.ok, body: await res.json() }))
        .then(({ ok, body }) => {
          if (!alive) return;
          if (!ok) return setError(body.error ?? "Could not load submission");
          setView(body);
          setError(null);
          polling.current = body.status === "processing" || body.run?.status === "running" || body.run?.status === "queued";
        })
        .catch(() => alive && setError("Connection problem. Retrying…"));
    fetchView();
    const t = setInterval(() => polling.current && fetchView(), 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [token, nonce]);

  const busy = view?.status === "processing" || view?.run?.status === "running" || view?.run?.status === "queued";

  if (error) return <p className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>;
  if (!view) return <div className="h-40 animate-none rounded-lg border border-line bg-surface" aria-busy="true" />;

  const copy = COPY[view.status] ?? COPY.processing;
  const requestedSlots = (view.request?.items ?? []).map((i) => i.slot).filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mono text-xs text-muted">{view.ref} · version {view.version}</div>
        <h1 className="text-lg font-semibold">{view.legal_name}</h1>
      </div>

      <section className="rounded-lg border border-line bg-surface px-4 py-4" aria-live="polite">
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip status={view.status} />
          <h2 className="text-md font-semibold">{copy.title}</h2>
        </div>
        <p className="mt-2 text-sm text-ink-2">{copy.body}</p>

        {view.run && (busy || view.status === "processing") && (
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {view.run.stages.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-sm">
                <span className={`grid size-5 place-items-center rounded-full border ${s.status === "running" ? "border-ink" : ["passed", "warning", "failed"].includes(s.status) ? "border-accent bg-accent text-white" : s.status === "error" ? "border-danger text-danger" : "border-line-strong"}`}>
                  {s.status === "running" ? <span className="anim-pulse size-1.5 rounded-full bg-ink" /> : ["passed", "warning", "failed"].includes(s.status) ? <Check className="size-3" /> : s.status === "error" ? <Cross className="size-3" /> : null}
                </span>
                <span className={s.status === "pending" ? "text-muted" : ""}>{s.label}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {view.status === "awaiting_vendor" && view.request && (
        <section className="rounded-lg border border-warn/40 bg-warn-soft px-4 py-4">
          <h2 className="flex items-center gap-2 font-semibold text-warn"><Alert /> What we need from you</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            {view.request.items.map((it, i) => (
              <li key={i}>
                <div className="font-medium">{it.title}</div>
                <div className="text-ink-2">{it.action}</div>
              </li>
            ))}
          </ol>
          {view.request.message.includes("Note from our procurement team") && (
            <p className="mt-3 text-sm text-ink-2">{view.request.message.split("Note from our procurement team: ")[1]?.split("\n")[0]}</p>
          )}
        </section>
      )}

      {view.status === "awaiting_vendor" && view.data && (
        <div>
          <h2 className="mb-3 font-semibold">Update your submission</h2>
          <SubmissionForm
            key={view.version}
            mode="revise"
            token={token}
            initialData={view.data}
            existingDocs={view.documents}
            requestedSlots={requestedSlots}
            demoFiles={demoFiles}
            onDone={load}
          />
        </div>
      )}
    </div>
  );
}
