export type Country = "IN" | "US" | "GB" | "DE";
export type Slot = "tax_certificate" | "bank_proof" | "incorporation_certificate";
export const SLOTS: Slot[] = ["tax_certificate", "bank_proof", "incorporation_certificate"];

export interface BankDetails {
  account_holder: string;
  bank_name?: string;
  bank_country: Country;
  account_number?: string; // IN, US
  ifsc?: string; // IN
  routing_number?: string; // US
  iban?: string; // GB, DE
  bic?: string; // GB, DE (optional)
}

export interface SubmissionData {
  legal_name: string;
  trading_name?: string;
  country: Country;
  registration_number: string;
  tax_id: string;
  address: string;
  contact_name: string;
  contact_email: string;
  bank: BankDetails;
}

export type Severity = "info" | "fixable" | "review" | "block";
export type Recommendation = "approve" | "pending" | "reject";
export type StageKey = "intake" | "read" | "validate" | "crosscheck" | "risk" | "decide" | "communicate";
export type StageStatus = "pending" | "running" | "passed" | "warning" | "failed" | "skipped" | "error";
export type CheckStatus = "pass" | "warn" | "fail" | "skip";

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
  label: string;
  status: CheckStatus;
  detail: string;
  evidence?: Evidence[];
}

export const EXTRACT_FIELDS = [
  "legal_name",
  "tax_id",
  "registration_number",
  "country",
  "address",
  "account_holder",
  "account_number",
  "iban",
  "ifsc",
  "routing_number",
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
  matched_on: "tax_id" | "bank_account";
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
  kind: "rules" | "ai" | "rules+ai";
}

export const STAGES: StageDef[] = [
  { key: "intake", label: "Intake and completeness", kind: "rules" },
  { key: "read", label: "Document classification and extraction", kind: "ai" },
  { key: "validate", label: "Format validation", kind: "rules" },
  { key: "crosscheck", label: "Cross-checks", kind: "rules" },
  { key: "risk", label: "Risk and duplicates", kind: "rules" },
  { key: "decide", label: "Decision rules", kind: "rules" },
  { key: "communicate", label: "Routing and vendor communication", kind: "rules" },
];

export type SubmissionStatus =
  | "draft"
  | "processing"
  | "awaiting_vendor"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "error";
