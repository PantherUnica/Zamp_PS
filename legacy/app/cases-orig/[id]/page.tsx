import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCase } from "@/lib/data";
import { COUNTRIES } from "@/lib/rules/countries";
import { STAGES, type Check, type Extraction, type Finding, type Slot } from "@/lib/types";
import { AutoRefresh } from "@/components/auto-refresh";
import { CopyLink, DecisionPanel, ReprocessButton } from "@/components/decision-panel";
import { Check as CheckIcon, Cross, FileIcon } from "@/components/icons";
import { ButtonLink, Chip, Empty, Field, PageHeader, Panel, RecChip, StatusChip } from "@/components/ui";
import { REC_LABEL, fmtBytes, fmtDateTime, pct, shortId } from "@/components/format";

export const metadata: Metadata = { title: "Case review" };

const SEV_ORDER = ["block", "review", "fixable", "info"] as const;
const SEV = {
  block: { label: "Hard stop", tone: "danger" as const },
  review: { label: "Needs review", tone: "warn" as const },
  fixable: { label: "Vendor can fix", tone: "warn" as const },
  info: { label: "Note", tone: "neutral" as const },
};

const ACTION_LABEL: Record<string, string> = {
  submitted: "Vendor submitted",
  resubmitted: "Vendor resubmitted",
  recommended: "System recommendation",
  info_requested: "Information requested",
  approved: "Approved",
  rejected: "Rejected",
  reprocessed: "Processing re-run",
  processing_failed: "Processing failed",
};

