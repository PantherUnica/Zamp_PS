"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { COUNTRIES, COUNTRY_LIST } from "@/lib/rules/countries";
import { validateTaxId } from "@/lib/rules/validators";
import { ALLOWED_MIME, MAX_FILE_BYTES, submissionDataSchema } from "@/lib/schema";
import type { SampleCase } from "@/lib/samples";
import { SLOTS, type Country, type Slot, type SubmissionData } from "@/lib/types";
import { Alert, Check, FileIcon, Upload } from "./icons";
import { Button } from "./ui";
import { fmtBytes } from "./format";

const EMPTY: SubmissionData = {
  legal_name: "",
  trading_name: "",
  country: "IN",
  registration_number: "",
  tax_id: "",
  address: "",
  contact_name: "",
  contact_email: "",
  bank: { account_holder: "", bank_name: "", bank_country: "IN", account_number: "", ifsc: "" },
};

type Files = Partial<Record<Slot, File>>;

interface Props {
  mode: "create" | "revise";
  token?: string;
  initialData?: SubmissionData;
  existingDocs?: { slot: string; file_name: string }[];
  requestedSlots?: string[];
  samples?: SampleCase[];
  demoFiles?: { slot: Slot; url: string; name: string }[];
  reviewer?: boolean;
  onDone?: () => void;
}

