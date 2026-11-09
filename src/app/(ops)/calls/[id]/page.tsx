import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { getCall } from "@/lib/data";
import { AnalysisWaiter, ApplyPanel } from "@/components/call-forms";
import { CallIntelligence } from "@/components/call-intelligence";
import { ButtonLink, Panel, PageHeader, StatusChip } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/components/format";

export const metadata: Metadata = { title: "Call" };

export default async function CallPage({ params }: PageProps<"/calls/[id]">) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const call = await getCall(id);
  if (!call) notFound();
  const { data: vendors } = await admin().from("vendors").select("id, company_name").order("company_name");
  const a = call.analysis;
  return (
    <>
      <div className="mb-2 text-sm"><Link href="/calls" className="text-muted underline-offset-4 hover:text-ink hover:underline">Calls</Link></div>
      <PageHeader
        title={call.title}
        meta={
          <>
            <StatusChip status={call.status} />
            <span>{fmtDateTime(call.occurred_at)}</span>
            {call.duration_minutes ? <span>{call.duration_minutes} min</span> : null}
            {call.source_file && <span className="mono">{call.source_file}</span>}
            {call.vendors && <Link href={`/vendors/${call.vendors.id}`} className="underline-offset-4 hover:underline">{call.vendors.company_name}</Link>}
          </>
        }
        actions={call.vendors && <ButtonLink href={`/vendors/${call.vendors.id}`}>Open vendor</ButtonLink>}
      />
      {!a ? (
        <Panel><AnalysisWaiter callId={call.id} status={call.status} error={call.error} /></Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <Panel title="Summary"><p className="px-4 py-4 text-sm text-ink-2">{a.summary}</p></Panel>
            <Panel title="Call intelligence"><CallIntelligence a={a} /></Panel>
            <div className="grid gap-6 md:grid-cols-2">
              <Panel title="Requirements">
                {a.requirements.length ? <ul className="list-disc space-y-1.5 py-4 pr-4 pl-8 text-sm">{a.requirements.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="px-4 py-4 text-sm text-muted">None stated.</p>}
              </Panel>
              <Panel title="Action items" meta={call.vendor_id ? "Added to follow-ups" : "Added when applied"}>
                {a.action_items.length ? (
                  <ul className="divide-y divide-line">
                    {a.action_items.map((t, n) => (
                      <li key={n} className="px-4 py-2.5 text-sm">
                        {t.task}
                        <span className="block text-xs text-muted">{t.owner === "vendor" ? "Vendor" : "Us"}{t.due ? ` · due ${fmtDate(t.due)}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="px-4 py-4 text-sm text-muted">None.</p>}
              </Panel>
            </div>
            <Panel title="Transcript">
              <details>
                <summary className="px-4 py-3 text-sm text-ink-2">Show full transcript ({call.transcript.length.toLocaleString()} characters)</summary>
                <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap border-t border-line px-4 py-3 font-sans text-sm leading-6 text-ink-2">{call.transcript}</pre>
              </details>
            </Panel>
          </div>
          <aside className="lg:sticky lg:top-8">
            <Panel title="Extracted vendor details" meta={call.applied_at ? `Applied ${fmtDate(call.applied_at)}` : undefined}>
              <ApplyPanel callId={call.id} analysis={a} vendors={vendors ?? []} linkedVendor={call.vendor_id} appliedAt={call.applied_at} />
            </Panel>
          </aside>
        </div>
      )}
    </>
  );
}
