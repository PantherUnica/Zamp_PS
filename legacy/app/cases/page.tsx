import Link from "next/link";
import type { Metadata } from "next";
import { listCases } from "@/lib/data";
import { Empty, PageHeader, Panel, RecChip, StatusChip } from "@/components/ui";
import { fmtDateTime } from "@/components/format";

export const metadata: Metadata = { title: "Cases" };

const TABS = [
  { key: "all", label: "All" },
  { key: "awaiting_review", label: "Awaiting review" },
  { key: "awaiting_vendor", label: "Awaiting vendor" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "error", label: "Errors" },
];

export default async function Cases({ searchParams }: PageProps<"/cases">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "all";
  const rows = await listCases(status);
  return (
    <>
      <PageHeader eyebrow="History" title="Cases" meta="Every vendor submission and where it stands" />
      <nav className="mb-4 flex gap-1 overflow-x-auto" aria-label="Filter by status">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/cases" : `/cases?status=${t.key}`}
            aria-current={status === t.key ? "page" : undefined}
            className={`t-colors whitespace-nowrap rounded-md px-3 py-1 text-sm ${status === t.key ? "bg-ink font-medium text-white" : "text-ink-2 hover:bg-neutral-soft"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Panel>
        {rows.length === 0 ? (
          <Empty title="No cases here">Cases appear as soon as a vendor submits.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2 font-normal">Ref</th>
                  <th className="px-4 py-2 font-normal">Vendor</th>
                  <th className="px-4 py-2 font-normal">Country</th>
                  <th className="px-4 py-2 font-normal">Recommendation</th>
                  <th className="px-4 py-2 font-normal">Status</th>
                  <th className="px-4 py-2 text-right font-normal">Version</th>
                  <th className="px-4 py-2 text-right font-normal">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((s) => (
                  <tr key={s.id} className="t-colors hover:bg-canvas">
                    <td className="mono px-4 py-3"><Link href={`/cases/${s.id}`} className="underline-offset-4 hover:underline">{s.ref}</Link></td>
                    <td className="px-4 py-3"><Link href={`/cases/${s.id}`} className="font-medium">{s.legal_name}</Link></td>
                    <td className="px-4 py-3 text-ink-2">{s.country}</td>
                    <td className="px-4 py-3"><RecChip rec={s.recommendation} /></td>
                    <td className="px-4 py-3"><StatusChip status={s.status} /></td>
                    <td className="mono px-4 py-3 text-right text-ink-2">{s.current_version}</td>
                    <td className="mono px-4 py-3 text-right text-muted">{fmtDateTime(s.updated_at)}</td>
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
