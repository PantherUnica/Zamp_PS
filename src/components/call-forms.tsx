"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CallAnalysis } from "@/lib/types";
import { validateGstin, validatePan } from "@/lib/rules/validators";
import { Check, Spark, Upload } from "./icons";
import { Button, inputClass } from "./ui";

export const DEMO_TRANSCRIPT = `Rahul (Procurement): Hi Meera, thanks for taking the time. As I mentioned, we're consolidating our packaging suppliers for the Ahmedabad plant.
Meera Shah (Brightline Packaging): Sure. We're Brightline Packaging LLP, we do corrugated boxes and protective packaging. About 40 people, plant in Changodar.
Rahul: Great. Volumes would be roughly 20,000 cartons a month to start. Can you do 45-day payment terms?
Meera: 45 days is tough for us. We usually work on 30. Our raw material suppliers want cash.
Rahul: Understood, I'll check with finance whether 30 is possible for the first quarter.
Meera: That would help. Also, honestly, last time we onboarded with a big company it took two months and three rounds of paperwork. Why should this be any different?
Rahul: Fair question. It's a single online form, you can save and come back, and we verify most things automatically. I'll send you the link today.
Meera: Okay. Our GSTIN is 24AAFFB2345K1ZN, PAN AAFFB2345K. My email is meera@brightline.example, phone 99090 23456.
Rahul: Perfect. And bank details?
Meera: For payments, please use our sister concern's account, Brightline Logistics. All our collections go there, it's simpler for our accounts team. I'll send that cheque.
Rahul: Noted. Our team may need to check that, since the account should normally be in the LLP's name.
Meera: It's the same family business, it's fine. Can we get a trial order before month end?
Rahul: Let's target a trial PO by the 28th if onboarding is done. I'll also send you our packaging spec sheet.
Meera: Great, I'll send samples by next week.`;

export function CallUploader({ vendors, defaultVendor }: { vendors: { id: string; company_name: string }[]; defaultVendor?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: "", channel: "call", occurred_at: new Date().toISOString().slice(0, 16), duration_minutes: "", vendor_id: defaultVendor ?? "", notes: "", transcript: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) if (v && !(k === "transcript" && mode === "file")) fd.set(k, v);
    if (mode === "file" && file) fd.set("file", file);
    const res = await fetch("/api/calls", { method: "POST", body: fd });
    const body = await res.json();
    if (!res.ok) {
      setError(body.details?.[0]?.message ?? body.error ?? "Could not log the call");
      setBusy(false);
      return;
    }
    router.push(`/calls/${body.id}`);
  }

  const canSubmit = form.title.trim().length >= 2 && (mode === "paste" ? form.transcript.trim().length >= 40 : !!file);

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-[10px] border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div role="tablist" className="flex rounded-md border border-line-strong p-0.5 text-sm">
            {(["paste", "file"] as const).map((m) => (
              <button type="button" key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-[5px] px-3 py-1 ${mode === m ? "bg-subtle font-medium" : "text-ink-2"}`}>{m === "paste" ? "Paste transcript" : "Upload file"}</button>
            ))}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setMode("paste"); setForm((f) => ({ ...f, transcript: DEMO_TRANSCRIPT, title: f.title || "Intro call · Brightline Packaging", duration_minutes: f.duration_minutes || "18" })); }}>Use demo transcript</Button>
        </div>
        {mode === "paste" ? (
          <textarea aria-label="Transcript" value={form.transcript} onChange={(e) => set("transcript", e.target.value)} rows={18} placeholder={"Paste the call transcript here.\n\nSpeaker labels help but are not required."} className="block w-full resize-y rounded-b-[10px] bg-surface px-4 py-3 text-sm leading-6 outline-none placeholder:text-muted" />
        ) : (
          <div className="p-4">
            <button type="button" onClick={() => fileRef.current?.click()} className="t-colors flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong px-4 py-12 text-sm hover:bg-subtle">
              <Upload className="size-5 text-muted" />
              {file ? <span className="mono">{file.name}</span> : <span>Choose a transcript file</span>}
              <span className="text-xs text-muted">.txt, .vtt, .srt (Zoom / Meet / Teams), .docx or .pdf · up to 10 MB</span>
            </button>
            <input ref={fileRef} type="file" accept=".txt,.vtt,.srt,.docx,.pdf,.md" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <div className="grid gap-3">
            <div>
              <label htmlFor="c-title" className="mb-1 block text-sm font-medium">Title</label>
              <input id="c-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Intro call · Company" className={inputClass} />
            </div>
            <div>
              <label htmlFor="c-vendor" className="mb-1 block text-sm font-medium">Vendor</label>
              <select id="c-vendor" value={form.vendor_id} onChange={(e) => set("vendor_id", e.target.value)} className={inputClass}>
                <option value="">Not linked yet (decide after analysis)</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="c-ch" className="mb-1 block text-sm font-medium">Type</label>
                <select id="c-ch" value={form.channel} onChange={(e) => set("channel", e.target.value)} className={inputClass}>
                  <option value="call">Phone call</option>
                  <option value="video">Video call</option>
                  <option value="meeting">In person</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="c-dur" className="mb-1 block text-sm font-medium">Minutes</label>
                <input id="c-dur" inputMode="numeric" value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value.replace(/\D/g, ""))} className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="c-when" className="mb-1 block text-sm font-medium">When</label>
              <input id="c-when" type="datetime-local" value={form.occurred_at} onChange={(e) => set("occurred_at", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="c-notes" className="mb-1 block text-sm font-medium">Your notes <span className="font-normal text-muted">(optional)</span></label>
              <textarea id="c-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="w-full rounded-md border border-line-strong px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy || !canSubmit}><Spark className="size-3.5" /> {busy ? "Uploading…" : "Log call and analyse"}</Button>
        <p className="text-xs text-muted">The agent extracts vendor details, requirements, action items and follow-ups. Nothing changes on a vendor record until you apply it.</p>
      </div>
    </form>
  );
}

/** Polls while the agent analyses, then refreshes the server page. */
export function AnalysisWaiter({ callId, status, error }: { callId: string; status: string; error: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (status !== "analysing") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/calls/${callId}`, { cache: "no-store" });
      const b = await res.json().catch(() => null);
      if (b && b.status !== "analysing") router.refresh();
    }, 1500);
    return () => clearInterval(t);
  }, [callId, status, router]);
  if (status === "failed")
    return (
      <div className="px-4 py-6 text-sm">
        <p className="text-danger">Analysis failed: {error}</p>
        <Button size="sm" className="mt-3" disabled={busy} onClick={async () => { setBusy(true); await fetch(`/api/calls/${callId}`, { method: "POST" }); router.refresh(); }}>Try again</Button>
      </div>
    );
  return (
    <div className="flex items-center gap-3 px-4 py-10 text-sm text-ink-2">
      <span className="anim-pulse size-2 rounded-full bg-accent" /> The agent is reading the transcript…
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  company_name: "Company",
  contact_name: "Contact",
  designation: "Designation",
  contact_email: "Email",
  contact_phone: "Mobile",
  city: "City",
  state: "State",
  gstin: "GSTIN",
  pan: "PAN",
  supplies: "Supplies",
};

