export function shortId(id: string) {
  return id.slice(0, 8);
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDuration(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return "-";
  const ms = (end ? Date.parse(end) : Date.now()) - Date.parse(start);
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} m ${Math.round((ms % 60_000) / 1000)} s`;
}

export function fmtAge(iso: string) {
  const ms = Date.now() - Date.parse(iso);
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  processing: "Processing",
  awaiting_vendor: "Awaiting vendor",
  awaiting_review: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
  error: "Processing error",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  pending: "Pending",
  passed: "Passed",
  warning: "Needs attention",
  skipped: "Skipped",
};

export const REC_LABEL: Record<string, string> = {
  approve: "Approve",
  pending: "Pending",
  reject: "Reject",
};
