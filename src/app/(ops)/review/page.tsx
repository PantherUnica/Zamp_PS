import Link from "next/link";
import type { Metadata } from "next";
import { canDecide, requireStaff } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import type { RunResult } from "@/lib/types";
import { Avatar, Chip, Empty, PageHeader, Panel } from "@/components/ui";
import { fmtAge, initials } from "@/components/format";

export const metadata: Metadata = { title: "Review queue" };

const GROUPS = [
  { key: "reject", title: "Recommended reject", hint: "A hard-stop rule fired. Confirm or override.", tone: "danger" as const },
  { key: "pending", title: "Needs judgment", hint: "Flags that a rule cannot settle on its own.", tone: "attention" as const },
  { key: "approve", title: "Ready for approval", hint: "Every automated check passed. Your sign-off completes verification.", tone: "ok" as const },
];

export default async function Review() {
  const me = await requireStaff();
  const db = admin();
  const { data: subs } = await db
    .from("submissions")
    .select("id, ref, recommendation, updated_at, submitted_at, vendor_id, vendors!inner(id, company_name, owner_id, owner:profiles!vendors_owner_id_fkey(full_name))")
    .eq("status", "awaiting_review")
    .order("updated_at", { ascending: true });
  const ids = (subs ?? []).map((s) => s.id);
  const { data: runs } = ids.length
    ? await db.from("runs").select("submission_id, result, created_at").in("submission_id", ids).eq("status", "completed").order("created_at", { ascending: false })
    : { data: [] };
  const latest = new Map<string, RunResult>();
  for (const r of runs ?? []) if (!latest.has(r.submission_id)) latest.set(r.submission_id, r.result as RunResult);
  const rows = (subs ?? []).map((s) => {
    const vendor = s.vendors as unknown as { id: string; company_name: string; owner_id: string | null; owner: { full_name: string | null } | null };
    const result = latest.get(s.id);
    const f = result?.findings ?? [];
    return { ...s, vendor, result, counts: { block: f.filter((x) => x.severity === "block").length, review: f.filter((x) => x.severity === "review").length, fixable: f.filter((x) => x.severity === "fixable").length } };
  });

  return (
    <>
      <PageHeader
        eyebrow="Reviewer workspace"
        title="Review queue"
        meta={<span>{rows.length} vendor{rows.length === 1 ? "" : "s"} waiting · oldest first{!canDecide(me) ? " · read-only for salespeople" : ""}</span>}
      />
      {rows.length === 0 ? (
        <Panel><Empty title="The queue is empty">Vendors arrive here after the agent verifies their submission.</Empty></Panel>
      ) : (
        <div className="flex flex-col gap-6">
          {GROUPS.map((g) => {
            const list = rows.filter((r) => (r.recommendation ?? "pending") === g.key);
            if (!list.length) return null;
            return (
              <Panel key={g.key} title={<span className="flex items-center gap-2"><Chip tone={g.tone}>{list.length}</Chip>{g.title}</span>} meta={<span className="hidden sm:inline">{g.hint}</span>}>
                <ul className="divide-y divide-line">
                  {list.map((r) => (
                    <li key={r.id}>
                      <Link href={`/vendors/${r.vendor.id}`} className="t-colors grid gap-3 px-4 py-3 hover:bg-accent-soft/70 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] sm:items-center">
                        <span className="flex min-w-0 items-center gap-3">
                          <Avatar text={initials(r.vendor.company_name)} size={28} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{r.vendor.company_name}</span>
                            <span className="mono text-xs text-muted">{r.ref} · {r.vendor.owner_id === me.id ? "your vendor" : r.vendor.owner?.full_name ?? "unassigned"}</span>
                          </span>
                        </span>
                        <span className="min-w-0 text-sm text-ink-2">
                          {r.result?.findings.filter((f) => f.severity !== "info").slice(0, 2).map((f) => <span key={f.code} className="block truncate">{f.title}</span>) ?? null}
                          {r.result && r.result.findings.filter((f) => f.severity !== "info").length === 0 && <span className="text-muted">No flags · {r.result.checks.filter((c) => c.status === "pass").length} checks passed</span>}
                        </span>
                        <span className="flex items-center gap-3 text-xs text-muted sm:justify-end">
                          {r.counts.block > 0 && <span className="text-danger">{r.counts.block} hard stop</span>}
                          {r.counts.review > 0 && <span className="text-accent">{r.counts.review} judgment</span>}
                          {r.counts.fixable > 0 && <span>{r.counts.fixable} fixable</span>}
                          <span className="mono">waiting {fmtAge(r.updated_at).replace(" ago", "")}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