/** Review what the agent extracted, tick what to keep, and apply it to a vendor (existing or new). */
export function ApplyPanel({ callId, analysis, vendors, linkedVendor, appliedAt }: { callId: string; analysis: CallAnalysis; vendors: { id: string; company_name: string }[]; linkedVendor: string | null; appliedAt: string | null }) {
  const router = useRouter();
  const found = Object.entries(analysis.vendor).filter(([, v]) => v.value);
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(found.map(([k, v]) => [k, v.value!])));
  const [picked, setPicked] = useState<Set<string>>(new Set(found.map(([k]) => k)));
  const [target, setTarget] = useState<string>(linkedVendor ?? (vendors.find((v) => v.company_name.toLowerCase() === (analysis.vendor.company_name.value ?? "").toLowerCase())?.id ?? "new"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hint = (k: string, v: string) => {
    if (k === "gstin") return validateGstin(v).valid ? "valid format" : validateGstin(v).reason;
    if (k === "pan") return validatePan(v).valid ? "valid format" : validatePan(v).reason;
    return null;
  };

  if (!found.length) return <p className="px-4 py-4 text-sm text-muted">No vendor details were stated on this call.</p>;
  return (
    <div className="px-4 py-4">
      <ul className="divide-y divide-line">
        {found.map(([k, v]) => {
          const h = hint(k, values[k]);
          return (
            <li key={k} className="grid grid-cols-[20px_96px_1fr] items-start gap-2 py-2">
              <input type="checkbox" aria-label={`Apply ${FIELD_LABEL[k]}`} checked={picked.has(k)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(k); else n.delete(k); setPicked(n); }} className="mt-2.5 accent-[var(--color-accent)]" />
              <span className="pt-2 text-xs text-muted">{FIELD_LABEL[k]}</span>
              <span className="min-w-0">
                <input value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} className={`${inputClass} h-8 text-sm ${["gstin", "pan"].includes(k) ? "mono" : ""}`} />
                {v.evidence && <span className="mt-0.5 block truncate text-[11px] italic text-muted" title={v.evidence}>“{v.evidence}”</span>}
                {h && <span className={`block text-[11px] ${h === "valid format" ? "text-ok" : "text-accent"}`}>{h}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <label htmlFor="apply-target" className="mt-4 mb-1 block text-sm font-medium">Apply to</label>
      <select id="apply-target" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass}>
        <option value="new">Create a new vendor</option>
        {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
      </select>
      <p className="mt-2 text-xs text-muted">GSTIN, PAN and state go into the vendor&apos;s onboarding form as pre-filled values. The vendor still confirms them and verification checks them.</p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <Button
        variant="dark"
        className="mt-4 w-full"
        disabled={busy || picked.size === 0}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const fields = Object.fromEntries([...picked].map((k) => [k, values[k]]));
          const res = await fetch(`/api/calls/${callId}/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor_id: target === "new" ? null : target, fields }) });
          const b = await res.json();
          if (!res.ok) {
            setError(b.error);
            setBusy(false);
            return;
          }
          router.push(`/vendors/${b.vendor_id}`);
        }}
      >
        <Check className="size-3.5" /> {busy ? "Applying…" : target === "new" ? "Create vendor from call" : appliedAt ? "Apply again" : "Apply to vendor"}
      </Button>
    </div>
  );
}
