import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { canDecide, requireStaff } from "@/lib/auth";
import { getVendor } from "@/lib/data";
import { serverEnv } from "@/lib/env";
import { constitution, DOCS, stateName } from "@/lib/india";
import { JOURNEY } from "@/lib/vendor-stage";
import { isPast } from "@/lib/dates";
import type { Slot } from "@/lib/types";
import { AutoRefresh } from "@/components/auto-refresh";
import { CallIntelligence } from "@/components/call-intelligence";
import { DecisionPanel } from "@/components/decision-panel";
import { EmailComposer, EmailLog, type EmailView } from "@/components/email-composer";
import { Check as CheckIcon, FileIcon } from "@/components/icons";
import { AddTask, TaskList } from "@/components/tasks";
import { Avatar, ButtonLink, Chip, Empty, PageHeader, Panel, Prop, StatusChip } from "@/components/ui";
import { BlankEmailButton, DraftCorrection, InvitePanel, ReprocessButton, VendorDetailsEditor } from "@/components/vendor-actions";
import { ChecksBySource, Comparison, Findings, RecommendationLine } from "@/components/verification-report";
import { fmtAge, fmtBytes, fmtDateTime, initials, pct, shortId } from "@/components/format";

export const metadata: Metadata = { title: "Vendor" };

const ACTION_LABEL: Record<string, string> = {
  vendor_created: "Vendor created",
  vendor_updated: "Details edited",
  link_created: "Onboarding link created",
  link_regenerated: "New link issued (old link revoked)",
  link_extended: "Link validity extended",
  form_started: "Vendor started the form",
  document_uploaded: "Document uploaded",
  submitted: "Form submitted",
  resubmitted: "Form resubmitted",
  verification_started: "Verification started",
  recommended: "Agent recommendation",
  processing_failed: "Verification failed",
  info_requested: "Correction requested",
  correction_drafted: "Correction email drafted",
  email_sent: "Email sent",
  email_failed: "Email failed",
  email_discarded: "Draft discarded",
  approved: "Approved",
  rejected: "Rejected",
  reprocessed: "Verification re-run",
  call_logged: "Call logged",
  call_analysed: "Call analysed",
  call_applied: "Call details applied",
  task_done: "Follow-up done",
};
const ACTOR: Record<string, { label: string; dot: string }> = {
  agent: { label: "Agent", dot: "bg-accent" },
  system: { label: "System", dot: "bg-muted" },
  vendor: { label: "Vendor", dot: "bg-ink" },
  staff: { label: "Staff", dot: "bg-ok" },
  reviewer: { label: "Reviewer", dot: "bg-ok" },
};

