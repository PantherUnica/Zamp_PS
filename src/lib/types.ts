export type Constitution = "private_limited" | "public_limited" | "opc" | "llp" | "partnership" | "proprietorship";
export type Slot = "gst_certificate" | "pan_card" | "bank_proof" | "incorporation_certificate" | "msme_certificate";
export const SLOTS: Slot[] = ["gst_certificate", "pan_card", "bank_proof", "incorporation_certificate", "msme_certificate"];
export type Role = "sales" | "reviewer" | "admin";

export interface BankDetails {
  account_holder: string;
  account_number: string;
  ifsc: string;
  bank_name?: string;
  branch?: string;
  account_type: "current" | "savings";
}

/** What the vendor submits. India only. */
export interface SubmissionData {
  legal_name: string;
  trade_name?: string;
  constitution: Constitution;
  cin?: string;
  llpin?: string;
  udyam?: string;
  supplies?: string;
  address_line: string;
  city: string;
  state: string; // GST state code, e.g. "29"
  pincode: string;
  contact_name: string;
  designation?: string;
  contact_email: string;
  contact_phone: string;
  gstin: string;
  pan: string;
  bank: BankDetails;
}

export type Severity = "info" | "fixable" | "review" | "block";
export type Recommendation = "approve" | "pending" | "reject";
export type StageKey = "intake" | "read" | "validate" | "crosscheck" | "external" | "risk" | "decide" | "communicate";
export type StageStatus = "pending" | "running" | "passed" | "warning" | "failed" | "skipped" | "error";
export type CheckStatus = "pass" | "warn" | "fail" | "skip";
/**
 * Where a check's evidence comes from. Only "external" means a record outside this system
 * was consulted. Format checks prove a value is well-formed, not that it exists.
 */
export type CheckSource = "format" | "document" | "external" | "internal" | "rules";

export interface Evidence {
  label: string;
  value: string;
}

export interface Finding {
  code: string;
  severity: Severity;
  stage: StageKey;
  title: string;
  detail: string;
  field?: string;
  slot?: Slot;
  evidence?: Evidence[];
  /** Plain-language instruction shown to the vendor when the finding is vendor-fixable. */
  vendorAction?: string;
}

export interface Check {
  id: string;
  stage: StageKey;
  source: CheckSource;
  label: string;
  status: CheckStatus;
  detail: string;
  evidence?: Evidence[];
}

export const EXTRACT_FIELDS = [
  "legal_name",
  "trade_name",
  "gstin",
  "pan",
  "cin",
  "llpin",
  "udyam",
  "address",
  "state",
  "account_holder",
  "account_number",
  "ifsc",
  "bank_name",
  "issue_date",
  "expiry_date",
] as const;
export type ExtractField = (typeof EXTRACT_FIELDS)[number];

export interface ExtractedValue {
  value: string | null;
  confidence: number;
}

export type DocType = Slot | "other";

export interface Extraction {
  document_id: string;
  slot: Slot;
  file_name: string;
  document_type: DocType;
  type_confidence: number;
  readability: "clear" | "partially_readable" | "unreadable";
  fields: Record<ExtractField, ExtractedValue>;
  embedded_instructions: { detected: boolean; text: string | null };
  notes: string;
  error?: string;
}

export interface DuplicateHit {
  ref: string;
  legal_name: string;
  status: string;
  matched_on: "gstin" | "pan" | "bank_account";
}

export interface RunResult {
  extractions: Extraction[];
  checks: Check[];
  findings: Finding[];
  recommendation: Recommendation;
  route: "awaiting_vendor" | "awaiting_review";
  reasons: string[];
  summary: string;
}

export interface StageDef {
  key: StageKey;
  label: string;
  kind: "rules" | "ai" | "external";
}

export const STAGES: StageDef[] = [
  { key: "intake", label: "Intake and completeness", kind: "rules" },
  { key: "read", label: "Document reading", kind: "ai" },
  { key: "validate", label: "Format validation", kind: "rules" },
  { key: "crosscheck", label: "Document cross-checks", kind: "rules" },
  { key: "external", label: "External records", kind: "external" },
  { key: "risk", label: "Risk and duplicates", kind: "rules" },
  { key: "decide", label: "Decision rules", kind: "rules" },
  { key: "communicate", label: "Routing and communication", kind: "rules" },
];

export type SubmissionStatus =
  | "draft"
  | "processing"
  | "awaiting_vendor"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "error";

/** Structured output of a call-transcript analysis. */
export interface CallAnalysis {
  summary: string;
  vendor: Record<
    "company_name" | "contact_name" | "designation" | "contact_email" | "contact_phone" | "city" | "state" | "gstin" | "pan" | "supplies",
    { value: string | null; evidence: string | null }
  >;
  requirements: string[];
  action_items: { task: string; owner: "us" | "vendor"; due: string | null }[];
  follow_up: { date: string | null; timeline: string | null };
  intelligence: {
    score: number;
    signal: "strong" | "moderate" | "nurture" | "weak";
    signal_reason: string;
    interest_level: "high" | "medium" | "low";
    sentiment: "positive" | "neutral" | "cautious" | "negative";
    readiness: "exploring" | "evaluating" | "ready_to_onboard" | "blocked";
    objections: string[];
    objection_category: string | null;
    key_concern_quote: string | null;
    rep_insight: string;
    next_step: string;
  };
  risk_signals: { signal: string; quote: string | null }[];
}
