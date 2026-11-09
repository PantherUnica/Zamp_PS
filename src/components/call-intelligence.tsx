import type { CallAnalysis } from "@/lib/types";
import { Alert } from "./icons";
import { Chip } from "./ui";

const SIGNAL = {
  strong: { label: "Strong", tone: "ok" as const, bar: "bg-ok" },
  moderate: { label: "Moderate", tone: "neutral" as const, bar: "bg-ink" },
  nurture: { label: "Nurture", tone: "attention" as const, bar: "bg-accent" },
  weak: { label: "Weak", tone: "danger" as const, bar: "bg-danger" },
};
const READINESS = { exploring: "Exploring", evaluating: "Evaluating", ready_to_onboard: "Ready to onboard", blocked: "Blocked" };

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-6 items-center rounded-full border border-line-strong px-2.5 text-xs text-ink-2">{children}</span>;
}

/** The call-intelligence card: score, signal, profile, objections, verbatim concern, coaching, next step. */
export function CallIntelligence({ a, compact }: { a: CallAnalysis; compact?: boolean }) {
  const i = a.intelligence;
  const s = SIGNAL[i.signal];
  return (
    <div className="divide-y divide-line">
      <div className="flex items-center gap-5 px-4 py-4">
        <div className="shrink-0">
          <div className="mono text-[32px] leading-none">{i.score}<span className="text-md text-muted">/10</span></div>
          <div className="mt-1 text-xs text-muted">Vendor score</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs text-muted">Signal strength</span>
            <Chip tone={s.tone}>{s.label}</Chip>
          </div>
          <div className="h-1.5 rounded-full bg-subtle"><div className={`h-1.5 rounded-full ${s.bar}`} style={{ width: `${i.score * 10}%` }} /></div>
          <p className="mt-1.5 text-xs text-ink-2">{i.signal_reason}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 text-sm">
        <div><dt className="text-xs text-muted">Interest</dt><dd className="mt-1"><Pill>{i.interest_level[0].toUpperCase() + i.interest_level.slice(1)}</Pill></dd></div>
        <div><dt className="text-xs text-muted">Sentiment</dt><dd className="mt-1"><Pill>{i.sentiment[0].toUpperCase() + i.sentiment.slice(1)}</Pill></dd></div>
        <div><dt className="text-xs text-muted">Onboarding readiness</dt><dd className="mt-1"><Pill>{READINESS[i.readiness]}</Pill></dd></div>
        <div><dt className="text-xs text-muted">Supplies</dt><dd className="mt-1">{a.vendor.supplies.value ?? <span className="text-muted">-</span>}</dd></div>
      </dl>

      {(i.objections.length > 0 || i.key_concern_quote) && (
        <div className="px-4 py-4">
          <div className="text-xs font-medium text-muted">Objections</div>
          {i.objections.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {i.objections.map((o) => <span key={o} className="inline-flex h-6 items-center rounded-full bg-accent-soft px-2.5 text-xs text-accent">{o}</span>)}
            </div>
          )}
          {i.objection_category && <p className="mt-3 text-sm font-medium">{i.objection_category}</p>}
          {i.key_concern_quote && <blockquote className="mt-2 border-l-2 border-accent-line pl-3 text-sm italic text-ink-2">“{i.key_concern_quote}”</blockquote>}
        </div>
      )}

      {a.risk_signals.length > 0 && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-danger"><Alert className="size-3.5" /> Check before paying</div>
          <ul className="mt-2 space-y-2">
            {a.risk_signals.map((r, n) => (
              <li key={n} className="text-sm">{r.signal}{r.quote && <span className="block text-xs italic text-muted">“{r.quote}”</span>}</li>
            ))}
          </ul>
        </div>
      )}

      {!compact && (
        <div className="px-4 py-4">
          <div className="text-xs font-medium text-muted">Rep coaching</div>
          <p className="mt-2 border-l-2 border-ink pl-3 text-sm text-ink-2">{i.rep_insight}</p>
        </div>
      )}

      <div className="grid gap-4 px-4 py-4 text-sm sm:grid-cols-[1.5fr_1fr]">
        <div><div className="text-xs text-muted">Next step</div><p className="mt-1 font-medium">{i.next_step}</p></div>
        <div><div className="text-xs text-muted">Follow-up</div><p className="mt-1 font-medium">{a.follow_up.timeline ?? a.follow_up.date ?? "Not agreed"}</p></div>
      </div>
    </div>
  );
}
