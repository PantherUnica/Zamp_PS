import type { Check, Extraction, Finding, RunResult, Slot, SubmissionData } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { DOCS } from "@/lib/india";
import { Alert, Check as CheckIcon, Cross, Minus } from "./icons";
import { Chip, SourceTag } from "./ui";
import { REC_LABEL, pct } from "./format";

const SEV_ORDER = ["block", "review", "fixable", "info"] as const;
export const SEV = {
  block: { label: "Hard stop", tone: "danger" as const },
  review: { label: "Needs judgment", tone: "attention" as const },
  fixable: { label: "Vendor can fix", tone: "attention" as const },
  info: { label: "Note", tone: "neutral" as const },
};

function StatusIcon({ status }: { status: Check["status"] }) {
  if (status === "pass") return <CheckIcon className="size-3.5 text-ok" />;
  if (status === "fail") return <Cross className="size-3.5 text-danger" />;
  if (status === "warn") return <Alert className="size-3.5 text-accent" />;
  return <Minus className="size-3.5 text-muted" />;
}

export function Findings({ findings }: { findings: Finding[] }) {
  const sorted = [...findings].sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));
  return (
    <ul className="divide-y divide-line">
      {sorted.map((f, i) => (
        <li key={f.code + i} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={SEV[f.severity].tone}>{SEV[f.severity].label}</Chip>
            <span className="font-medium">{f.title}</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">{f.detail}</p>
          {f.evidence && f.evidence.length > 0 && (
            <dl className="mt-2 grid gap-x-4 gap-y-0.5 rounded-md bg-subtle px-3 py-2 sm:grid-cols-[auto_1fr]">
              {f.evidence.map((e) => (
                <div key={e.label} className="contents">
                  <dt className="text-xs text-muted">{e.label}</dt>
                  <dd className="mono break-all text-xs">{e.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mono mt-1.5 text-[11px] text-muted">{f.code}</div>
        </li>
      ))}
    </ul>
  );
}

/** Form value vs what the AI read from each document, with the rule's verdict. */
export function Comparison({ data, result }: { data: SubmissionData; result: RunResult }) {
  const ex = (slot: Slot) => result.extractions.find((e) => e.slot === slot && !e.error);
  const check = (...ids: string[]) => ids.map((id) => result.checks.find((c) => c.id === id)).find(Boolean);
  const v = (e: Extraction | undefined, f: keyof Extraction["fields"]) => (e?.fields[f]?.value ? { value: e.fields[f].value!, conf: e.fields[f].confidence } : null);
  const rows: { field: string; form: string; docs: { source: string; value: string; conf: number }[]; check?: Check }[] = [
    { field: "Legal name", form: data.legal_name, docs: (["gst_certificate", "pan_card", "incorporation_certificate"] as Slot[]).flatMap((s) => { const x = v(ex(s), "legal_name"); return x ? [{ source: DOCS[s].label, ...x }] : []; }), check: check("name_gst_certificate", "name_pan_card", "name_incorporation_certificate") },
    { field: "GSTIN", form: data.gstin, docs: v(ex("gst_certificate"), "gstin") ? [{ source: "GST certificate", ...v(ex("gst_certificate"), "gstin")! }] : [], check: check("gstin_vs_cert") },
    { field: "PAN", form: data.pan, docs: v(ex("pan_card"), "pan") ? [{ source: "PAN card", ...v(ex("pan_card"), "pan")! }] : [], check: check("pan_vs_card") },
    { field: "Account holder", form: data.bank.account_holder, docs: v(ex("bank_proof"), "account_holder") ? [{ source: "Cheque / bank letter", ...v(ex("bank_proof"), "account_holder")! }] : [], check: check("bank_holder_doc", "bank_holder_form") },
    { field: "Account number", form: data.bank.account_number, docs: v(ex("bank_proof"), "account_number") ? [{ source: "Cheque / bank letter", ...v(ex("bank_proof"), "account_number")! }] : [], check: check("acct_vs_doc") },
    { field: "IFSC", form: data.bank.ifsc, docs: v(ex("bank_proof"), "ifsc") ? [{ source: "Cheque / bank letter", ...v(ex("bank_proof"), "ifsc")! }] : [], check: check("ifsc_vs_doc") },
  ];
  // A failing name check anywhere should show as a mismatch on the row.
  const nameFail = result.checks.find((c) => c.id.startsWith("name_") && c.status === "fail");
  if (nameFail) rows[0].check = nameFail;
  const holderFail = result.checks.find((c) => c.id.startsWith("bank_holder") && c.status === "fail");
  if (holderFail) rows[3].check = holderFail;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-4 py-2 font-normal">Field</th>
            <th className="px-4 py-2 font-normal">Vendor entered</th>
            <th className="px-4 py-2 font-normal">Documents say</th>
            <th className="px-4 py-2 font-normal">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.field} className="align-top">
              <td className="px-4 py-3 text-muted">{r.field}</td>
              <td className="mono break-all px-4 py-3 text-xs">{r.form || "-"}</td>
              <td className="px-4 py-3">
                {r.docs.length === 0 ? <span className="text-xs text-muted">Not read</span> : r.docs.map((d) => (
                  <div key={d.source} className="mb-1 last:mb-0">
                    <span className="mono break-all text-xs">{d.value}</span>
                    <span className="ml-2 text-[11px] text-muted">{d.source} · {pct(d.conf)}</span>
                  </div>
                ))}
              </td>
              <td className="px-4 py-3">
                {r.check ? (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.check.status === "pass" ? "text-ok" : "text-danger"}`}>
                    <StatusIcon status={r.check.status} /> {r.check.status === "pass" ? "Match" : "Mismatch"}
                  </span>
                ) : <span className="text-xs text-muted">-</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChecksBySource({ checks }: { checks: Check[] }) {
  return (
    <div className="divide-y divide-line">
      {STAGES.filter((s) => checks.some((c) => c.stage === s.key) && s.key !== "decide" && s.key !== "communicate").map((s) => {
        const list = checks.filter((c) => c.stage === s.key);
        const counted = list.filter((c) => c.status !== "skip");
        const failed = counted.filter((c) => c.status !== "pass").length;
        return (
          <details key={s.key} open={failed > 0 || s.key === "external"}>
            <summary className="t-colors flex items-center justify-between gap-3 px-4 py-3 hover:bg-subtle">
              <span className="font-medium">{s.label}</span>
              <span className="mono text-xs text-muted">{counted.length - failed}/{counted.length} passed{list.length > counted.length ? ` · ${list.length - counted.length} not connected` : ""}</span>
            </summary>
            <ul className="px-4 pb-3">
              {list.map((c) => (
                <li key={c.id} className="flex gap-3 py-1.5 text-sm">
                  <span className="mt-[3px]"><StatusIcon status={c.status} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{c.label}</span> <span className="text-ink-2">{c.detail}</span>
                  </span>
                  <SourceTag source={c.status === "skip" && c.source === "external" && c.id.startsWith("registry") ? "not_connected" : c.source} />
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

export function RecommendationLine({ result }: { result: RunResult }) {
  const cls = result.recommendation === "approve" ? "text-ink" : result.recommendation === "reject" ? "text-danger" : "text-accent";
  return (
    <div>
      <div className={`text-md font-semibold ${cls}`}>{REC_LABEL[result.recommendation]}</div>
      <p className="mt-1 text-sm text-ink-2">{result.summary}</p>
    </div>
  );
}
