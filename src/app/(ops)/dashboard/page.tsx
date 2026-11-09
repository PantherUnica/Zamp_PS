import Link from "next/link";
import type { Metadata } from "next";
import { getDashboard } from "@/lib/data";
import { STAGES } from "@/lib/types";
import { AutoRefresh } from "@/components/auto-refresh";
import { ButtonLink, Chip, Empty, PageHeader, Panel, RecChip, StatusChip, toneFor } from "@/components/ui";
import { fmtAge, fmtDateTime, fmtDuration, shortId } from "@/components/format";

export const metadata: Metadata = { title: "Overview" };

export default async function Dashboard() {
  const d = await getDashboard();
  const live = d.counts.processing > 0 || d.runs.some((r) => r.status === "running" || r.status === "queued");

  const metrics = [
    { label: "Total submissions", value: d.counts.total, href: "/cases" },
    { label: "Pending", value: d.counts.pending, sub: `${d.counts.awaiting_review} review · ${d.counts.awaiting_vendor} vendor`, href: "/cases?status=pending" },
    { label: "Approved", value: d.counts.approved, href: "/cases?status=approved" },
    { label: "Rejected", value: d.counts.rejected, href: "/cases?status=rejected" },
    {
      label: "Median time to decision",
      value: d.medianHoursToDecision == null ? "-" : d.medianHoursToDecision < 1 ? `${Math.round(d.medianHoursToDecision * 60)}m` : `${d.medianHoursToDecision.toFixed(1)}h`,
      sub: "submission → human decision",
    },
  ];

  return (
    <>
      <AutoRefresh active={live} />
      <PageHeader
        eyebrow="Operations"
        title="Vendor onboarding"
        meta={
          live ? (
            <Chip tone="live">{d.counts.processing} processing now</Chip>
          ) : (
            <span>All runs idle</span>
          )
        }
        actions={<ButtonLink href="/onboard" variant="primary">New submission</ButtonLink>}
      />

      <section aria-label="Totals" className="mb-8 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-5">
        {metrics.map((m, i) => {
          const body = (
            <>
              <div className="text-xs text-muted">{m.label}</div>
              <div className="mono mt-1 text-xl font-medium">{m.value}</div>
              {m.sub && <div className="mt-1 text-xs text-muted">{m.sub}</div>}
            </>
          );
          const cls = `block px-4 py-4 ${i > 0 ? "md:border-l" : ""} ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t md:border-t-0" : ""} border-line`;
          return m.href ? (
            <Link key={m.label} href={m.href} className={`${cls} t-colors hover:bg-canvas`}>{body}</Link>
          ) : (
            <div key={m.label} className={cls}>{body}</div>
          );
        })}
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Review queue" meta={`${d.queue.length} waiting for a human decision`}>
          {d.queue.length === 0 ? (
            <Empty title="Nothing to review">Cases land here when the rules recommend a decision or need judgment.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {d.queue.map((s) => (
                <li key={s.id}>
                  <Link href={`/cases/${s.id}`} className="t-colors grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-canvas sm:grid-cols-[88px_1fr_auto_72px]">
                    <span className="mono hidden text-sm text-muted sm:block">{s.ref}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.legal_name}</span>
                      <span className="text-xs text-muted sm:hidden">{s.ref} · {s.country}</span>
                      <span className="hidden text-xs text-muted sm:block">{s.country} · version {s.current_version}</span>
                    </span>
                    <span className="flex justify-end">{s.status === "error" ? <StatusChip status="error" /> : <RecChip rec={s.recommendation} />}</span>
                    <span className="mono hidden text-right text-sm text-muted sm:block">{fmtAge(s.updated_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Waiting on vendor" meta={d.waiting.length || undefined}>
          {d.waiting.length === 0 ? (
            <Empty title="No open requests">Vendors asked to fix something appear here with how long they have been waiting.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {d.waiting.map((s) => (
                <li key={s.id}>
                  <Link href={`/cases/${s.id}`} className="t-colors flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas">
                    <span className="min-w-0">
                      <span className="block truncate">{s.legal_name}</span>
                      <span className="mono text-xs text-muted">{s.ref}</span>
                    </span>
                    <span className="mono text-sm text-muted">{fmtAge(s.updated_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent processing runs" meta="Every run, stage by stage">
        {d.runs.length === 0 ? (
          <Empty title="No runs yet">Submit a vendor to start the first run.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2 font-normal">Run</th>
                  <th className="px-4 py-2 font-normal">Vendor</th>
                  <th className="px-4 py-2 font-normal">Trigger</th>
                  <th className="px-4 py-2 font-normal">Stages</th>
                  <th className="px-4 py-2 font-normal">Outcome</th>
                  <th className="px-4 py-2 text-right font-normal">Duration</th>
                  <th className="px-4 py-2 text-right font-normal">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.runs.map((r) => {
                  const stages = [...(r.run_stages ?? [])].sort((a, b) => a.position - b.position);
                  return (
                    <tr key={r.id} className="t-colors hover:bg-canvas">
                      <td className="px-4 py-3">
                        <Link href={`/runs/${r.id}`} className="mono text-ink underline-offset-4 hover:underline">{shortId(r.id)}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[220px] truncate">{r.submissions?.legal_name}</div>
                        <div className="mono text-xs text-muted">{r.submissions?.ref} · v{r.version}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-ink-2">{r.trigger}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1" aria-label="Stage statuses">
                          {STAGES.map((s) => {
                            const st = stages.find((x) => x.key === s.key)?.status ?? "pending";
                            const tone = toneFor(st);
                            const color = { accent: "bg-accent", warn: "bg-warn", danger: "bg-danger", live: "bg-ink anim-pulse", neutral: "bg-line-strong" }[tone];
                            return <span key={s.key} title={`${s.label}: ${st}`} className={`h-3 w-2 rounded-[2px] ${color}`} />;
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "completed" ? <RecChip rec={r.recommendation} /> : <StatusChip status={r.status} />}
                        {r.error && <div className="mt-1 max-w-[240px] truncate text-xs text-danger" title={r.error}>{r.error}</div>}
                      </td>
                      <td className="mono px-4 py-3 text-right text-ink-2">{fmtDuration(r.started_at, r.finished_at)}</td>
                      <td className="mono px-4 py-3 text-right text-muted">{fmtDateTime(r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
