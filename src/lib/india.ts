import type { Constitution, Slot } from "@/lib/types";

/** GST state codes (first two digits of a GSTIN) and the first digit of that state's PIN codes. */
export const STATES: { code: string; name: string; pin: number[] }[] = [
  { code: "01", name: "Jammu and Kashmir", pin: [1] },
  { code: "02", name: "Himachal Pradesh", pin: [1] },
  { code: "03", name: "Punjab", pin: [1] },
  { code: "04", name: "Chandigarh", pin: [1] },
  { code: "05", name: "Uttarakhand", pin: [2] },
  { code: "06", name: "Haryana", pin: [1] },
  { code: "07", name: "Delhi", pin: [1] },
  { code: "08", name: "Rajasthan", pin: [3] },
  { code: "09", name: "Uttar Pradesh", pin: [2] },
  { code: "10", name: "Bihar", pin: [8] },
  { code: "11", name: "Sikkim", pin: [7] },
  { code: "12", name: "Arunachal Pradesh", pin: [7] },
  { code: "13", name: "Nagaland", pin: [7] },
  { code: "14", name: "Manipur", pin: [7] },
  { code: "15", name: "Mizoram", pin: [7] },
  { code: "16", name: "Tripura", pin: [7] },
  { code: "17", name: "Meghalaya", pin: [7] },
  { code: "18", name: "Assam", pin: [7] },
  { code: "19", name: "West Bengal", pin: [7] },
  { code: "20", name: "Jharkhand", pin: [8] },
  { code: "21", name: "Odisha", pin: [7] },
  { code: "22", name: "Chhattisgarh", pin: [4] },
  { code: "23", name: "Madhya Pradesh", pin: [4] },
  { code: "24", name: "Gujarat", pin: [3] },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu", pin: [3] },
  { code: "27", name: "Maharashtra", pin: [4] },
  { code: "29", name: "Karnataka", pin: [5] },
  { code: "30", name: "Goa", pin: [4] },
  { code: "31", name: "Lakshadweep", pin: [6] },
  { code: "32", name: "Kerala", pin: [6] },
  { code: "33", name: "Tamil Nadu", pin: [6] },
  { code: "34", name: "Puducherry", pin: [6] },
  { code: "35", name: "Andaman and Nicobar Islands", pin: [7] },
  { code: "36", name: "Telangana", pin: [5] },
  { code: "37", name: "Andhra Pradesh", pin: [5] },
  { code: "38", name: "Ladakh", pin: [1] },
];

export const stateByCode = (code: string | null | undefined) => STATES.find((s) => s.code === code);
export const stateName = (code: string | null | undefined) => stateByCode(code)?.name ?? code ?? "-";

export const CONSTITUTIONS: { value: Constitution; label: string; panType: string; panTypeLabel: string }[] = [
  { value: "private_limited", label: "Private Limited Company", panType: "C", panTypeLabel: "company" },
  { value: "public_limited", label: "Public Limited Company", panType: "C", panTypeLabel: "company" },
  { value: "opc", label: "One Person Company", panType: "C", panTypeLabel: "company" },
  { value: "llp", label: "Limited Liability Partnership", panType: "F", panTypeLabel: "firm / LLP" },
  { value: "partnership", label: "Partnership Firm", panType: "F", panTypeLabel: "firm / LLP" },
  { value: "proprietorship", label: "Sole Proprietorship", panType: "P", panTypeLabel: "individual" },
];
export const constitution = (v: string | null | undefined) => CONSTITUTIONS.find((c) => c.value === v);
export const isCompany = (c: Constitution) => c === "private_limited" || c === "public_limited" || c === "opc";

export const DOCS: Record<Slot, { label: string; hint: string }> = {
  gst_certificate: { label: "GST registration certificate", hint: "Form GST REG-06, all pages" },
  pan_card: { label: "PAN card of the business", hint: "Company / firm PAN (proprietor's PAN for proprietorships)" },
  bank_proof: { label: "Cancelled cheque or bank letter", hint: "Must show account holder name, account number and IFSC" },
  incorporation_certificate: { label: "Certificate of incorporation / registration", hint: "MCA certificate, LLP certificate or registered partnership deed" },
  msme_certificate: { label: "Udyam (MSME) certificate", hint: "Only if you are registered as an MSME" },
};

/** Which documents are mandatory for a given constitution. */
export function requiredSlots(c: Constitution | undefined): Slot[] {
  const base: Slot[] = ["gst_certificate", "pan_card", "bank_proof"];
  if (!c || c === "proprietorship") return base;
  return [...base, "incorporation_certificate"];
}

export const ACCOUNT_TYPES = [
  { value: "current", label: "Current account" },
  { value: "savings", label: "Savings account" },
] as const;
