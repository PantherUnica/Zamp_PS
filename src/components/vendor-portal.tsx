"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { ACCOUNT_TYPES, CONSTITUTIONS, DOCS, isCompany, requiredSlots, STATES } from "@/lib/india";
import { ALLOWED_MIME, MAX_FILE_BYTES, fieldHint, submissionDataSchema } from "@/lib/schema";
import { SAMPLE_CASES, sampleFor } from "@/lib/samples";
import { SLOTS, type Constitution, type Slot } from "@/lib/types";
import { Alert, Check, FileIcon, Lock, Upload } from "./icons";
import { Button, Chip } from "./ui";
import { fmtAge, fmtBytes, fmtDate } from "./format";

interface PortalView {
  ref: string;
  status: string;
  company: string;
  contact: { name: string | null; email: string } | null;
  data: Record<string, unknown>;
  draftSavedAt: string | null;
  submittedAt: string | null;
  version: number;
  editable: boolean;
  expired: boolean;
  expiresAt: string | null;
  staffMode: boolean;
  documents: { id: string; slot: Slot; file_name: string; size_bytes: number; version: number; isNew: boolean }[];
  request: { items: { code: string; title: string; action: string; slot?: string; field?: string }[]; created_at: string } | null;
  run: { status: string; stages: { key: string; label: string; status: string }[] } | null;
}

type Form = {
  legal_name: string; trade_name: string; constitution: Constitution | ""; cin: string; llpin: string; udyam: string; supplies: string;
  address_line: string; city: string; state: string; pincode: string;
  contact_name: string; designation: string; contact_email: string; contact_phone: string;
  gstin: string; pan: string;
  bank: { account_holder: string; account_number: string; ifsc: string; bank_name: string; branch: string; account_type: "current" | "savings" };
};

const toForm = (d: Record<string, unknown>): Form => {
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const b = (d.bank ?? {}) as Record<string, string>;
  return {
    legal_name: s("legal_name"), trade_name: s("trade_name"), constitution: (s("constitution") as Constitution) || "", cin: s("cin"), llpin: s("llpin"), udyam: s("udyam"), supplies: s("supplies"),
    address_line: s("address_line"), city: s("city"), state: s("state"), pincode: s("pincode"),
    contact_name: s("contact_name"), designation: s("designation"), contact_email: s("contact_email"), contact_phone: s("contact_phone"),
    gstin: s("gstin"), pan: s("pan"),
    bank: { account_holder: b.account_holder ?? "", account_number: b.account_number ?? "", ifsc: b.ifsc ?? "", bank_name: b.bank_name ?? "", branch: b.branch ?? "", account_type: (b.account_type as "current" | "savings") ?? "current" },
  };
};

const STEPS = [
  { key: "business", label: "Business", fields: ["legal_name", "trade_name", "constitution", "cin", "llpin", "udyam", "supplies"] },
  { key: "contact", label: "Address and contact", fields: ["address_line", "city", "state", "pincode", "contact_name", "designation", "contact_email", "contact_phone"] },
  { key: "tax", label: "Tax registration", fields: ["gstin", "pan"] },
  { key: "bank", label: "Bank account", fields: ["bank.account_holder", "bank.account_number", "confirm_account", "bank.ifsc", "bank.bank_name", "bank.branch", "bank.account_type"] },
  { key: "documents", label: "Documents", fields: ["documents"] },
  { key: "review", label: "Review and submit", fields: [] },
] as const;

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  processing: { title: "We're checking your details", body: "We are reading your documents and verifying your details. This usually takes under a minute. You can close this page." },
  awaiting_review: { title: "Under review", body: "Your submission is with our procurement team for a final decision. No action is needed from you." },
  awaiting_vendor: { title: "We're preparing a request", body: "Our team is reviewing a few details and will email you shortly if anything needs to change." },
  approved: { title: "You're approved", body: "Your business is registered as a supplier. Our accounts team will use these details for payments." },
  rejected: { title: "Not approved", body: "We were unable to approve this registration. Reply to our email if you believe this is a mistake." },
  error: { title: "We hit a problem on our side", body: "Our team has been notified and will re-check your submission. No action is needed." },
};