export default async function CasePage({ params }: PageProps<"/cases/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await getCase(id);
  if (!c) notFound();
  const { submission: s, data, result } = c;
  const country = COUNTRIES[data.country];
  const findings = (result?.findings ?? []) as Finding[];
  const processing = s.status === "processing";
  const decision = c.events.find((e) => e.action === "approved" || e.action === "rejected");
  const openRequest = c.requests.find((r) => r.status === "open");
  const ex = (slot: Slot) => result?.extractions.find((e) => e.slot === slot && !e.error);
  const checkById = (cid: string) => result?.checks.find((x) => x.id === cid);

  const comparisons: { field: string; submitted: string; found: { source: string; value: string | null }[]; check?: Check }[] = [
    {
      field: "Legal name",
      submitted: data.legal_name,
      found: [
        { source: "Registration", value: ex("incorporation_certificate")?.fields.legal_name.value ?? null },
        { source: "Tax certificate", value: ex("tax_certificate")?.fields.legal_name.value ?? null },
      ],
      check: checkById("name_registry") ?? checkById("name_tax"),
    },
    { field: country.taxIdLabel, submitted: data.tax_id, found: [{ source: "Tax certificate", value: ex("tax_certificate")?.fields.tax_id.value ?? null }], check: checkById("tax_vs_cert") ?? checkById("tax_format") },
    { field: "Account holder", submitted: data.bank.account_holder, found: [{ source: "Bank document", value: ex("bank_proof")?.fields.account_holder.value ?? null }], check: checkById("bank_holder_doc") ?? checkById("bank_holder_form") },
    {
      field: data.bank.iban ? "IBAN" : "Account number",
      submitted: data.bank.iban ?? data.bank.account_number ?? "",
      found: [{ source: "Bank document", value: ex("bank_proof")?.fields.iban.value ?? ex("bank_proof")?.fields.account_number.value ?? null }],
      check: checkById("acct_vs_doc"),
    },
  ];

  return (
    <>
      <AutoRefresh active={processing} />
      <PageHeader
        eyebrow={<span className="mono">{s.ref}</span>}
        title={s.legal_name}
        meta={
          <>
            <StatusChip status={s.status} />
            <span>{country.name}</span>
            <span>Version {s.current_version}</span>
            <span>Submitted <span className="mono">{fmtDateTime(s.created_at)}</span></span>
          </>
        }
        actions={
          <>
            {c.latestRun && <ButtonLink href={`/runs/${c.latestRun.id}`}>{processing ? "Watch live run" : "Open latest run"}</ButtonLink>}
            {["error", "awaiting_review"].includes(s.status) && <ReprocessButton caseId={s.id} />}
          </>
        }
      />

      {s.status === "error" && c.latestRun?.error && (
        <div className="mb-6 rounded-md border border-line bg-danger-soft px-4 py-3 text-sm text-danger">
          Processing failed: {c.latestRun.error}. No decision was made; re-run processing once the cause is fixed.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="System recommendation" meta={c.latestRun && <Link className="mono underline-offset-4 hover:underline" href={`/runs/${c.latestRun.id}`}>run {shortId(c.latestRun.id)}</Link>}>
            {processing ? (
              <Empty title="Processing in progress">This page updates when the run finishes.</Empty>
            ) : !result ? (
              <Empty title="No completed run">Re-run processing to produce a recommendation.</Empty>
            ) : (
              <div className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`text-xl font-semibold ${result.recommendation === "approve" ? "text-accent" : result.recommendation === "reject" ? "text-danger" : "text-warn"}`}>
                    {REC_LABEL[result.recommendation]}
                  </span>
                  <span className="text-sm text-ink-2">{result.summary}</span>
                </div>
                {findings.length === 0 ? (
                  <p className="mt-4 flex items-center gap-2 text-sm text-accent"><CheckIcon /> All {result.checks.length} checks passed.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-line rounded-md border border-line">
                    {[...findings].sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)).map((f, i) => (
                      <li key={f.code + i} className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={SEV[f.severity].tone}>{SEV[f.severity].label}</Chip>
                          <span className="font-medium">{f.title}</span>
                          <span className="mono text-xs text-muted">{f.code}</span>
                        </div>
                        <p className="mt-1 text-sm text-ink-2">{f.detail}</p>
                        {f.evidence && f.evidence.length > 0 && (
                          <dl className="mt-2 grid gap-x-4 gap-y-0.5 sm:grid-cols-[auto_1fr]">
                            {f.evidence.map((e) => (
                              <div key={e.label} className="contents">
                                <dt className="text-xs text-muted">{e.label}</dt>
                                <dd className="mono break-all text-xs">{e.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Panel>

          {result && (
            <Panel title="Submitted vs documents" meta="What the vendor typed against what the documents say">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="px-4 py-2 font-normal">Field</th>
                      <th className="px-4 py-2 font-normal">Submitted</th>
                      <th className="px-4 py-2 font-normal">Document</th>
                      <th className="px-4 py-2 font-normal">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {comparisons.map((row) => (
                      <tr key={row.field} className="align-top">
                        <td className="px-4 py-3 text-muted">{row.field}</td>
                        <td className="mono break-all px-4 py-3 text-xs">{row.submitted || "-"}</td>
                        <td className="px-4 py-3">
                          {row.found.filter((f) => f.value).length === 0 ? (
                            <span className="text-xs text-muted">Not available</span>
                          ) : (
                            row.found.filter((f) => f.value).map((f) => (
                              <div key={f.source} className="mb-1 last:mb-0">
                                <span className="mono break-all text-xs">{f.value}</span>
                                <span className="ml-2 text-xs text-muted">{f.source}</span>
                              </div>
                            ))
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.check ? (
                            <span className={`inline-flex items-center gap-1 text-xs ${row.check.status === "pass" ? "text-accent" : "text-danger"}`}>
                              {row.check.status === "pass" ? <CheckIcon className="size-3.5" /> : <Cross className="size-3.5" />}
                              {row.check.status === "pass" ? "Match" : "Mismatch"}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <Panel title="Documents" meta={`${c.documents.filter((d) => !d.superseded).length} current`}>
            {c.documents.length === 0 ? (
              <Empty title="No documents uploaded" />
            ) : (
              <ul className="divide-y divide-line">
                {c.documents.map((d) => {
                  const e = result?.extractions.find((x) => x.document_id === d.id) as Extraction | undefined;
                  return (
                    <li key={d.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${d.superseded ? "opacity-50" : ""}`}>
                      <FileIcon className="shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{country.documents[d.slot as Slot]?.label ?? d.slot}</div>
                        <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="mono break-all text-xs text-accent underline-offset-4 hover:underline">
                          {d.file_name}
                        </a>
                        <span className="ml-2 text-xs text-muted">{fmtBytes(d.size_bytes)} · v{d.version}{d.superseded ? " · replaced" : ""}</span>
                      </div>
                      {e && (
                        <span className="text-xs text-muted">
                          read as {e.document_type.replace(/_/g, " ")} · <span className="mono">{pct(e.type_confidence)}</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Submitted details" meta={`version ${s.current_version}`}>
            <dl className="divide-y divide-line px-4">
              <Field label="Legal name">{data.legal_name}</Field>
              {data.trading_name && <Field label="Trading name">{data.trading_name}</Field>}
              <Field label="Country">{country.name}</Field>
              <Field label="Registration no."><span className="mono">{data.registration_number}</span></Field>
              <Field label={country.taxIdLabel}><span className="mono">{data.tax_id}</span></Field>
              <Field label="Address">{data.address}</Field>
              <Field label="Contact">{data.contact_name} · {data.contact_email}</Field>
              <Field label="Account holder">{data.bank.account_holder}</Field>
              <Field label="Bank">{[data.bank.bank_name, data.bank.bank_country].filter(Boolean).join(" · ")}</Field>
              {data.bank.iban && <Field label="IBAN"><span className="mono">{data.bank.iban}</span></Field>}
              {data.bank.bic && <Field label="BIC"><span className="mono">{data.bank.bic}</span></Field>}
              {data.bank.account_number && <Field label="Account no."><span className="mono">{data.bank.account_number}</span></Field>}
              {data.bank.ifsc && <Field label="IFSC"><span className="mono">{data.bank.ifsc}</span></Field>}
              {data.bank.routing_number && <Field label="Routing no."><span className="mono">{data.bank.routing_number}</span></Field>}
            </dl>
          </Panel>

          {result && (
            <Panel title="All checks" meta={`${result.checks.filter((x) => x.status === "pass").length} of ${result.checks.length} passed`}>
              <div className="divide-y divide-line">
                {STAGES.filter((st) => result.checks.some((x) => x.stage === st.key)).map((st) => {
                  const list = result.checks.filter((x) => x.stage === st.key);
                  const failed = list.filter((x) => x.status !== "pass").length;
                  return (
                    <details key={st.key} open={failed > 0}>
                      <summary className="t-colors flex items-center justify-between px-4 py-3 hover:bg-canvas">
                        <span className="font-medium">{st.label}</span>
                        <span className="mono text-xs text-muted">{list.length - failed}/{list.length}</span>
                      </summary>
                      <ul className="px-4 pb-3">
                        {list.map((x) => (
                          <li key={x.id} className="flex gap-2 py-1 text-sm">
                            <span className={`mt-[3px] ${x.status === "pass" ? "text-accent" : "text-danger"}`}>{x.status === "pass" ? <CheckIcon className="size-3.5" /> : <Cross className="size-3.5" />}</span>
                            <span><span className="font-medium">{x.label}</span> <span className="text-ink-2">{x.detail}</span></span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-8">
          {decision ? (
            <Panel title="Final decision">
              <div className="px-4 py-4">
                <StatusChip status={decision.action} />
                <p className="mt-3 text-sm">{decision.note}</p>
                <p className="mt-2 text-xs text-muted">
                  {decision.actor_email} · <span className="mono">{fmtDateTime(decision.created_at)}</span>
                  {Boolean(decision.data?.overrode_recommendation) && " · overrode system recommendation"}
                </p>
              </div>
            </Panel>
          ) : (
            <DecisionPanel
              caseId={s.id}
              refCode={s.ref}
              legalName={s.legal_name}
              status={s.status}
              recommendation={result?.recommendation ?? null}
              findings={findings}
            />
          )}

          <Panel title="Vendor communication" meta={<CopyLink path={`/v/${s.access_token}`} />}>
            {c.requests.length === 0 ? (
              <Empty title="No requests sent">The vendor has not been asked for anything.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {c.requests.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Chip tone={r.status === "open" ? "warn" : "neutral"}>{r.status === "open" ? "Open" : "Resolved"}</Chip>
                      <span className="mono text-xs text-muted">{fmtDateTime(r.created_at)}</span>
                    </div>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                      {r.items.map((it, i) => <li key={i}>{it.title}</li>)}
                    </ol>
                    <details className="mt-2">
                      <summary className="text-xs text-accent">Full message · by {r.created_by}</summary>
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-ink-2">{r.message}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            {openRequest && <p className="border-t border-line px-4 py-3 text-xs text-muted">The vendor reopens this same case from their link; processing resumes on resubmission.</p>}
          </Panel>

          <Panel title="Decision history">
            <ol className="px-4 py-3">
              {c.events.map((e) => (
                <li key={e.id} className="relative border-l border-line pb-4 pl-4 last:pb-0">
                  <span className={`absolute -left-[4px] top-1.5 size-[7px] rounded-full ${e.actor_type === "reviewer" ? "bg-accent" : e.actor_type === "vendor" ? "bg-ink" : "bg-muted"}`} />
                  <div className="text-sm font-medium">{ACTION_LABEL[e.action] ?? e.action}</div>
                  <div className="text-xs text-muted">
                    {e.actor_type === "system" ? "System" : e.actor_email ?? e.actor_type} · <span className="mono">{fmtDateTime(e.created_at)}</span>
                  </div>
                  {e.action === "recommended" && typeof e.data?.recommendation === "string" && <div className="mt-1"><RecChip rec={e.data.recommendation} /></div>}
                  {e.note && <p className="mt-1 text-sm text-ink-2">{e.note}</p>}
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </>
  );
}