export default async function VendorPage({ params, searchParams }: PageProps<"/vendors/[id]">) {
  const me = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await getVendor(id);
  if (!c) notFound();
  const { vendor: v, submission: s, data, result, stage } = c;
  const processing = s?.status === "processing";
  const decision = c.events.find((e) => e.action === "approved" || e.action === "rejected");
  const findings = result?.findings ?? [];
  const actionable = findings.filter((f) => f.severity !== "info");
  const url = s ? `${serverEnv.appUrl()}/v/${s.access_token}` : null;
  const sentEmails = c.emails.filter((e) => e.id !== c.draftEmail?.id);

  return (
    <>
      <AutoRefresh active={processing} />
      <div className="mb-2 text-sm"><Link href="/vendors" className="text-muted underline-offset-4 hover:text-ink hover:underline">Vendors</Link></div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar text={initials(v.company_name)} size={36} />
            <span className="truncate">{v.company_name}</span>
          </span>
        }
        meta={
          <>
            <Chip tone={stage.tone}>{stage.label}</Chip>
            <span className="mono">{v.ref}</span>
            {s && <span className="mono">{s.ref}</span>}
            <span>Owner: {v.owner?.id === me.id ? "you" : v.owner?.full_name ?? "unassigned"}</span>
            <span>Updated {fmtAge(v.updated_at)}</span>
          </>
        }
        actions={
          <>
            <ButtonLink href={`/calls/new?vendor=${v.id}`}>Log a call</ButtonLink>
            {c.latestRun && <ButtonLink href={`/runs/${c.latestRun.id}`}>{processing ? "Watch live run" : "Latest run"}</ButtonLink>}
            {s?.submitted_at && ["error", "awaiting_review", "awaiting_vendor"].includes(s.status) && <ReprocessButton vendorId={v.id} />}
          </>
        }
      />

      {sp.email === "failed" && <div className="mb-6 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">The vendor was created, but the invitation email failed. Check the email settings and resend from “Onboarding link”.</div>}

      <ol className="mb-8 grid grid-cols-3 gap-y-3 sm:grid-cols-6" aria-label="Onboarding journey">
        {JOURNEY.map((label, i) => {
          const done = i < stage.step || (i === 5 && stage.step === 5);
          const current = i === stage.step && stage.step !== 5;
          return (
            <li key={label} className="flex items-center gap-2 pr-2">
              <span className={`grid size-5 shrink-0 place-items-center rounded-full border text-[10px] ${done ? "border-ink bg-ink text-white" : current ? "border-accent text-accent" : "border-line-strong text-muted"}`}>
                {done ? <CheckIcon className="size-3" /> : i + 1}
              </span>
              <span className={`truncate text-xs ${current ? "font-semibold text-accent" : done ? "text-ink" : "text-muted"}`}>{label}</span>
              {i < 5 && <span className={`hidden h-px flex-1 sm:block ${done ? "bg-ink" : "bg-line"}`} />}
            </li>
          );
        })}
      </ol>

      {s?.status === "error" && c.latestRun?.error && <div className="mb-6 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">Verification failed: {c.latestRun.error}. No decision was made. Re-run it once the cause is fixed.</div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {c.draftEmail && (
            <section aria-label="Correction email to review">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><span className="size-1.5 rounded-full bg-accent" /> Correction email waiting for you</div>
              <EmailComposer email={c.draftEmail as EmailView} highlight />
            </section>
          )}

          <Panel
            title="Verification"
            meta={c.latestRun && <Link className="mono underline-offset-4 hover:underline" href={`/runs/${c.latestRun.id}`}>run {shortId(c.latestRun.id)}</Link>}
          >
            {processing ? (
              <Empty title="The agent is verifying this submission">This page refreshes when it finishes.</Empty>
            ) : !result ? (
              <Empty title={s?.submitted_at ? "No completed verification" : "Waiting for the vendor's submission"}>
                {s?.submitted_at ? "Re-run verification to produce a report." : "The report appears here as soon as the vendor submits their form."}
              </Empty>
            ) : (
              <>
                <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <RecommendationLine result={result} />
                  {s && !["approved", "rejected"].includes(s.status) && !c.draftEmail && <DraftCorrection vendorId={v.id} findings={findings} />}
                </div>
                {actionable.length > 0 && <div className="border-t border-line"><Findings findings={actionable} /></div>}
                {data && <div className="border-t border-line"><Comparison data={data} result={result} /></div>}
                <div className="border-t border-line"><ChecksBySource checks={result.checks} /></div>
              </>
            )}
          </Panel>

          {data && (
            <Panel title="Submitted details" meta={`version ${s?.current_version}`}>
              <div className="grid gap-x-8 px-4 py-2 md:grid-cols-2">
                <dl className="divide-y divide-line">
                  <Prop label="Legal name">{data.legal_name}</Prop>
                  <Prop label="Trade name">{data.trade_name}</Prop>
                  <Prop label="Constitution">{constitution(data.constitution)?.label}</Prop>
                  <Prop label="CIN" mono>{data.cin}</Prop>
                  {data.llpin && <Prop label="LLPIN" mono>{data.llpin}</Prop>}
                  <Prop label="Udyam" mono>{data.udyam}</Prop>
                  <Prop label="GSTIN" mono>{data.gstin}</Prop>
                  <Prop label="PAN" mono>{data.pan}</Prop>
                </dl>
                <dl className="divide-y divide-line">
                  <Prop label="Address">{data.address_line}, {data.city}, {stateName(data.state)} {data.pincode}</Prop>
                  <Prop label="Contact">{data.contact_name}{data.designation ? `, ${data.designation}` : ""}</Prop>
                  <Prop label="Email / mobile">{data.contact_email} · {data.contact_phone}</Prop>
                  <Prop label="Account holder">{data.bank.account_holder}</Prop>
                  <Prop label="Account" mono>{data.bank.account_number} · {data.bank.account_type}</Prop>
                  <Prop label="IFSC" mono>{data.bank.ifsc}</Prop>
                  <Prop label="Bank">{[data.bank.bank_name, data.bank.branch].filter(Boolean).join(", ")}</Prop>
                </dl>
              </div>
            </Panel>
          )}

          <Panel title="Documents" meta={c.documents.length ? `${c.documents.filter((d) => !d.superseded).length} current` : undefined}>
            {c.documents.length === 0 ? (
              <Empty title="No documents yet" />
            ) : (
              <ul className="divide-y divide-line">
                {c.documents.map((d) => {
                  const e = result?.extractions.find((x) => x.document_id === d.id);
                  return (
                    <li key={d.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${d.superseded ? "opacity-50" : ""}`}>
                      <FileIcon className="shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{DOCS[d.slot as Slot]?.label ?? d.slot}</div>
                        <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="mono break-all text-xs text-ink-2 underline underline-offset-4 hover:text-ink">{d.file_name}</a>
                        <span className="ml-2 text-xs text-muted">{fmtBytes(d.size_bytes)} · v{d.version}{d.superseded ? " · replaced" : ""}</span>
                      </div>
                      {e && <span className="text-xs text-muted">read as {e.document_type.replace(/_/g, " ")} · <span className="mono">{pct(e.type_confidence)}</span></span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Calls" meta={<Link href={`/calls/new?vendor=${v.id}`} className="underline-offset-4 hover:underline">Log a call</Link>}>
            {c.calls.length === 0 ? (
              <Empty title="No calls logged">Upload a call transcript to capture details, objections and follow-ups.</Empty>
            ) : (
              <>
                {c.calls[0].analysis && <CallIntelligence a={c.calls[0].analysis} compact />}
                <ul className="divide-y divide-line border-t border-line">
                  {c.calls.map((call) => (
                    <li key={call.id}>
                      <Link href={`/calls/${call.id}`} className="t-colors flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent-soft/70">
                        <span className="min-w-0"><span className="block truncate text-sm">{call.title}</span><span className="text-xs text-muted">{fmtDateTime(call.occurred_at)}</span></span>
                        {call.analysis ? <span className="mono text-sm">{call.analysis.intelligence.score}/10</span> : <StatusChip status={call.status} />}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title="Activity" meta="Every action by the agent, the vendor and your team">
            {c.events.length === 0 ? (
              <Empty title="No activity yet" />
            ) : (
              <ol className="px-4 py-4">
                {c.events.map((e) => {
                  const a = ACTOR[e.actor_type] ?? ACTOR.system;
                  return (
                    <li key={e.id} className="relative border-l border-line pb-4 pl-4 last:pb-0">
                      <span className={`absolute -left-[4px] top-1.5 size-[7px] rounded-full ${a.dot}`} />
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium">{ACTION_LABEL[e.action] ?? e.action}</span>
                        <span className="text-xs text-muted">{a.label}{e.actor_email ? ` · ${e.actor_email}` : ""} · <span className="mono">{fmtDateTime(e.created_at)}</span></span>
                      </div>
                      {e.note && <p className="mt-0.5 text-sm text-ink-2">{e.note}</p>}
                      {e.data && "changes" in e.data && (
                        <ul className="mt-1 text-xs text-muted">
                          {Object.entries(e.data.changes as Record<string, { from: unknown; to: unknown }>).map(([k, ch]) => (
                            <li key={k}><span className="mono">{k}</span>: {String(ch.from ?? "∅")} → {String(ch.to ?? "∅")}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-8">
          {decision ? (
            <Panel title="Final decision">
              <div className="px-4 py-4">
                <StatusChip status={decision.action} />
                <p className="mt-3 text-sm">{decision.note}</p>
                <p className="mt-2 text-xs text-muted">
                  {decision.actor_email} · <span className="mono">{fmtDateTime(decision.created_at)}</span>
                  {Boolean(decision.data?.overrode_recommendation) && " · overrode the agent's recommendation"}
                </p>
              </div>
            </Panel>
          ) : s?.submitted_at && ["awaiting_review", "awaiting_vendor", "error"].includes(s.status) ? (
            <DecisionPanel vendorId={v.id} refCode={s.ref} legalName={data?.legal_name ?? v.company_name} status={s.status} recommendation={result?.recommendation ?? null} findings={findings} canDecide={canDecide(me)} isOwner={v.owner_id === me.id} />
          ) : null}

          <Panel title="Onboarding link">
            <InvitePanel vendorId={v.id} hasEmail={Boolean(v.contact_email)} url={url} sentAt={s?.link_sent_at ?? null} expiresAt={s?.link_expires_at ?? null} expired={isPast(s?.link_expires_at)} status={s?.status ?? null} submitted={Boolean(s?.submitted_at)} />
            {c.openRequest && (
              <div className="border-t border-line px-4 py-3">
                <div className="text-xs font-medium text-accent">Open correction request</div>
                <ol className="mt-1 list-decimal pl-4 text-sm">{(c.openRequest.items as { title: string }[]).map((it, n) => <li key={n}>{it.title}</li>)}</ol>
              </div>
            )}
          </Panel>

          <Panel title="Vendor details">
            <VendorDetailsEditor vendor={v as unknown as Record<string, string | null> & { id: string }} />
          </Panel>

          <Panel title="Follow-ups">
            <TaskList tasks={c.tasks} />
            <AddTask vendorId={v.id} />
          </Panel>

          <Panel title="Emails" meta={<BlankEmailButton vendorId={v.id} />}>
            {sentEmails.filter((e) => e.status === "draft" || e.status === "failed").map((e) => (
              <div key={e.id} className="border-b border-line p-3"><EmailComposer email={e as EmailView} /></div>
            ))}
            <EmailLog emails={sentEmails.filter((e) => e.status !== "draft" && e.status !== "failed") as EmailView[]} />
          </Panel>
        </aside>
      </div>
    </>
  );
}