export function VendorPortal({ token }: { token: string }) {
  const [view, setView] = useState<PortalView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const res = await fetch(`/api/v/${token}`, { cache: "no-store" });
        const body = await res.json();
        if (!alive) return;
        if (!res.ok) return setLoadError(body.error ?? "This link is not valid.");
        setView(body);
        if (body.status === "processing") timer = setTimeout(load, 1500);
      } catch {
        if (alive) setLoadError("We could not reach the server. Check your connection and refresh.");
      }
    };
    load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [token, nonce]);

  if (loadError) return <Notice tone="danger" title="This link isn't working">{loadError}</Notice>;
  if (!view) return <div className="h-64 glass rounded-[16px]" aria-busy="true" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mono text-xs text-muted">{view.ref}{view.version > 1 ? ` · round ${view.version}` : ""}</p>
        <h1 className="display mt-3 text-[34px] sm:text-[48px]">{view.editable && !view.submittedAt ? `Welcome, ${view.company}` : view.company}</h1>
        {view.contact && <p className="mt-2 text-sm text-ink-2">Your contact: {view.contact.name ?? view.contact.email} · <a className="underline underline-offset-4" href={`mailto:${view.contact.email}`}>{view.contact.email}</a></p>}
      </div>
      {view.editable ? <PortalForm token={token} view={view} onSubmitted={reload} /> : <StatusView view={view} />}
    </div>
  );
}

function Notice({ tone, title, children }: { tone: "danger" | "attention" | "ok" | "neutral"; title: string; children: ReactNode }) {
  const cls = { danger: "border-danger/30 bg-danger-soft", attention: "border-accent-line bg-accent-soft", ok: "border-ok/20 bg-ok-soft", neutral: "border-line bg-surface" }[tone];
  return (
    <section className={`rounded-[10px] border px-5 py-4 ${cls}`} aria-live="polite">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-1 text-sm text-ink-2">{children}</div>
    </section>
  );
}

function StatusView({ view }: { view: PortalView }) {
  if (view.expired && view.status === "draft") return <Notice tone="attention" title="This link has expired">Ask {view.contact?.name ?? "your contact"} for a new onboarding link. Anything you saved is kept.</Notice>;
  const copy = STATUS_COPY[view.status] ?? STATUS_COPY.processing;
  const tone = view.status === "approved" ? "ok" : view.status === "rejected" || view.status === "error" ? "neutral" : "neutral";
  return (
    <>
      <Notice tone={tone} title={copy.title}>{copy.body}</Notice>
      {view.status === "processing" && view.run && (
        <ol className="grid gap-2 glass rounded-[16px] px-5 py-4 sm:grid-cols-2">
          {view.run.stages.filter((s) => s.key !== "communicate").map((s) => {
            const done = ["passed", "warning", "failed"].includes(s.status);
            return (
              <li key={s.key} className="flex items-center gap-2 text-sm">
                <span className={`grid size-5 place-items-center rounded-full border ${s.status === "running" ? "border-accent" : done ? "border-ink bg-ink text-white" : "border-line-strong"}`}>
                  {s.status === "running" ? <span className="anim-pulse size-1.5 rounded-full bg-accent" /> : done ? <Check className="size-3" /> : null}
                </span>
                <span className={s.status === "pending" ? "text-muted" : ""}>{s.label.replace("Decision rules", "Final checks")}</span>
              </li>
            );
          })}
        </ol>
      )}
      {view.submittedAt && <p className="text-xs text-muted">Submitted {fmtAge(view.submittedAt)}. Keep this link to check your status.</p>}
    </>
  );
}

