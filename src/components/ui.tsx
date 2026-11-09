import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/vendor-stage";
import { REC_LABEL, STATUS_LABEL } from "./format";

export type { Tone };

const TONE: Record<Tone, { chip: string; dot: string }> = {
  ok: { chip: "bg-ok-soft text-ok", dot: "bg-ok" },
  attention: { chip: "bg-accent-soft text-accent", dot: "bg-accent" },
  danger: { chip: "bg-danger-soft text-danger", dot: "bg-danger" },
  neutral: { chip: "bg-subtle text-ink-2", dot: "bg-muted" },
  live: { chip: "bg-subtle text-ink", dot: "bg-accent anim-pulse" },
};

export function toneFor(status: string | null | undefined): Tone {
  switch (status) {
    case "approved":
    case "passed":
    case "completed":
    case "pass":
    case "sent":
    case "done":
    case "resolved":
      return "ok";
    case "awaiting_review":
    case "awaiting_vendor":
    case "approve":
    case "pending":
    case "warning":
    case "warn":
    case "draft":
    case "open":
      return "attention";
    case "rejected":
    case "reject":
    case "failed":
    case "error":
    case "fail":
      return "danger";
    case "processing":
    case "running":
    case "sending":
    case "analysing":
      return "live";
    default:
      return "neutral";
  }
}

export function Chip({ tone, children, className = "" }: { tone: Tone; children: ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <span className={`t-state inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium ${t.chip} ${className}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}

export const StatusChip = ({ status }: { status: string }) => <Chip tone={toneFor(status)}>{STATUS_LABEL[status] ?? status}</Chip>;

export function RecChip({ rec }: { rec: string | null | undefined }) {
  if (!rec) return <span className="text-sm text-muted">-</span>;
  return <Chip tone={rec === "reject" ? "danger" : "attention"}>{REC_LABEL[rec] ?? rec}</Chip>;
}

/** Small "where this evidence comes from" tag used across verification screens. */
export function SourceTag({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    format: { label: "Format", cls: "border-line-strong text-ink-2" },
    document: { label: "Document", cls: "border-line-strong text-ink-2" },
    external: { label: "External record", cls: "border-ink text-ink" },
    internal: { label: "Our records", cls: "border-line-strong text-ink-2" },
    rules: { label: "Rules", cls: "border-line-strong text-ink-2" },
    not_connected: { label: "Not connected", cls: "border-dashed border-line-strong text-muted" },
  };
  const m = map[source] ?? map.rules;
  return <span className={`inline-flex h-5 items-center rounded border px-1.5 text-[11px] font-medium ${m.cls}`}>{m.label}</span>;
}

const BTN = {
  primary: "bg-accent text-white border border-accent hover:bg-accent-hover hover:border-accent-hover",
  dark: "bg-ink text-white border border-ink hover:bg-ink-2",
  secondary: "bg-transparent text-ink border border-ink/80 hover:bg-ink hover:text-white",
  danger: "bg-surface text-danger border border-line-strong hover:bg-danger-soft",
  ghost: "text-ink-2 border border-transparent hover:bg-subtle",
};

export function buttonClass(variant: keyof typeof BTN = "secondary", size: "md" | "sm" = "md") {
  return `t-colors inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold uppercase tracking-[0.01em] disabled:cursor-not-allowed disabled:opacity-40 ${size === "md" ? "h-10 px-5 text-[13px]" : "h-8 px-4 text-xs"} ${BTN[variant]}`;
}

export function Button({ variant = "secondary", size = "md", className = "", ...props }: ComponentProps<"button"> & { variant?: keyof typeof BTN; size?: "md" | "sm" }) {
  return <button {...props} className={`${buttonClass(variant, size)} ${className}`} />;
}

export function ButtonLink({ variant = "secondary", size = "md", className = "", ...props }: ComponentProps<typeof Link> & { variant?: keyof typeof BTN; size?: "md" | "sm" }) {
  return <Link {...props} className={`${buttonClass(variant, size)} ${className}`} />;
}

export function Panel({ title, meta, children, className = "", bodyClass = "", id }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-[10px] border border-line bg-surface ${className}`}>
      {title && (
        <header className="flex min-h-12 items-center justify-between gap-4 border-b border-line px-4 py-3">
          <h2 className="label flex items-center gap-2"><span className="size-2 rounded-full bg-ink" aria-hidden />{title}</h2>
          {meta && <div className="flex items-center gap-2 text-sm text-muted">{meta}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function PageHeader({ eyebrow, title, meta, actions }: { eyebrow?: ReactNode; title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-ink pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="label mb-2 text-muted">{eyebrow}</div>}
        <h1 className="display truncate text-[32px] sm:text-[40px]">{title}</h1>
        {meta && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="font-medium">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-[360px] text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Prop({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,132px)_1fr] gap-4 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={`min-w-0 break-words ${mono ? "mono text-[13px]" : ""}`}>{children || <span className="text-muted">-</span>}</dd>
    </div>
  );
}

export function Avatar({ text, size = 32 }: { text: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-md border border-line bg-subtle text-xs font-semibold text-ink-2" style={{ width: size, height: size }}>
      {text}
    </span>
  );
}

export const inputClass = "t-colors h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-base placeholder:text-muted/70 hover:border-muted";
