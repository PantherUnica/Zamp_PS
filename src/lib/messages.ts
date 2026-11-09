import type { Finding, SubmissionData } from "@/lib/types";

export interface RequestItem {
  code: string;
  title: string;
  action: string;
  slot?: string;
  field?: string;
}

/** Fields a vendor is allowed to change when answering a request for this finding. */
export function fieldsForFinding(f: Pick<Finding, "code" | "field" | "slot">): string[] {
  const out = new Set<string>();
  if (f.field) out.add(f.field.startsWith("bank") ? "bank" : f.field);
  switch (f.code) {
    case "NAME_MISMATCH":
      out.add("legal_name");
      break;
    case "BANK_NAME_MISMATCH":
    case "BANK_ACCOUNT_CONFLICT":
    case "BANK_DETAILS_INVALID":
    case "BANK_COUNTRY_MISMATCH":
    case "SHARED_IDENTIFIER":
      out.add("bank");
      break;
    case "TAX_ID_INVALID":
    case "TAX_ID_COUNTRY_MISMATCH":
    case "TAX_ID_DOCUMENT_CONFLICT":
    case "TAX_ID_ENTITY_CONFLICT":
      out.add("tax_id");
      break;
  }
  if (f.slot) out.add(f.slot);
  return [...out];
}

export function itemFromFinding(f: Finding): RequestItem {
  return {
    code: f.code,
    title: f.title,
    action: f.vendorAction ?? f.detail,
    slot: f.slot,
    field: f.field,
  };
}

/** Deterministic message: what is wrong, what to do. Never includes internal risk reasoning. */
export function composeRequestMessage(data: SubmissionData, ref: string, items: RequestItem[], note?: string): string {
  const lines = [
    `Hello ${data.contact_name},`,
    "",
    `Thank you for submitting ${data.legal_name} for vendor onboarding (reference ${ref}). We could not complete verification yet. Please fix the following:`,
    "",
    ...items.map((it, i) => `${i + 1}. ${it.action}`),
  ];
  if (note?.trim()) lines.push("", `Note from our procurement team: ${note.trim()}`);
  lines.push(
    "",
    "Reopen your submission with the secure link we sent you, make these changes and resubmit. Anything already verified does not need to be uploaded again.",
    "",
    "Vendor Onboarding Team",
  );
  return lines.join("\n");
}
