import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { REC_LABEL, STATUS_LABEL } from "./format";

type Tone = "accent" | "warn" | "danger" | "neutral" | "live";

const TONE: Record<Tone, { chip: string; dot: string }> = {
  accent: { chip: "bg-accent-soft text-accent", dot: "bg-accent" },
  warn: { chip: "bg-warn-soft text-warn", dot: "bg-warn" },
  danger: { chip: "bg-danger-soft text-danger", dot: "bg-danger" },
  neutral: { chip: "bg-neutral-soft text-ink-2", dot: "bg-muted" },
  live: { chip: "bg-neutral-soft text-ink", dot: "bg-ink anim-pulse" },
};

export function toneFor(status: string | null | undefined): Tone {
  switch (status) {
    case "approved":
    case "approve":
    case "passed":
    case "completed":
    case "pass":
      return "accent";
    case "awaiting_review":
    case "awaiting_vendor":
    case "pending":
    case "warning":
    case "warn":
      return "warn";
    case "rejected":
    case "reject":
    case "failed":
    case "error":
    case "fail":
      return "danger";
    case "processing":
    case "running":
      return "live";
    default:
      return "neutral";
  }
}

export function Chip({ tone, children, className = "" }: { tone: Tone; children: ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <span className={`t-state inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium ${t.chip} ${className}`}>
      <span className={`size-1.5 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  return <Chip tone={toneFor(status)}>{STATUS_LABEL[status] ?? status}</Chip>;
}

export function RecChip({ rec }: { rec: string | null | undefined }) {
  if (!rec) return <span className="text-sm text-muted">-</span>;
  return <Chip tone={toneFor(rec)}>{REC_LABEL[rec] ?? rec}</Chip>;
}

const BTN = {
  primary: "bg-accent text-white hover:bg-accent-hover border border-accent",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-neutral-soft",
  danger: "bg-surface text-danger border border-line-strong hover:bg-danger-soft",
  ghost: "text-ink-2 hover:bg-neutral-soft border border-transparent",
};

export function buttonClass(variant: keyof typeof BTN = "secondary", size: "md" | "sm" = "md") {
  return `t-colors inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
    size === "md" ? "h-9 px-4 text-base" : "h-8 px-3 text-sm"
  } ${BTN[variant]}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BTN; size?: "md" | "sm" }) {
  return <button {...props} className={`${buttonClass(variant, size)} ${className}`} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof BTN; size?: "md" | "sm" }) {
  return <Link {...props} className={`${buttonClass(variant, size)} ${className}`} />;
}

export function Panel({
  title,
  meta,
  children,
  className = "",
  bodyClass = "",
}: {
  title?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-surface ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
          <h2 className="text-md font-semibold">{title}</h2>
          {meta && <div className="text-sm text-muted">{meta}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function PageHeader({ eyebrow, title, meta, actions }: { eyebrow?: ReactNode; title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-[0.04em] text-muted">{eyebrow}</div>}
        <h1 className="truncate text-lg font-semibold">{title}</h1>
        {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="font-medium">{title}</div>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,140px)_1fr] gap-4 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
