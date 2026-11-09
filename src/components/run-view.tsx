"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Check, Extraction, Finding } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { DOCS } from "@/lib/india";
import { Alert, Check as CheckIcon, Cross, Globe, Minus, Rule, Spark } from "./icons";
import { ButtonLink, Chip, PageHeader, Panel, SourceTag, StatusChip } from "./ui";
import { REC_LABEL, fmtDateTime, fmtDuration, pct, shortId } from "./format";

export interface StageRow {
  key: string;
  label: string;
  position: number;
  status: string;
  summary: string | null;
  output: {
    checks?: Check[];
    findings?: Finding[];
    extractions?: Extraction[];
    recommendation?: string;
    reasons?: string[];
    counts?: Record<string, number>;
    route?: string;
    email?: { status: string; subject?: string; body?: string; error?: string | null; auto?: boolean; generated_by?: string } | null;
  } | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface RunPayload {
  run: { id: string; status: string; trigger: string; version: number; recommendation: string | null; error: string | null; model: string | null; created_at: string; started_at: string | null; finished_at: string | null; result: { summary?: string; route?: string } | null };
  stages: StageRow[];
  submission: { id: string; ref: string; legal_name: string; status: string; vendor_id: string | null } | null;
}

const SEVERITY: Record<string, { label: string; cls: string }> = {
  block: { label: "Hard stop", cls: "text-danger" },
  review: { label: "Needs judgment", cls: "text-accent" },
  fixable: { label: "Vendor can fix", cls: "text-accent" },
  info: { label: "Note", cls: "text-muted" },
};

const FIELD_LABEL: Record<string, string> = {
  legal_name: "Legal name", trade_name: "Trade name", gstin: "GSTIN", pan: "PAN", cin: "CIN", llpin: "LLPIN", udyam: "Udyam", address: "Address", state: "State",
  account_holder: "Account holder", account_number: "Account no.", ifsc: "IFSC", bank_name: "Bank", issue_date: "Issued", expiry_date: "Expires",
};

const KIND_ICON = { ai: Spark, rules: Rule, external: Globe };
const KIND_LABEL = { ai: "AI", rules: "Rules", external: "External" };

export function RunView({ initial }: { initial: RunPayload }) {
  const [data, setData] = useState(initial);
  const [pollError, setPollError] = useState<string | null>(null);
  const done = data.run.status === "completed" || data.run.status === "failed";

  useEffect(() => {
    if (done) return;
    let stop = false;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${initial.run.id}`, { cache: "no-store" });
        if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
        if (!stop) {
          setData(await res.json());
          setPollError(null);
        }
      } catch (e) {
        if (!stop) setPollError(e instanceof Error ? e.message : "Connection problem");
      }
    }, 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [done, initial.run.id]);

  const { run, stages, submission } = data;
  const current = stages.find((s) => s.status === "running");
  const decide = stages.find((s) => s.key === "decide")?.output;
  const comm = stages.find((s) => s.key === "communicate")?.output;
  const vendorHref = submission?.vendor_id ? `/vendors/${submission.vendor_id}` : null;

  return (
    <>
      <PageHeader
        eyebrow={<span className="mono">Run {shortId(run.id)}</span>}
        title={submission?.legal_name ?? "Verification run"}
        meta={
          <>
            {submission && <span className="mono">{submission.ref}</span>}
            <span className="capitalize">{run.trigger} · version {run.version}</span>
            <span>Started <span className="mono">{fmtDateTime(run.started_at ?? run.created_at)}</span></span>
            <span>Duration <span className="mono">{fmtDuration(run.started_at, run.finished_at)}</span></span>
            {run.model && <span>Reader <span className="mono">{run.model}</span></span>}
          </>
        }
        actions={vendorHref && <ButtonLink href={vendorHref}>Open vendor</ButtonLink>}
      />

      {pollError && <div className="mb-4 rounded-md bg-accent-soft px-4 py-2 text-sm text-accent">Live updates paused: {pollError}. Retrying…</div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <Panel title="Stages" meta={done ? <StatusChip status={run.status} /> : <Chip tone="live">{current ? current.label : "Queued"}</Chip>}>
          <ol className="px-4 py-2">
            {stages.map((s, i) => <StageItem key={s.key} stage={s} last={i === stages.length - 1} />)}
          </ol>
        </Panel>

        <div className="flex flex-col gap-4 lg:sticky lg:top-8">
          <Panel title="Outcome">
            <div className="px-4 py-4">
              {run.status === "failed" ? (
                <>
                  <div className="font-semibold text-danger">Verification failed</div>
                  <p className="mt-2 text-sm text-ink-2">{run.error}</p>
                  <p className="mt-2 text-sm text-muted">No decision was made. Re-run it from the vendor page.</p>
                </>
              ) : !done ? (
                <>
                  <div className="text-xs text-muted">Stage {Math.min(stages.length, stages.filter((s) => !["pending", "running"].includes(s.status)).length + 1)} of {stages.length}</div>
                  <div className="mt-1 font-medium">{current?.label ?? "Waiting to start"}</div>
                  <p className="mt-3 text-sm text-muted">AI only reads documents. The outcome comes from deterministic rules, and only a person can approve.</p>
                </>
              ) : (
                <div className="anim-reveal">
                  <div className="text-xs text-muted">Rule-based recommendation</div>
                  <div className={`mt-1 text-lg font-semibold ${run.recommendation === "reject" ? "text-danger" : run.recommendation === "approve" ? "text-ink" : "text-accent"}`}>{REC_LABEL[run.recommendation ?? ""] ?? "-"}</div>
                  <p className="mt-2 text-sm text-ink-2">{run.result?.summary}</p>
                  {decide?.counts && (
                    <dl className="mt-4 grid grid-cols-4 overflow-hidden rounded-md border border-line text-center">
                      {(["block", "review", "fixable", "info"] as const).map((k, i) => (
                        <div key={k} className={`px-1 py-2 ${i ? "border-l border-line" : ""}`}>
                          <dt className="text-[10px] text-muted">{SEVERITY[k].label}</dt>
                          <dd className="mono text-md">{decide.counts?.[k] ?? 0}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="mt-4 text-sm text-ink-2">
                    {comm?.route === "awaiting_vendor"
                      ? comm.email?.auto
                        ? comm.email.status === "sent" ? "Missing-document request emailed to the vendor automatically." : "The request email failed. Retry it from Emails."
                        : "A correction email is drafted for the salesperson to review and send."
                      : "Routed to the review queue for a human decision."}
                  </div>
                  {vendorHref && <ButtonLink href={vendorHref} variant="primary" className="mt-4 w-full">{comm?.route === "awaiting_vendor" ? "Open vendor" : "Review and decide"}</ButtonLink>}
                </div>
              )}
            </div>
          </Panel>
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><Spark className="size-3" /> AI reads</span>
            <span className="inline-flex items-center gap-1"><Rule className="size-3" /> Rules decide</span>
            <span className="inline-flex items-center gap-1"><Globe className="size-3" /> External record</span>
          </div>
          {!done && <Link href="/dashboard" className="px-1 text-xs text-muted underline-offset-4 hover:underline">You can leave this page. The run continues on the server.</Link>}
        </div>
      </div>
    </>
  );
}

function StageIcon({ status }: { status: string }) {
  const ring = "t-state grid size-6 shrink-0 place-items-center rounded-full border";
  switch (status) {
    case "passed": return <span className={`${ring} border-ink bg-ink text-white`}><CheckIcon className="size-3.5" /></span>;
    case "warning": return <span className={`${ring} border-accent bg-accent-soft text-accent`}><Alert className="size-3.5" /></span>;
    case "failed":
    case "error": return <span className={`${ring} border-danger bg-danger-soft text-danger`}><Cross className="size-3.5" /></span>;
    case "running": return <span className={`${ring} border-accent`}><span className="anim-pulse size-2 rounded-full bg-accent" /></span>;
    default: return <span className={`${ring} border-line-strong bg-surface`} />;
  }
}

function CheckIconFor({ status }: { status: Check["status"] }) {
  if (status === "pass") return <CheckIcon className="size-3.5 text-ok" />;
  if (status === "fail") return <Cross className="size-3.5 text-danger" />;
  if (status === "warn") return <Alert className="size-3.5 text-accent" />;
  return <Minus className="size-3.5 text-muted" />;
}

function StageItem({ stage, last }: { stage: StageRow; last: boolean }) {
  const def = STAGES.find((s) => s.key === stage.key);
  const Icon = KIND_ICON[def?.kind ?? "rules"];
  const o = stage.output;
  const findings = (o?.findings ?? []).filter((f) => f.stage === stage.key || stage.key === "decide");
  const hasBody = stage.status !== "pending" && (o || stage.error);
  return (
    <li className="relative flex gap-4 py-3">
      {!last && <span className="absolute left-3 top-10 bottom-0 w-px bg-line" aria-hidden />}
      <StageIcon status={stage.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${stage.status === "pending" ? "text-muted" : ""}`}>{stage.label}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted"><Icon className="size-3" />{KIND_LABEL[def?.kind ?? "rules"]}</span>
          </div>
          <span className="mono text-xs text-muted">
            {stage.summary ?? (stage.status === "running" ? "running" : stage.status === "pending" ? "" : stage.status)}
            {stage.started_at && <> · {fmtDuration(stage.started_at, stage.finished_at)}</>}
          </span>
        </div>

        {hasBody && (
          <div className="anim-reveal mt-3 space-y-3">
            {stage.error && <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{stage.error}</div>}
            {stage.key === "read" && o?.extractions?.map((e) => <ExtractionBlock key={e.document_id} e={e} />)}
            {o?.checks && o.checks.length > 0 && stage.key !== "decide" && (
              <ul className="divide-y divide-line rounded-md border border-line">
                {o.checks.map((c) => (
                  <li key={c.id} className="flex gap-3 px-3 py-2 text-sm">
                    <span className="mt-[3px]"><CheckIconFor status={c.status} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{c.label}</div>
                      <div className="text-ink-2">{c.detail}</div>
                      {c.evidence && c.evidence.length > 0 && (
                        <dl className="mt-1 grid gap-x-4 sm:grid-cols-[auto_1fr]">
                          {c.evidence.map((ev) => (
                            <div key={ev.label} className="contents">
                              <dt className="text-xs text-muted">{ev.label}</dt>
                              <dd className="mono break-all text-xs">{ev.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                    {c.source && <span className="shrink-0"><SourceTag source={c.status === "skip" && c.id.startsWith("registry") ? "not_connected" : c.source} /></span>}
                  </li>
                ))}
              </ul>
            )}
            {findings.length > 0 && stage.key !== "decide" && (
              <ul className="space-y-1">
                {findings.map((f, i) => (
                  <li key={f.code + i} className="text-sm">
                    <span className={`mr-2 text-xs font-medium ${SEVERITY[f.severity].cls}`}>{SEVERITY[f.severity].label}</span>
                    {f.title}
                  </li>
                ))}
              </ul>
            )}
            {stage.key === "decide" && o?.recommendation && (
              <div className="rounded-md border border-line px-3 py-2 text-sm">
                <div className="text-ink-2">{o.checks?.[0]?.detail}</div>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-2">{o.reasons?.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            )}
            {stage.key === "communicate" && o?.email?.body && (
              <details className="rounded-md border border-line">
                <summary className="px-3 py-2 text-sm font-medium">
                  {o.email.auto ? "Email sent to vendor" : "Draft email for the salesperson"}{o.email.generated_by === "agent" ? " · written by the agent" : ""}
                </summary>
                <div className="border-t border-line px-3 py-2">
                  <div className="text-sm font-medium">{o.email.subject}</div>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink-2">{o.email.body}</pre>
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function ExtractionBlock({ e }: { e: Extraction }) {
  const fields = Object.entries(e.fields).filter(([, v]) => v.value);
  return (
    <div className="rounded-md border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm">
        <span className="min-w-0"><span className="font-medium">{DOCS[e.slot]?.label}</span> <span className="mono text-xs text-muted">{e.file_name}</span></span>
        <span className="text-xs text-muted">{e.error ? <span className="text-danger">Extraction failed</span> : <>{e.document_type.replace(/_/g, " ")} · <span className="mono">{pct(e.type_confidence)}</span> · {e.readability.replace("_", " ")}</>}</span>
      </div>
      {e.error ? (
        <div className="px-3 py-2 text-sm text-danger">{e.error}</div>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {fields.map(([k, v]) => (
              <tr key={k}>
                <td className="w-[120px] px-3 py-1.5 text-xs text-muted">{FIELD_LABEL[k] ?? k}</td>
                <td className="mono break-all px-3 py-1.5 text-xs">{v.value}</td>
                <td className="w-[108px] px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-subtle"><div className={`h-1 rounded-full ${v.confidence >= 0.75 ? "bg-ink" : "bg-accent"}`} style={{ width: pct(v.confidence) }} /></div>
                    <span className="mono w-9 text-right text-xs text-muted">{pct(v.confidence)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {e.embedded_instructions.detected && <div className="border-t border-line bg-danger-soft px-3 py-2 text-sm text-danger">Embedded instructions detected and ignored: <span className="mono">“{e.embedded_instructions.text}”</span></div>}
      {e.notes && <div className="border-t border-line px-3 py-2 text-xs text-muted">{e.notes}</div>}
    </div>
  );
}
