/**
 * A vendor's journey is derived from its onboarding submission — there is no separate stage
 * column to drift out of sync. Tone maps onto the status colours in the design system.
 */
export type Tone = "ok" | "attention" | "danger" | "neutral" | "live";

export interface SubmissionSnapshot {
  status: string;
  recommendation: string | null;
  link_sent_at: string | null;
  link_expires_at: string | null;
  draft_saved_at: string | null;
  submitted_at: string | null;
}

export interface StageInfo {
  key: string;
  label: string;
  tone: Tone;
  step: number; // 0 lead · 1 invited · 2 filling · 3 verifying · 4 decision · 5 done
}

export const JOURNEY = ["Lead", "Invited", "Filling form", "Verification", "Review", "Decision"];

export function vendorStage(s: SubmissionSnapshot | null | undefined, opts: { openRequest?: boolean; draftEmail?: boolean } = {}): StageInfo {
  if (!s) return { key: "lead", label: "Lead", tone: "neutral", step: 0 };
  const expired = s.link_expires_at ? Date.parse(s.link_expires_at) < Date.now() : false;
  switch (s.status) {
    case "draft":
      if (expired) return { key: "link_expired", label: "Link expired", tone: "attention", step: 1 };
      if (s.draft_saved_at) return { key: "filling", label: "Filling form", tone: "neutral", step: 2 };
      if (s.link_sent_at) return { key: "invited", label: "Invited", tone: "neutral", step: 1 };
      return { key: "link_ready", label: "Link not sent", tone: "attention", step: 1 };
    case "processing":
      return { key: "verifying", label: "Verifying", tone: "live", step: 3 };
    case "awaiting_vendor":
      if (!opts.openRequest && opts.draftEmail) return { key: "correction_draft", label: "Correction to send", tone: "attention", step: 3 };
      return { key: "needs_correction", label: "Waiting on vendor", tone: "attention", step: 2 };
    case "awaiting_review":
      if (s.recommendation === "approve") return { key: "ready", label: "Ready for approval", tone: "attention", step: 4 };
      if (s.recommendation === "reject") return { key: "high_risk", label: "Recommended reject", tone: "danger", step: 4 };
      return { key: "in_review", label: "Needs review", tone: "attention", step: 4 };
    case "approved":
      return { key: "approved", label: "Approved", tone: "ok", step: 5 };
    case "rejected":
      return { key: "rejected", label: "Rejected", tone: "danger", step: 5 };
    case "error":
      return { key: "error", label: "Processing error", tone: "danger", step: 3 };
    default:
      return { key: s.status, label: s.status, tone: "neutral", step: 0 };
  }
}

export const STAGE_FILTERS = [
  { key: "all", label: "All" },
  { key: "early", label: "Not submitted", match: ["lead", "link_ready", "invited", "filling", "link_expired"] },
  { key: "correction", label: "Corrections", match: ["needs_correction", "correction_draft"] },
  { key: "review", label: "In review", match: ["ready", "in_review", "high_risk", "verifying", "error"] },
  { key: "approved", label: "Approved", match: ["approved"] },
  { key: "rejected", label: "Rejected", match: ["rejected"] },
] as const;
