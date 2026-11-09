"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SAMPLE_CASES } from "@/lib/samples";
import { Plus } from "./icons";
import { Button, inputClass } from "./ui";

const EMPTY = { company_name: "", contact_name: "", contact_email: "", contact_phone: "", city: "", supplies: "", source: "" };

export function NewVendorButton({ myEmail, variant = "primary", label = "New vendor" }: { myEmail: string; variant?: "primary" | "secondary"; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(EMPTY);
  const [send, setSend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY, val: string) => {
    setV((x) => ({ ...x, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/vendors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...v, invite: true, send }) });
    const body = await res.json();
    if (!res.ok) {
      const errs: Record<string, string> = {};
      for (const d of (body.details ?? []) as { path: string; message: string }[]) errs[d.path] = d.message;
      setErrors(errs);
      setError(body.error);
      setBusy(false);
      return;
    }
    router.push(`/vendors/${body.id}${body.link?.email?.status === "failed" ? "?email=failed" : ""}`);
  }

  const field = (k: keyof typeof EMPTY, label: string, props: React.ComponentProps<"input"> = {}) => (
    <div>
      <label htmlFor={`nv-${k}`} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={`nv-${k}`} value={v[k]} onChange={(e) => set(k, e.target.value)} className={`${inputClass} ${errors[k] ? "border-danger" : ""}`} {...props} />
      {errors[k] && <p className="mt-1 text-xs text-danger">{errors[k]}</p>}
    </div>
  );

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="size-3.5" /> {label}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/20 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="nv-title" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <form onSubmit={submit} className="anim-dialog max-h-full w-full max-w-[520px] overflow-y-auto rounded-[10px] bg-surface shadow-overlay">
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 id="nv-title" className="font-semibold">Add a vendor</h2>
                <p className="text-sm text-muted">Creates the vendor record and their personal onboarding link.</p>
              </div>
              <select
                aria-label="Fill with a demo vendor"
                defaultValue=""
                className="h-8 max-w-[150px] rounded-md border border-line-strong bg-surface px-2 text-xs text-ink-2"
                onChange={(e) => {
                  const s = SAMPLE_CASES.find((x) => x.id === e.target.value);
                  if (s) setV({ ...s.vendor, contact_email: myEmail, source: "Demo" });
                }}
              >
                <option value="" disabled>Demo vendor…</option>
                {SAMPLE_CASES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </header>
            <div className="grid gap-4 px-5 py-5">
              {field("company_name", "Company name", { autoFocus: true, placeholder: "As the vendor calls itself" })}
              <div className="grid gap-4 sm:grid-cols-2">
                {field("contact_name", "Contact person")}
                {field("contact_phone", "Mobile", { placeholder: "+91 98xxx xxxxx", inputMode: "tel" })}
              </div>
              {field("contact_email", "Contact email", { type: "email", placeholder: "Where the onboarding link goes" })}
              <div className="grid gap-4 sm:grid-cols-2">
                {field("city", "City")}
                {field("source", "Source", { placeholder: "Referral, trade fair…" })}
              </div>
              {field("supplies", "What they supply")}
              <label className="flex cursor-pointer items-start gap-2 rounded-md bg-subtle px-3 py-3 text-sm">
                <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} className="mt-1 accent-[var(--color-accent)]" />
                <span>
                  <span className="font-medium">Email the onboarding link now</span>
                  <span className="block text-muted">Untick to create the link and send it later from the vendor page.</span>
                </span>
              </label>
              {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            </div>
            <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
              <Button type="button" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={busy || !v.company_name.trim()}>
                {busy ? "Creating…" : send ? "Create and send link" : "Create vendor"}
              </Button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