async function fetchFile(url: string, name: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${name}`);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "application/pdf" });
}

/** Only send the bank fields that belong to the selected bank country. */
function cleanBank(d: SubmissionData): SubmissionData {
  const fields = COUNTRIES[d.bank.bank_country].bankFields;
  const bank = { account_holder: d.bank.account_holder, bank_name: d.bank.bank_name, bank_country: d.bank.bank_country } as SubmissionData["bank"];
  for (const f of fields) if (d.bank[f]) bank[f] = d.bank[f];
  return { ...d, bank };
}

export function SubmissionForm({ mode, token, initialData, existingDocs = [], requestedSlots = [], samples, demoFiles, reviewer, onDone }: Props) {
  const router = useRouter();
  const [data, setData] = useState<SubmissionData>(initialData ?? EMPTY);
  const [files, setFiles] = useState<Files>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmMissing, setConfirmMissing] = useState<Slot[] | null>(null);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const c = COUNTRIES[data.country];
  const bankC = COUNTRIES[data.bank.bank_country];
  const tax = data.tax_id.trim().length >= 5 ? validateTaxId(data.country, data.tax_id) : null;

  const clearErrors = (keys: string[]) =>
    setErrors((e) => (keys.some((k) => k in e) ? Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))) : e));
  const set = (patch: Partial<SubmissionData>) => {
    clearErrors(Object.keys(patch));
    setData((d) => ({ ...d, ...patch }));
  };
  const setBank = (patch: Partial<SubmissionData["bank"]>) => {
    clearErrors(Object.keys(patch).map((k) => `bank.${k}`));
    setData((d) => ({ ...d, bank: { ...d.bank, ...patch } }));
  };

  async function loadSample(id: string) {
    const s = samples?.find((x) => x.id === id);
    if (!s) return;
    setSampleNote("Loading test documents…");
    try {
      const loaded: Files = {};
      for (const f of s.files) loaded[f.slot] = await fetchFile(f.url, f.name);
      setData(s.data);
      setFiles(loaded);
      setErrors({});
      setSampleNote(`Loaded: ${s.expect}`);
    } catch (e) {
      setSampleNote(e instanceof Error ? e.message : "Could not load test case");
    }
  }

  async function attachDemoFiles() {
    if (!demoFiles) return;
    const loaded: Files = { ...files };
    for (const f of demoFiles) loaded[f.slot] = await fetchFile(f.url, f.name);
    setFiles(loaded);
  }

  function validate(): boolean {
    const r = submissionDataSchema.safeParse(cleanBank(data));
    const errs: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) errs[i.path.join(".")] = errs[i.path.join(".")] ?? i.message;
    for (const [slot, f] of Object.entries(files)) {
      if (!f) continue;
      if (!ALLOWED_MIME.includes(f.type as (typeof ALLOWED_MIME)[number])) errs[`file.${slot}`] = "Only PDF, PNG or JPEG";
      else if (f.size > MAX_FILE_BYTES) errs[`file.${slot}`] = "Files must be 10 MB or smaller";
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError(`Please fix ${Object.keys(errs).length} field${Object.keys(errs).length > 1 ? "s" : ""} highlighted below.`);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return false;
    }
    return true;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    const have = new Set([...Object.keys(files), ...existingDocs.map((d) => d.slot)]);
    const missing = SLOTS.filter((s) => !have.has(s));
    if (missing.length && !confirmMissing) {
      setConfirmMissing(missing);
      return;
    }
    void send();
  }

  async function send() {
    setConfirmMissing(null);
    const payload = {
      data: cleanBank(data),
      files: (Object.entries(files) as [Slot, File][]).map(([slot, f]) => ({ slot, name: f.name, type: f.type, size: f.size })),
    };
    try {
      setStep("Saving details…");
      const res = await fetch(mode === "create" ? "/api/submissions" : `/api/submissions/${token}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.details) {
          const errs: Record<string, string> = {};
          for (const d of body.details as { path: string; message: string }[]) errs[d.path.replace(/^data\./, "")] = d.message;
          setErrors(errs);
        }
        throw new Error(body.error ?? "Submission failed");
      }
      const sb = browserClient();
      const uploads = body.uploads as { documentId: string; slot: Slot; path: string; token: string }[];
      for (const [i, u] of uploads.entries()) {
        setStep(`Uploading document ${i + 1} of ${uploads.length}…`);
        const file = files[u.slot]!;
        const up = await sb.storage.from("vendor-documents").uploadToSignedUrl(u.path, u.token, file, { contentType: file.type });
        if (up.error) throw new Error(`Upload failed for ${file.name}: ${up.error.message}`);
      }
      setStep("Starting verification…");
      const pr = await fetch(`/api/submissions/${body.token}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: uploads.map((u) => u.documentId) }),
      });
      const pb = await pr.json();
      if (!pr.ok) throw new Error(pb.error ?? "Could not start processing");
      if (mode === "revise") {
        setStep(null);
        setFiles({});
        onDone?.();
      } else {
        router.push(reviewer ? `/runs/${pb.runId}` : `/v/${body.token}`);
      }
    } catch (err) {
      setStep(null);
      setFormError(err instanceof Error ? err.message : "Something went wrong");
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const busy = step !== null;

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-lg border border-line bg-surface">
      <div ref={topRef} />
      {samples && samples.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-line bg-canvas px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <span className="font-medium">Test vendors</span>
            <span className="ml-2 text-muted">{sampleNote ?? "Fills the form and attaches real test PDFs (reviewer only)."}</span>
          </div>
          <select
            className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm"
            defaultValue=""
            onChange={(e) => e.target.value && loadSample(e.target.value)}
            aria-label="Load a test vendor"
          >
            <option value="" disabled>Load test case…</option>
            {samples.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      )}

      {formError && (
        <div role="alert" className="flex gap-2 border-b border-line bg-danger-soft px-4 py-3 text-sm text-danger">
          <Alert className="mt-[3px] shrink-0" /> {formError}
        </div>
      )}

      <Section title="Company" description="Exactly as registered with the authorities.">
        <Input label="Legal company name" value={data.legal_name} onChange={(v) => set({ legal_name: v })} error={errors.legal_name} autoComplete="organization" />
        <Input label="Trading name" optional value={data.trading_name ?? ""} onChange={(v) => set({ trading_name: v })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Country of registration"
            value={data.country}
            onChange={(v) => set({ country: v as Country, bank: { ...data.bank, bank_country: v as Country } })}
            options={COUNTRY_LIST.map((x) => ({ value: x.code, label: x.name }))}
          />
          <Input label="Company registration number" value={data.registration_number} onChange={(v) => set({ registration_number: v })} error={errors.registration_number} mono />
        </div>
        <Input label="Registered address" value={data.address} onChange={(v) => set({ address: v })} error={errors.address} autoComplete="street-address" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Contact name" value={data.contact_name} onChange={(v) => set({ contact_name: v })} error={errors.contact_name} autoComplete="name" />
          <Input label="Contact email" type="email" value={data.contact_email} onChange={(v) => set({ contact_email: v })} error={errors.contact_email} autoComplete="email" />
        </div>
      </Section>

      <Section title="Tax registration" description={`${c.name} vendors provide their ${c.taxIdLabel}.`}>
        <Input
          label={c.taxIdLabel}
          value={data.tax_id}
          onChange={(v) => set({ tax_id: v })}
          error={errors.tax_id}
          mono
          placeholder={c.taxIdExample}
          hint={
            tax == null ? (
              c.taxIdHint
            ) : tax.valid ? (
              <span className="inline-flex items-center gap-1 text-accent"><Check className="size-3.5" /> Valid {c.taxIdLabel} format and checksum</span>
            ) : (
              <span className="text-warn">{tax.reason} You can still submit; it will be flagged for correction.</span>
            )
          }
        />
      </Section>

      <Section title="Bank account" description="Payments go to this account. The holder must be the company itself.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Account holder name" value={data.bank.account_holder} onChange={(v) => setBank({ account_holder: v })} error={errors["bank.account_holder"]} />
          <Input label="Bank name" optional value={data.bank.bank_name ?? ""} onChange={(v) => setBank({ bank_name: v })} />
        </div>
        <Select
          label="Bank country"
          value={data.bank.bank_country}
          onChange={(v) => setBank({ bank_country: v as Country })}
          options={COUNTRY_LIST.map((x) => ({ value: x.code, label: x.name }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {bankC.bankFields.includes("account_number") && <Input label="Account number" value={data.bank.account_number ?? ""} onChange={(v) => setBank({ account_number: v })} error={errors["bank.account_number"]} mono inputMode="numeric" />}
          {bankC.bankFields.includes("ifsc") && <Input label="IFSC" value={data.bank.ifsc ?? ""} onChange={(v) => setBank({ ifsc: v })} error={errors["bank.ifsc"]} mono placeholder="HDFC0001234" />}
          {bankC.bankFields.includes("routing_number") && <Input label="ABA routing number" value={data.bank.routing_number ?? ""} onChange={(v) => setBank({ routing_number: v })} error={errors["bank.routing_number"]} mono inputMode="numeric" />}
          {bankC.bankFields.includes("iban") && <Input label="IBAN" value={data.bank.iban ?? ""} onChange={(v) => setBank({ iban: v })} error={errors["bank.iban"]} mono />}
          {bankC.bankFields.includes("bic") && <Input label="BIC / SWIFT" optional value={data.bank.bic ?? ""} onChange={(v) => setBank({ bic: v })} mono />}
        </div>
      </Section>

      <Section
        title="Documents"
        description="PDF, PNG or JPEG, up to 10 MB each. All three are required to complete verification."
      >
        {demoFiles && demoFiles.length > 0 && (
          <Button type="button" size="sm" className="self-start" onClick={attachDemoFiles}>
            Attach test {demoFiles.length > 1 ? "files" : "file"} ({demoFiles.map((f) => f.name).join(", ")})
          </Button>
        )}
        {SLOTS.map((slot) => (
          <FileSlot
            key={slot}
            label={c.documents[slot].label}
            hint={c.documents[slot].hint}
            file={files[slot]}
            existing={existingDocs.find((d) => d.slot === slot)?.file_name}
            requested={requestedSlots.includes(slot)}
            error={errors[`file.${slot}`]}
            onChange={(f) => setFiles((x) => ({ ...x, [slot]: f }))}
          />
        ))}
      </Section>

      <div className="sticky bottom-0 flex flex-col gap-3 rounded-b-lg border-t border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="hidden text-xs text-muted sm:block">
          {mode === "create" ? "We verify your details against your documents. You can follow progress and fix anything from the link you get next." : "Only changed details and new documents are needed. Previously verified items stay on file."}
        </p>
        <Button type="submit" variant="primary" disabled={busy} className="sm:min-w-[180px]">
          {step ?? (mode === "create" ? "Submit for verification" : "Resubmit")}
        </Button>
      </div>

      {confirmMissing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4" role="dialog" aria-modal="true" aria-labelledby="missing-title">
          <div className="anim-dialog w-full max-w-md rounded-lg bg-surface p-6 shadow-overlay">
            <h3 id="missing-title" className="text-md font-semibold">Submit without all documents?</h3>
            <p className="mt-2 text-sm text-ink-2">These are missing, so verification cannot complete until you provide them:</p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {confirmMissing.map((s) => <li key={s}>{c.documents[s].label}</li>)}
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" onClick={() => setConfirmMissing(null)}>Add documents</Button>
              <Button type="button" variant="primary" onClick={() => void send()}>Submit anyway</Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-b border-line px-4 py-6 lg:grid-cols-[220px_1fr] lg:gap-8">
      <div>
        <legend className="font-semibold">{title}</legend>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </fieldset>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  hint,
  optional,
  mono,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  mono?: boolean;
} & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-help` : undefined}
        className={`t-colors h-9 w-full rounded-md border bg-surface px-3 text-base placeholder:text-muted/70 ${mono ? "mono" : ""} ${error ? "border-danger" : "border-line-strong hover:border-muted"}`}
        {...rest}
      />
      {(error || hint) && (
        <div id={`${id}-help`} className={`mt-1 text-xs ${error ? "text-danger" : "text-muted"}`}>{error ?? hint}</div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-base">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FileSlot({
  label,
  hint,
  file,
  existing,
  requested,
  error,
  onChange,
}: {
  label: string;
  hint: string;
  file?: File;
  existing?: string;
  requested?: boolean;
  error?: string;
  onChange: (f: File | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onChange(f);
      }}
      className={`t-colors flex flex-col gap-3 rounded-md border px-3 py-3 sm:flex-row sm:items-center ${
        error ? "border-danger" : requested ? "border-warn bg-warn-soft" : drag ? "border-accent bg-accent-soft" : "border-line-strong border-dashed"
      }`}
    >
      <FileIcon className="hidden shrink-0 text-muted sm:block" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {label} {requested && <span className="ml-1 text-xs font-medium text-warn">Requested</span>}
        </div>
        {file ? (
          <div className="mono truncate text-xs text-ink-2">{file.name} · {fmtBytes(file.size)}</div>
        ) : existing ? (
          <div className="truncate text-xs text-muted">On file: <span className="mono">{existing}</span>{requested ? ": please replace" : ""}</div>
        ) : (
          <div className="text-xs text-muted">{hint}</div>
        )}
        {error && <div className="text-xs text-danger">{error}</div>}
      </div>
      <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="sr-only" onChange={(e) => onChange(e.target.files?.[0])} aria-label={`Upload ${label}`} />
      <div className="flex gap-2">
        {file && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)}>Remove</Button>
        )}
        <Button type="button" size="sm" onClick={() => ref.current?.click()}>
          <Upload className="size-3.5" /> {file || existing ? "Replace" : "Choose file"}
        </Button>
      </div>
    </div>
  );
}
