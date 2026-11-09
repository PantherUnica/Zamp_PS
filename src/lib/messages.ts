import type { Finding } from "@/lib/types";

export interface RequestItem {
  code: string;
  title: string;
  action: string;
  slot?: string;
  field?: string;
}

/** Fields a vendor is expected to change when answering a request for this finding. */
export function fieldsForFinding(f: Pick<Finding, "code" | "field" | "slot">): string[] {
  const out = new Set<string>();
  if (f.field) out.add(f.field.startsWith("bank") ? "bank" : f.field);
  switch (f.code) {
    case "NAME_MISMATCH":
    case "PAN_NAME_MISMATCH":
      out.add("legal_name");
      break;
    case "BANK_NAME_MISMATCH":
    case "BANK_ACCOUNT_CONFLICT":
    case "IFSC_DOCUMENT_CONFLICT":
    case "IFSC_INVALID":
    case "IFSC_NOT_FOUND":
    case "IFSC_BANK_MISMATCH":
    case "ACCOUNT_INVALID":
    case "SHARED_IDENTIFIER":
      out.add("bank");
      break;
    case "GSTIN_INVALID":
    case "GSTIN_STATE_MISMATCH":
    case "GSTIN_PAN_MISMATCH":
    case "GSTIN_DOCUMENT_CONFLICT":
      out.add("gstin");
      out.add("pan");
      break;
    case "PAN_INVALID":
    case "PAN_TYPE_MISMATCH":
    case "PAN_DOCUMENT_CONFLICT":
      out.add("pan");
      break;
  }
  if (f.slot) out.add(f.slot);
  return [...out];
}

export function itemFromFinding(f: Finding): RequestItem {
  return {
    code: f.code,
    title: f.title,
    action: f.vendorAction ?? `Please check and correct: ${f.title}. ${f.detail}`,
    slot: f.slot,
    field: f.field,
  };
}
