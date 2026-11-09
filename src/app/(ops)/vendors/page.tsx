import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { listVendors } from "@/lib/data";
import { STAGE_FILTERS } from "@/lib/vendor-stage";
import { NewVendorButton } from "@/components/new-vendor";
import { Avatar, Chip, Empty, PageHeader, Panel } from "@/components/ui";
import { fmtAge, initials } from "@/components/format";

export const metadata: Metadata = { title: "Vendors" };

export default async function Vendors({ searchParams }: PageProps<"/vendors">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const stage = typeof sp.stage === "string" ? sp.stage : "all";
  const owner = typeof sp.owner === "string" ? sp.owner : me.role === "sales" ? "me" : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const all = await listVendors();
  const filter = STAGE_FILTERS.find((f) => f.key === stage);
  const rows = all
    .filter((v) => owner !== "me" || v.owner_id === me.id)
    .filter((v) => !filter || !("match" in filter) || (filter.match as readonly string[]).includes(v.stage.key))
    .filter((v) => !q || [v.company_name, v.contact_name, v.contact_email, v.ref, v.city].some((x) => x?.toLowerCase().includes(q)));
  const href = (p: Record<string, string>) => {
    const s = new URLSearchParams({ ...(stage !== "all" ? { stage } : {}), ...(owner !== (me.role === "sales" ? "me" : "all") ? { owner } : {}), ...(q ? { q } : {}), ...p });
    for (const [k, v] of [...s.entries()]) if (v === "all" && k === "stage") s.delete(k);
    return `/vendors${s.toString() ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Vendors" meta={`${rows.length} of ${all.length}`} actions={<NewVendorButton myEmail={me.email} />} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Filter by stage">
          {STAGE_FILTERS.map((f) => (
            <Link key={f.key} href={href({ stage: f.key })} aria-current={stage === f.key ? "page" : undefined} className={`t-colors whitespace-nowrap rounded-md px-3 py-1 text-sm ${stage === f.key ? "bg-ink font-medium text-white" : "text-ink-2 hover:bg-accent-soft/70"}`}>
              {f.label}
            </Link>
          ))}
        </nav>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-line-strong p-0.5 text-sm">
            {[["me", "Mine"], ["all", "Everyone's"]].map(([k, l]) => (
              <Link key={k} href={href({ owner: k })} className={`rounded-[5px] px-3 py-1 ${owner === k ? "bg-subtle font-medium" : "text-ink-2"}`}>{l}</Link>
            ))}
          </div>
          <form action="/vendors" className="flex-1 lg:w-[240px]">
            {stage !== "all" && <input type="hidden" name="stage" value={stage} />}
            <input type="hidden" name="owner" value={owner} />
            <input name="q" defaultValue={q} placeholder="Search name, email, ref…" aria-label="Search vendors" className="h-8 w-full rounded-md border border-line-strong bg-surface px-3 text-sm placeholder:text-muted" />
          </form>
        </div>
      </div>
      <Panel>
        {rows.length === 0 ? (
          <Empty title={all.length ? "No vendors match" : "No vendors yet"} action={!all.length && <NewVendorButton myEmail={me.email} label="Add your first vendor" />}>
            {all.length ? "Try another filter." : "Add a vendor to send their personal onboarding link."}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2 font-normal">Vendor</th>
                  <th className="px-4 py-2 font-normal">Stage</th>
                  <th className="px-4 py-2 font-normal">Contact</th>
                  <th className="px-4 py-2 font-normal">Owner</th>
                  <th className="px-4 py-2 text-right font-normal">Call score</th>
                  <th className="px-4 py-2 text-right font-normal">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((v) => (
                  <tr key={v.id} className="t-colors group hover:bg-accent-soft/70">
                    <td className="px-4 py-2.5">
                      <Link href={`/vendors/${v.id}`} className="flex items-center gap-3">
                        <Avatar text={initials(v.company_name)} size={28} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium group-hover:underline group-hover:underline-offset-4">{v.company_name}</span>
                          <span className="mono text-xs text-muted">{v.ref}{v.city ? ` · ${v.city}` : ""}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5"><Chip tone={v.stage.tone}>{v.stage.label}</Chip></td>
                    <td className="max-w-[220px] px-4 py-2.5">
                      <div className="truncate">{v.contact_name ?? <span className="text-muted">-</span>}</div>
                      <div className="truncate text-xs text-muted">{v.contact_email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{v.owner_id === me.id ? "You" : v.owner?.full_name ?? "-"}</td>
                    <td className="mono px-4 py-2.5 text-right">{v.latestScore ? <>{v.latestScore}<span className="text-muted">/10</span></> : <span className="text-muted">-</span>}</td>
                    <td className="mono px-4 py-2.5 text-right text-xs text-muted">{fmtAge(v.submission?.updated_at && v.submission.updated_at > v.updated_at ? v.submission.updated_at : v.updated_at)}</td>
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
