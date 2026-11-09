export const shortId = (id: string) => id.slice(0, 8);

const TZ = "Asia/Kolkata";

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ });
}

export function fmtDuration(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return "-";
  const ms = (end ? Date.parse(end) : Date.now()) - Date.parse(start);
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} m ${Math.round((ms % 60_000) / 1000)} s`;
}

export function fmtAge(iso: string | null | undefined) {
  if (!iso) return "-";
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function initials(name: string | null | undefined) {
  return (name || "?")
    .replace(/\b(pvt|private|ltd|limited|llp|inc)\b\.?/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  processing: "Verifying",
  awaiting_vendor: "Waiting on vendor",
  awaiting_review: "In review",
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
  sent: "Sent",
  sending: "Sending",
  discarded: "Discarded",
  open: "Open",
  resolved: "Resolved",
  analysing: "Analysing",
  done: "Analysed",
};

export const REC_LABEL: Record<string, string> = { approve: "Ready for approval", pending: "Needs attention", reject: "Recommend reject" };

export const EMAIL_KIND_LABEL: Record<string, string> = {
  invite: "Onboarding invite",
  submission_received: "Submission received",
  correction_request: "Correction request",
  decision_approved: "Approval notice",
  decision_rejected: "Rejection notice",
  staff_vendor_submitted: "Vendor submitted",
  staff_action_needed: "Action needed",
  teammate_invite: "Teammate invite",
  custom: "Email",
};
