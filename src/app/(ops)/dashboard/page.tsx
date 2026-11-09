import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getDashboard, getMission } from "@/lib/data";
import { JOURNEY } from "@/lib/vendor-stage";
import { STAGES } from "@/lib/types";
import { AutoRefresh } from "@/components/auto-refresh";
import { CaughtBars, CheckDonut, CountUp, HealthGauge, Pipeline, Scoreboard } from "@/components/mission";
import { NewVendorButton } from "@/components/new-vendor";
import { TaskList } from "@/components/tasks";
import { Avatar, ButtonLink, Chip, Empty, PageHeader, Panel, StatusChip, toneFor } from "@/components/ui";
import { EMAIL_KIND_LABEL, fmtAge, fmtDuration, initials } from "@/components/format";

export const metadata: Metadata = { title: "Overview" };

function greeting() {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const ATTENTION_REASON: Record<string, string> = {
  correction_draft: "Correction email drafted. Review and send",
  link_ready: "Onboarding link created but not sent",
  link_expired: "Onboarding link expired. Send a new one",
  error: "Verification failed to run. Re-run it",
  ready: "Every check passed. Ready for sign-off",
  in_review: "Flagged findings need a decision",
  high_risk: "Hard-stop finding. Confirm rejection",
};

export default async function Dashboard() {
  const me = await requireStaff();
  const d = await getDashboard(me);
  const m = await getMission(d.vendors);
  const live = d.vendors.some((v) => v.stage.key === "verifying") || d.runs.some((r) => r.status === "running" || r.status === "queued");
  const median = d.medianHours == null ? null : d.medianHours < 1 ? `${Math.max(1, Math.round(d.medianHours * 60))}m` : d.medianHours < 48 ? `${d.medianHours.toFixed(1)}h` : `${Math.round(d.medianHours / 24)}d`;

  const stats = [
    { label: "Vendors", value: d.counts.total, href: "/vendors" },
    { label: "Not submitted", value: d.counts.notSubmitted, href: "/vendors?stage=early" },
    { label: "Waiting on vendor", value: d.counts.waitingVendor, href: "/vendors?stage=correction" },
    { label: "In review", value: d.counts.inReview, href: "/review", attention: d.counts.inReview > 0 },
    { label: "Approved", value: d.counts.approved, href: "/vendors?stage=approved" },
    { label: "Flags caught · 7d", value: m.flagsCaught, href: "/review", attention: false },
  ];

  return (
    <>
      <AutoRefresh active={live} />
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}
        title={`${greeting()}, ${me.name.split(" ")[0]}`}
        meta={live ? <Chip tone="live">Agent is verifying a submission</Chip> : <span>{d.attention.length ? `${d.attention.length} item${d.attention.length > 1 ? "s" : ""} need you` : "Nothing needs you right now"}</span>}
        actions={
          <>
            <ButtonLink href="/calls/new">Log a call</ButtonLink>
            <NewVendorButton myEmail={me.email} />
          </>
        }
      />

      <section aria-label="Totals" className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => {
          const body = (
            <>
              <div className="text-xs text-muted">{s.label}</div>
              <CountUp value={s.value} className={`mt-1 block text-[28px] leading-none ${s.attention ? "text-accent" : ""}`} />
            </>
          );
          const cls = "block bg-surface px-4 py-4";
          return s.href ? <Link key={s.label} href={s.href} className={`${cls} t-colors hover:bg-subtle`}>{body}</Link> : <div key={s.label} className={cls}>{body}</div>;
        })}
      </section>

      <Panel title="Live pipeline" meta={`${d.counts.total} vendors${median ? ` · median ${median} to approval` : ""}`} className="mb-6">
        <Pipeline stages={JOURNEY.map((label, i) => ({ label, vendors: d.vendors.filter((v) => v.stage.step === i).map((v) => ({ id: v.id, name: v.company_name, tone: v.stage.tone, status: v.stage.label })) }))} />
      </Panel>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title="Verification health" meta="Last 7 days">
          <HealthGauge value={m.health} runs={m.runs} />
        </Panel>
        <Panel title="Checks run" meta="Last 7 days">
          <CheckDonut checks={m.checks} />
        </Panel>
        <Panel title="What the agent caught" meta={`${m.flagsCaught} flag${m.flagsCaught === 1 ? "" : "s"}`} className="md:col-span-2 lg:col-span-1">
          <CaughtBars items={m.caught} />
        </Panel>
      </div>

      <Panel title="Flags caught this week" meta="Scored on catching problems, never on approvals" className="mb-6">
        <Scoreboard team={m.team} meId={me.id} />
      </Panel>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Needs your attention" meta={me.role === "sales" ? "Your vendors" : "Team-wide"}>
          {d.attention.length === 0 ? (
            <Empty title="You're all caught up">Vendors appear here when a link needs sending, a correction is drafted, or a decision is waiting.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {d.attention.map((v) => (
                <li key={v.id}>
                  <Link href={`/vendors/${v.id}`} className="t-colors flex items-center gap-3 px-4 py-3 hover:bg-subtle">
                    <Avatar text={initials(v.company_name)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{v.company_name}</span>
                      <span className="block truncate text-xs text-muted">{ATTENTION_REASON[v.stage.key] ?? v.stage.label}</span>
                    </span>
                    <Chip tone={v.stage.tone}>{v.stage.label}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Follow-ups" meta={d.tasks.length ? `${d.tasks.length} open` : undefined}>
          <TaskList showVendor tasks={d.tasks.map((t) => ({ ...t, vendor: t.vendor_id && t.vendors ? { id: t.vendor_id, name: t.vendors.company_name } : null }))} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Agent runs" meta="Every verification, stage by stage">
          {d.runs.length === 0 ? (
            <Empty title="No runs yet">A run starts the moment a vendor submits.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {d.runs.map((r) => {
                const stages = [...(r.run_stages ?? [])].sort((a, b) => a.position - b.position);
                return (
                  <li key={r.id}>
                    <Link href={`/runs/${r.id}`} className="t-colors grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-subtle sm:grid-cols-[1fr_auto_auto]">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{r.submissions.legal_name}</span>
                        <span className="mono text-xs text-muted">{r.submissions.ref} · v{r.version} · {r.trigger} · {fmtAge(r.created_at)}</span>
                      </span>
                      <span className="hidden gap-0.5 sm:flex" aria-label="Stage statuses">
                        {STAGES.map((s) => {
                          const st = stages.find((x) => x.key === s.key)?.status ?? "pending";
                          const color = { ok: "bg-ok", attention: "bg-accent", danger: "bg-danger", live: "bg-accent anim-pulse", neutral: "bg-line-strong" }[toneFor(st)];
                          return <span key={s.key} title={`${s.label}: ${st}`} className={`h-3.5 w-1.5 rounded-[2px] ${color}`} />;
                        })}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="mono hidden text-xs text-muted sm:inline">{fmtDuration(r.started_at, r.finished_at)}</span>
                        {r.status === "completed" ? <Chip tone={r.recommendation === "approve" ? "ok" : r.recommendation === "reject" ? "danger" : "attention"}>{r.recommendation === "approve" ? "All passed" : r.recommendation === "reject" ? "Hard stop" : "Flagged"}</Chip> : <StatusChip status={r.status} />}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Email activity" meta={<Link href="/emails" className="underline-offset-4 hover:underline">{d.failedEmails ? <span className="text-danger">{d.failedEmails} failed</span> : "All emails"}</Link>}>
            {d.emails.length === 0 ? (
              <Empty title="No emails yet" />
            ) : (
              <ul className="divide-y divide-line">
                {d.emails.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{EMAIL_KIND_LABEL[e.kind]} <span className="text-muted">→ {e.to_email}</span></span>
                      <span className="text-xs text-muted">{e.generated_by === "agent" ? "Agent-written · " : ""}{fmtAge(e.sent_at ?? e.created_at)}</span>
                    </span>
                    <StatusChip status={e.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Recent calls" meta={<Link href="/calls" className="underline-offset-4 hover:underline">All calls</Link>}>
            {d.calls.length === 0 ? (
              <Empty title="No calls logged" action={<ButtonLink href="/calls/new" size="sm">Log a call</ButtonLink>} />
            ) : (
              <ul className="divide-y divide-line">
                {d.calls.map((c) => (
                  <li key={c.id}>
                    <Link href={`/calls/${c.id}`} className="t-colors flex items-center gap-3 px-4 py-2.5 hover:bg-subtle">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{c.title}</span>
                        <span className="text-xs text-muted">{c.vendors?.company_name ?? "Not linked"} · {fmtAge(c.occurred_at)}</span>
                      </span>
                      {c.analysis ? <span className="mono text-sm">{c.analysis.intelligence.score}<span className="text-muted">/10</span></span> : <StatusChip status={c.status} />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
