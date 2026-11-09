import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { listCalls } from "@/lib/data";
import { ButtonLink, Chip, Empty, PageHeader, Panel, StatusChip } from "@/components/ui";
import { fmtDateTime } from "@/components/format";

export const metadata: Metadata = { title: "Calls" };

const SIGNAL_TONE = { strong: "ok", moderate: "neutral", nurture: "attention", weak: "danger" } as const;

export default async function Calls() {
  await requireStaff();
  const calls = await listCalls();
  return (
    <>
      <PageHeader title="Calls" meta="Transcripts analysed by the agent" actions={<ButtonLink href="/calls/new" variant="primary">Log a call</ButtonLink>} />
      <Panel>
        {calls.length === 0 ? (
          <Empty title="No calls yet" action={<ButtonLink href="/calls/new">Log your first call</ButtonLink>}>Upload a Zoom, Meet or Teams transcript, or paste notes. The agent pulls out vendor details and follow-ups.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2 font-normal">Call</th>
                  <th className="px-4 py-2 font-normal">Vendor</th>
                  <th className="px-4 py-2 font-normal">Signal</th>
                  <th className="px-4 py-2 font-normal">Next step</th>
                  <th className="px-4 py-2 text-right font-normal">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {calls.map((c) => (
                  <tr key={c.id} className="t-colors hover:bg-subtle">
                    <td className="px-4 py-2.5">
                      <Link href={`/calls/${c.id}`} className="font-medium underline-offset-4 hover:underline">{c.title}</Link>
                      <div className="text-xs text-muted">{c.logger?.full_name ?? c.logger?.email}{c.duration_minutes ? ` · ${c.duration_minutes} min` : ""}</div>
                    </td>
                    <td className="px-4 py-2.5">{c.vendors ? <Link href={`/vendors/${c.vendor_id}`} className="underline-offset-4 hover:underline">{c.vendors.company_name}</Link> : <span className="text-muted">Not linked</span>}</td>
                    <td className="px-4 py-2.5">
                      {c.analysis ? (
                        <span className="flex items-center gap-2">
                          <span className="mono">{c.analysis.intelligence.score}/10</span>
                          <Chip tone={SIGNAL_TONE[c.analysis.intelligence.signal]}>{c.analysis.intelligence.signal}</Chip>
                          {c.analysis.risk_signals.length > 0 && <Chip tone="danger">{c.analysis.risk_signals.length} risk</Chip>}
                        </span>
                      ) : <StatusChip status={c.status} />}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-ink-2">{c.analysis?.intelligence.next_step ?? "-"}</td>
                    <td className="mono px-4 py-2.5 text-right text-xs text-muted">{fmtDateTime(c.occurred_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