// ------------------------------------------------------------------ the form
function PortalForm({ token, view, onSubmitted }: { token: string; view: PortalView; onSubmitted: () => void }) {
  const [form, setForm] = useState<Form>(() => toForm(view.data));
  const [confirmAcct, setConfirmAcct] = useState(() => toForm(view.data).bank.account_number);
  const [docs, setDocs] = useState(view.documents);
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<{ at: string | null; saving: boolean; error: string | null }>({ at: view.draftSavedAt, saving: false, error: null });
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmMissing, setConfirmMissing] = useState<Slot[] | null>(null);
  const [ifscInfo, setIfscInfo] = useState<string | null>(null);
  const dirty = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const requested = useMemo(() => {
    const set = new Set<string>();
    for (const it of view.request?.items ?? []) {
      if (it.slot) set.add(`doc:${it.slot}`);
      if (it.field) set.add(it.field.startsWith("bank") ? "bank" : it.field);
    }
    return set;
  }, [view.request]);

  // Autosave 1.2s after the last change.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      setSaveState((s) => ({ ...s, saving: true }));
      try {
        const res = await fetch(`/api/v/${token}/draft`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: form }) });
        const b = await res.json();
        if (!res.ok) throw new Error(b.error);
        dirty.current = false;
        setSaveState({ at: b.savedAt, saving: false, error: null });
      } catch (e) {
        setSaveState((s) => ({ ...s, saving: false, error: e instanceof Error ? e.message : "Could not save" }));
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [form, token]);

  const update = (patch: Partial<Form>) => {
    dirty.current = true;
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !Object.keys(patch).includes(k))));
  };
  const updateBank = (patch: Partial<Form["bank"]>) => {
    dirty.current = true;
    setForm((f) => ({ ...f, bank: { ...f.bank, ...patch } }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !Object.keys(patch).map((p) => `bank.${p}`).includes(k))));
  };
  const touch = (k: string) => setTouched((t) => new Set(t).add(k));

  const required = requiredSlots(form.constitution || undefined);
  const haveSlots = new Set(docs.map((d) => d.slot));
  const missingDocs = required.filter((s) => !haveSlots.has(s));

  function validateAll() {
    const errs: Record<string, string> = {};
    const r = submissionDataSchema.safeParse(form);
    if (!r.success) for (const i of r.error.issues) errs[i.path.join(".")] ??= i.message;
    if (confirmAcct.replace(/\s/g, "") !== form.bank.account_number.replace(/\s/g, "")) errs.confirm_account = "Account numbers do not match";
    setErrors(errs);
    return errs;
  }

  function stepHasError(i: number, errs = errors) {
    return STEPS[i].fields.some((f) => errs[f]);
  }

  async function submit(force = false) {
    setSubmitError(null);
    const errs = validateAll();
    if (Object.keys(errs).length) {
      const first = STEPS.findIndex((_, i) => stepHasError(i, errs));
      setStep(first >= 0 ? first : 0);
      setSubmitError(`Please fix ${Object.keys(errs).length} field${Object.keys(errs).length > 1 ? "s" : ""} before submitting.`);
      topRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (missingDocs.length && !force) return setConfirmMissing(missingDocs);
    setConfirmMissing(null);
    setSubmitting("Submitting…");
    try {
      const res = await fetch(`/api/v/${token}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: form }) });
      const b = await res.json();
      if (!res.ok) {
        const e2: Record<string, string> = {};
        for (const d of (b.details ?? []) as { path: string; message: string }[]) e2[d.path.replace(/^data\./, "")] = d.message;
        setErrors(e2);
        throw new Error(b.error ?? "Submission failed");
      }
      onSubmitted();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
      setSubmitting(null);
    }
  }

  async function uploadFile(slot: Slot, file: File) {
    if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) throw new Error("Only PDF, PNG or JPEG files are accepted");
    if (file.size > MAX_FILE_BYTES) throw new Error("Files must be 10 MB or smaller");
    const res = await fetch(`/api/v/${token}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot, name: file.name, type: file.type, size: file.size }) });
    const up = await res.json();
    if (!res.ok) throw new Error(up.details?.[0]?.message ?? up.error ?? "Upload failed");
    const put = await browserClient().storage.from("vendor-documents").uploadToSignedUrl(up.path, up.token, file, { contentType: file.type });
    if (put.error) throw new Error(put.error.message);
    const ok = await fetch(`/api/v/${token}/documents/${up.documentId}`, { method: "POST" });
    if (!ok.ok) throw new Error((await ok.json()).error ?? "Upload failed");
    setDocs((d) => [...d.filter((x) => x.slot !== slot), { id: up.documentId, slot, file_name: file.name, size_bytes: file.size, version: view.version, isNew: true }]);
  }

  async function removeDoc(id: string) {
    const res = await fetch(`/api/v/${token}/documents/${id}`, { method: "DELETE" });
    if (res.ok) setDocs((d) => d.filter((x) => x.id !== id));
  }

  async function fillDemo(sampleId: string, round: "first" | "fix") {
    const s = SAMPLE_CASES.find((x) => x.id === sampleId);
    if (!s) return;
    setSubmitting("Loading demo data…");
    try {
      if (round === "first") {
        const next = toForm({ ...s.data, contact_email: form.contact_email || s.data.contact_email });
        dirty.current = true;
        setForm(next);
        setConfirmAcct(next.bank.account_number);
      }
      for (const f of round === "first" ? s.files : s.resubmission ?? []) {
        const blob = await (await fetch(f.url)).blob();
        await uploadFile(f.slot, new File([blob], f.name, { type: "application/pdf" }));
      }
      setStep(round === "first" ? 5 : 4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Demo load failed");
    } finally {
      setSubmitting(null);
    }
  }

  const sample = sampleFor(view.company);
  const progress = STEPS.slice(0, 5).map((s, i) => (i === 4 ? missingDocs.length === 0 : s.fields.filter((f) => !["trade_name", "cin", "llpin", "udyam", "supplies", "designation", "bank.bank_name", "bank.branch", "bank.account_type"].includes(f)).every((f) => (f === "confirm_account" ? confirmAcct : f.startsWith("bank.") ? form.bank[f.slice(5) as keyof Form["bank"]] : form[f as keyof Form]))));

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <div ref={topRef} className="hidden lg:block" />
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <ol className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined} className={`t-colors flex w-full items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-2 text-left text-sm ${step === i ? "bg-surface font-medium shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:bg-accent-soft/70"}`}>
                <span className={`grid size-5 shrink-0 place-items-center rounded-full border text-[10px] ${stepHasError(i) ? "border-danger text-danger" : progress[i] ? "border-ink bg-ink text-white" : "border-line-strong text-muted"}`}>
                  {stepHasError(i) ? "!" : progress[i] ? <Check className="size-3" /> : i + 1}
                </span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-4 hidden text-xs text-muted lg:block">
          <span className={`t-colors ${saveState.error ? "text-danger" : ""}`}>
            {saveState.saving ? "Saving…" : saveState.error ? `Not saved: ${saveState.error}` : saveState.at ? `Progress saved ${fmtAge(saveState.at)}` : "Your progress saves automatically"}
          </span>
          {view.expiresAt && <span className="mt-1 block">Link valid until {fmtDate(view.expiresAt)}</span>}
        </p>
        {view.staffMode && (
          <div className="mt-4 rounded-md border border-dashed border-line-strong p-3 text-xs">
            <div className="font-medium text-ink-2">Staff view · demo helpers</div>
            <p className="mt-1 text-muted">You are signed in, so your actions are logged as staff.</p>
            {!view.submittedAt && (
              <select defaultValue={sample?.id ?? ""} onChange={(e) => e.target.value && fillDemo(e.target.value, "first")} className="mt-2 h-8 w-full rounded-md border border-line-strong bg-surface px-2" aria-label="Fill demo details">
                <option value="" disabled>Fill demo details…</option>
                {SAMPLE_CASES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            )}
            {view.submittedAt && sample?.resubmission && <Button size="sm" className="mt-2 w-full" onClick={() => fillDemo(sample.id, "fix")}>Attach requested demo file</Button>}
          </div>
        )}
      </aside>

      <div className="min-w-0">
        {view.request && (
          <section className="mb-6 rounded-[10px] border border-accent-line bg-accent-soft px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-accent"><Alert /> Please update the following</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
              {view.request.items.map((it, i) => <li key={i}><span className="font-medium">{it.title}</span><span className="block text-ink-2">{it.action}</span></li>)}
            </ol>
            <p className="mt-3 text-xs text-ink-2">Everything else is already saved. Change only what is listed, then resubmit.</p>
          </section>
        )}

        <div key={step} className="anim-fade glass rounded-[16px]">
          <header className="border-b border-line px-5 py-4 sm:px-6">
            <p className="text-xs text-muted">Step {step + 1} of {STEPS.length}</p>
            <h2 className="mt-0.5 text-md font-semibold">{STEPS[step].label}</h2>
          </header>
          <div className="grid gap-5 px-5 py-6 sm:px-6">
            {step === 0 && (
              <>
                <F label="Registered legal name" hint="Exactly as on your GST and PAN documents" error={errors.legal_name} highlight={requested.has("legal_name")}>
                  <input value={form.legal_name} onChange={(e) => update({ legal_name: e.target.value })} className={big(errors.legal_name)} autoComplete="organization" />
                </F>
                <F label="Trade name" optional hint="If you trade under a different name">
                  <input value={form.trade_name} onChange={(e) => update({ trade_name: e.target.value })} className={big()} />
                </F>
                <F label="Type of business" error={errors.constitution}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {CONSTITUTIONS.map((c) => (
                      <label key={c.value} className={`t-colors flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${form.constitution === c.value ? "border-ink bg-subtle" : "border-line-strong hover:bg-accent-soft/70"}`}>
                        <input type="radio" name="constitution" checked={form.constitution === c.value} onChange={() => update({ constitution: c.value })} className="accent-[var(--color-accent)]" />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </F>
                {form.constitution && isCompany(form.constitution) && (
                  <V label="Corporate Identification Number (CIN)" field="cin" value={form.cin} onChange={(v) => update({ cin: v.toUpperCase() })} error={errors.cin} touched={touched} touch={touch} placeholder="U29100KA2019PTC123456" mono />
                )}
                {form.constitution === "llp" && <V label="LLP Identification Number (LLPIN)" field="llpin" value={form.llpin} onChange={(v) => update({ llpin: v.toUpperCase() })} error={errors.llpin} touched={touched} touch={touch} placeholder="AAB-1234" mono />}
                <V label="Udyam (MSME) registration number" optional field="udyam" value={form.udyam} onChange={(v) => update({ udyam: v.toUpperCase() })} error={errors.udyam} touched={touched} touch={touch} placeholder="UDYAM-KA-03-0012345" mono />
                <F label="What do you supply?" optional>
                  <input value={form.supplies} onChange={(e) => update({ supplies: e.target.value })} className={big()} />
                </F>
              </>
            )}
            {step === 1 && (
              <>
                <F label="Registered address" error={errors.address_line}>
                  <input value={form.address_line} onChange={(e) => update({ address_line: e.target.value })} className={big(errors.address_line)} autoComplete="street-address" />
                </F>
                <div className="grid gap-5 sm:grid-cols-3">
                  <F label="City" error={errors.city}><input value={form.city} onChange={(e) => update({ city: e.target.value })} className={big(errors.city)} autoComplete="address-level2" /></F>
                  <F label="State" error={errors.state}>
                    <select value={form.state} onChange={(e) => update({ state: e.target.value })} className={big(errors.state)}>
                      <option value="">Select…</option>
                      {STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </select>
                  </F>
                  <V label="PIN code" field="pincode" value={form.pincode} onChange={(v) => update({ pincode: v.replace(/\D/g, "").slice(0, 6) })} error={errors.pincode} touched={touched} touch={touch} inputMode="numeric" mono />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <F label="Contact person" error={errors.contact_name}><input value={form.contact_name} onChange={(e) => update({ contact_name: e.target.value })} className={big(errors.contact_name)} autoComplete="name" /></F>
                  <F label="Designation" optional><input value={form.designation} onChange={(e) => update({ designation: e.target.value })} className={big()} /></F>
                  <F label="Email" error={errors.contact_email} hint="We send updates about this registration here"><input type="email" value={form.contact_email} onChange={(e) => update({ contact_email: e.target.value })} className={big(errors.contact_email)} autoComplete="email" /></F>
                  <V label="Mobile number" field="contact_phone" value={form.contact_phone} onChange={(v) => update({ contact_phone: v })} error={errors.contact_phone} touched={touched} touch={touch} inputMode="tel" placeholder="+91 98xxx xxxxx" />
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <V label="GSTIN" field="gstin" value={form.gstin} onChange={(v) => update({ gstin: v.toUpperCase().replace(/\s/g, "").slice(0, 15) })} error={errors.gstin} touched={touched} touch={touch} hint="15 characters, from your GST registration certificate" placeholder="29AABCN1234F1ZS" mono highlight={requested.has("gstin")} counter={15} />
                <V label="PAN of the business" field="pan" value={form.pan} onChange={(v) => update({ pan: v.toUpperCase().replace(/\s/g, "").slice(0, 10) })} error={errors.pan} touched={touched} touch={touch} hint={form.constitution === "proprietorship" ? "For proprietorships, the proprietor's PAN" : "The company / firm PAN, not a director's"} placeholder="AABCN1234F" mono highlight={requested.has("pan")} counter={10} />
                {form.gstin.length === 15 && /^[A-Z]{5}\d{4}[A-Z]$/.test(form.pan) && form.gstin.slice(2, 12) !== form.pan && (
                  <p className="flex gap-2 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent"><Alert className="mt-0.5 shrink-0" /> Characters 3–12 of a GSTIN are the PAN it was issued to. These two don&apos;t match. Please double-check both.</p>
                )}
                {form.gstin.length >= 2 && form.state && form.gstin.slice(0, 2) !== form.state && (
                  <p className="flex gap-2 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent"><Alert className="mt-0.5 shrink-0" /> This GSTIN is registered in {STATES.find((s) => s.code === form.gstin.slice(0, 2))?.name ?? `state ${form.gstin.slice(0, 2)}`}, but your address is in {STATES.find((s) => s.code === form.state)?.name}. Use the GSTIN for the state you will invoice from.</p>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <F label="Account holder name" hint="Must be the business itself. Payments to other accounts are not allowed" error={errors["bank.account_holder"]} highlight={requested.has("bank")}>
                  <input value={form.bank.account_holder} onChange={(e) => updateBank({ account_holder: e.target.value })} className={big(errors["bank.account_holder"])} />
                </F>
                <div className="grid gap-5 sm:grid-cols-2">
                  <V label="Account number" field="account_number" value={form.bank.account_number} onChange={(v) => updateBank({ account_number: v.replace(/\D/g, "").slice(0, 18) })} error={errors["bank.account_number"]} touched={touched} touch={touch} inputMode="numeric" mono />
                  <F label="Confirm account number" error={errors.confirm_account ?? (touched.has("confirm") && confirmAcct && confirmAcct !== form.bank.account_number ? "Account numbers do not match" : undefined)}>
                    <input value={confirmAcct} onChange={(e) => { setConfirmAcct(e.target.value.replace(/\D/g, "").slice(0, 18)); setErrors((x) => ({ ...x, confirm_account: "" })); }} onBlur={() => touch("confirm")} onPaste={(e) => e.preventDefault()} inputMode="numeric" className={`${big(errors.confirm_account)} mono`} autoComplete="off" />
                  </F>
                </div>
                <V
                  label="IFSC"
                  field="ifsc"
                  value={form.bank.ifsc}
                  onChange={(v) => { updateBank({ ifsc: v.toUpperCase().replace(/\s/g, "").slice(0, 11) }); setIfscInfo(null); }}
                  onBlurExtra={async () => {
                    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bank.ifsc)) return;
                    try {
                      const r = await fetch(`https://ifsc.razorpay.com/${form.bank.ifsc}`);
                      if (r.status === 404) return setIfscInfo("We couldn't find this IFSC. Please copy it exactly from your cheque.");
                      const j = await r.json();
                      setIfscInfo(`${j.BANK}, ${j.BRANCH}`);
                      updateBank({ bank_name: form.bank.bank_name || j.BANK, branch: form.bank.branch || `${j.BRANCH}, ${j.CITY}` });
                    } catch {
                      /* lookup is a convenience only */
                    }
                  }}
                  error={errors["bank.ifsc"]}
                  touched={touched}
                  touch={touch}
                  placeholder="HDFC0000075"
                  mono
                  counter={11}
                  extra={ifscInfo && <span className={`mt-1 block text-xs ${ifscInfo.startsWith("We couldn") ? "text-accent" : "text-ok"}`}>{ifscInfo}</span>}
                />
                <div className="grid gap-5 sm:grid-cols-3">
                  <F label="Bank" optional><input value={form.bank.bank_name} onChange={(e) => updateBank({ bank_name: e.target.value })} className={big()} /></F>
                  <F label="Branch" optional><input value={form.bank.branch} onChange={(e) => updateBank({ branch: e.target.value })} className={big()} /></F>
                  <F label="Account type">
                    <select value={form.bank.account_type} onChange={(e) => updateBank({ account_type: e.target.value as "current" | "savings" })} className={big()}>
                      {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </F>
                </div>
                <p className="flex gap-2 text-xs text-muted"><Lock className="size-3.5 shrink-0" /> Bank details are visible only to our procurement and accounts team.</p>
              </>
            )}
            {step === 4 && (
              <>
                <p className="text-sm text-ink-2">PDF, PNG or JPEG, up to 10 MB each. Clear photos taken on a phone are fine.</p>
                {SLOTS.map((slot) => (
                  <DocSlot
                    key={slot}
                    slot={slot}
                    required={required.includes(slot)}
                    requested={requested.has(`doc:${slot}`)}
                    doc={docs.find((d) => d.slot === slot)}
                    resubmitting={Boolean(view.submittedAt)}
                    onUpload={(f) => uploadFile(slot, f)}
                    onRemove={removeDoc}
                  />
                ))}
              </>
            )}
            {step === 5 && <Review form={form} docs={docs} required={required} goTo={setStep} errors={errors} />}
          </div>
          <footer className="flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted lg:hidden">{saveState.saving ? "Saving…" : saveState.at ? "Saved" : ""}</span>
              {step < STEPS.length - 1 ? (
                <Button variant="dark" onClick={() => setStep((s) => s + 1)}>Continue</Button>
              ) : (
                <Button variant="primary" disabled={!!submitting} onClick={() => submit()}>{submitting ?? (view.submittedAt ? "Resubmit for verification" : "Submit for verification")}</Button>
              )}
            </div>
          </footer>
        </div>
        {submitError && <p role="alert" className="mt-4 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{submitError}</p>}
        {submitting && step !== 5 && <p className="mt-4 text-sm text-muted">{submitting}</p>}
      </div>

      {confirmMissing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/20 px-4" role="dialog" aria-modal="true" aria-labelledby="missing-title">
          <div className="anim-dialog w-full max-w-md rounded-[10px] bg-surface p-6 shadow-overlay">
            <h3 id="missing-title" className="font-semibold">Submit without every document?</h3>
            <p className="mt-2 text-sm text-ink-2">These are still missing, so verification can&apos;t finish until you add them:</p>
            <ul className="mt-2 list-disc pl-5 text-sm">{confirmMissing.map((s) => <li key={s}>{DOCS[s].label}</li>)}</ul>
            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={() => { setConfirmMissing(null); setStep(4); }}>Add documents</Button>
              <Button variant="dark" onClick={() => submit(true)}>Submit anyway</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const big = (err?: string) => `t-colors h-10 w-full rounded-md border bg-surface px-3 text-md placeholder:text-muted/60 hover:border-muted ${err ? "border-danger" : "border-line-strong"}`;

function F({ label, hint, optional, error, highlight, children }: { label: string; hint?: string; optional?: boolean; error?: string; highlight?: boolean; children: ReactNode }) {
  return (
    <div className={highlight ? "-mx-3 rounded-md bg-accent-soft px-3 py-2" : ""}>
      <label className="mb-1.5 block text-sm font-medium">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>} {highlight && <Chip tone="attention" className="ml-1">Requested</Chip>}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Field with live, format-only validation shown after the user leaves it. */
function V(p: { label: string; field: string; value: string; onChange: (v: string) => void; error?: string; touched: Set<string>; touch: (k: string) => void; hint?: string; placeholder?: string; optional?: boolean; mono?: boolean; inputMode?: "numeric" | "tel"; highlight?: boolean; counter?: number; onBlurExtra?: () => void; extra?: ReactNode }) {
  const live = p.touched.has(p.field) ? fieldHint(p.field, p.value) : null;
  const err = p.error || (live && !live.ok ? live.message : undefined);
  return (
    <F label={p.label} optional={p.optional} error={err} hint={!err ? (live?.ok ? undefined : p.hint) : undefined} highlight={p.highlight}>
      <div className="relative">
        <input value={p.value} onChange={(e) => p.onChange(e.target.value)} onBlur={() => { p.touch(p.field); p.onBlurExtra?.(); }} placeholder={p.placeholder} inputMode={p.inputMode} className={`${big(err)} ${p.mono ? "mono tracking-wide" : ""} ${p.counter ? "pr-16" : ""}`} spellCheck={false} />
        {p.counter && <span className={`mono pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs ${p.value.length === p.counter ? "text-ok" : "text-muted"}`}>{p.value.length}/{p.counter}</span>}
      </div>
      {live?.ok && !err && <span className="mt-1 flex items-center gap-1 text-xs text-ok"><Check className="size-3" /> {live.message}</span>}
      {p.extra}
    </F>
  );
}

function DocSlot({ slot, required, requested, doc, resubmitting, onUpload, onRemove }: { slot: Slot; required: boolean; requested: boolean; doc?: PortalView["documents"][number]; resubmitting: boolean; onUpload: (f: File) => Promise<void>; onRemove: (id: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const handle = async (f?: File | null) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      await onUpload(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
      className={`t-colors flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center ${error ? "border-danger" : requested ? "border-accent bg-accent-soft" : drag ? "border-ink bg-subtle" : doc ? "border-line" : "border-dashed border-line-strong"}`}
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-md ${doc ? "bg-ink text-white" : "bg-subtle text-muted"}`}>{doc ? <Check className="size-4" /> : <FileIcon />}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {DOCS[slot].label} {!required && <span className="font-normal text-muted">(optional)</span>} {requested && <Chip tone="attention" className="ml-1">Requested</Chip>}
        </div>
        {doc ? (
          <div className="mono truncate text-xs text-ink-2">{doc.file_name} · {fmtBytes(doc.size_bytes)}{resubmitting && !doc.isNew ? " · already submitted" : ""}</div>
        ) : (
          <div className="text-xs text-muted">{DOCS[slot].hint}</div>
        )}
        {error && <div className="text-xs text-danger">{error}</div>}
      </div>
      <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="sr-only" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} aria-label={`Upload ${DOCS[slot].label}`} />
      <div className="flex gap-2">
        {doc?.isNew && !busy && <Button size="sm" variant="ghost" onClick={() => onRemove(doc.id)}>Remove</Button>}
        <Button size="sm" disabled={busy} onClick={() => ref.current?.click()}>
          <Upload className="size-3.5" /> {busy ? "Uploading…" : doc ? "Replace" : "Upload"}
        </Button>
      </div>
    </div>
  );
}

function Review({ form, docs, required, goTo, errors }: { form: Form; docs: PortalView["documents"]; required: Slot[]; goTo: (i: number) => void; errors: Record<string, string> }) {
  const st = STATES.find((s) => s.code === form.state)?.name;
  const rows: [number, string, [string, string | undefined][]][] = [
    [0, "Business", [["Legal name", form.legal_name], ["Type", CONSTITUTIONS.find((c) => c.value === form.constitution)?.label], ["CIN / LLPIN", form.cin || form.llpin], ["Udyam", form.udyam]]],
    [1, "Address and contact", [["Address", [form.address_line, form.city, st, form.pincode].filter(Boolean).join(", ")], ["Contact", [form.contact_name, form.designation].filter(Boolean).join(", ")], ["Email", form.contact_email], ["Mobile", form.contact_phone]]],
    [2, "Tax registration", [["GSTIN", form.gstin], ["PAN", form.pan]]],
    [3, "Bank account", [["Holder", form.bank.account_holder], ["Account", form.bank.account_number ? `•••• ${form.bank.account_number.slice(-4)}` : ""], ["IFSC", form.bank.ifsc], ["Bank", [form.bank.bank_name, form.bank.branch].filter(Boolean).join(", ")]]],
  ];
  return (
    <div className="grid gap-4">
      {rows.map(([i, title, items]) => (
        <section key={title} className="rounded-md border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <span className="text-sm font-medium">{title}</span>
            <button onClick={() => goTo(i)} className="text-xs text-ink-2 underline underline-offset-4">Edit</button>
          </div>
          <dl className="grid gap-x-4 px-4 py-2 sm:grid-cols-[120px_1fr]">
            {items.map(([k, v]) => (
              <div key={k} className="contents text-sm">
                <dt className="py-1 text-muted">{k}</dt>
                <dd className="py-1 break-words">{v || <span className="text-accent">Missing</span>}</dd>
              </div>
            ))}
          </dl>
          {STEPS[i].fields.some((f) => errors[f]) && <p className="border-t border-line px-4 py-2 text-xs text-danger">This section has errors. Edit it to fix them.</p>}
        </section>
      ))}
      <section className="rounded-md border border-line">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="text-sm font-medium">Documents</span>
          <button onClick={() => goTo(4)} className="text-xs text-ink-2 underline underline-offset-4">Edit</button>
        </div>
        <ul className="px-4 py-2 text-sm">
          {SLOTS.filter((s) => required.includes(s) || docs.some((d) => d.slot === s)).map((s) => {
            const d = docs.find((x) => x.slot === s);
            return <li key={s} className="flex justify-between gap-3 py-1"><span>{DOCS[s].label}</span>{d ? <span className="mono truncate text-xs text-ink-2">{d.file_name}</span> : <span className="text-accent">Missing</span>}</li>;
          })}
        </ul>
      </section>
      <p className="text-xs text-muted">By submitting you confirm these details are accurate. We check them against your documents and official formats; our team makes the final decision.</p>
    </div>
  );
}
