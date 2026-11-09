import { z } from "zod";
import { isCompany } from "@/lib/india";
import {
  normalizePhone,
  validateAccountNumber,
  validateCin,
  validateGstin,
  validateIfsc,
  validateLlpin,
  validatePan,
  validatePincode,
  validateUdyam,
} from "@/lib/rules/validators";

const text = (min: number, max: number, label: string) => z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long`);
const opt = (max: number) => z.string().trim().max(max).optional().default("");
const upper = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");

export const CONSTITUTION_VALUES = ["private_limited", "public_limited", "opc", "llp", "partnership", "proprietorship"] as const;

/**
 * Submission schema. Only structurally impossible input is rejected here (empty, wrong length,
 * wrong characters). Checksums, cross-document conflicts and registry checks are judged by the
 * verification engine so the vendor gets a reasoned correction request, not a blocked form.
 */
export const submissionDataSchema = z
  .object({
    legal_name: text(2, 160, "Legal name"),
    trade_name: opt(160),
    constitution: z.enum(CONSTITUTION_VALUES, { message: "Select the business type" }),
    cin: opt(30).transform(upper),
    llpin: opt(12).transform((s) => s.toUpperCase().replace(/\s/g, "")),
    udyam: opt(30).transform((s) => s.toUpperCase().replace(/\s/g, "")),
    supplies: opt(300),
    address_line: text(5, 300, "Registered address"),
    city: text(2, 80, "City"),
    state: z.string().regex(/^\d{2}$/, "Select the state"),
    pincode: z.string().trim().refine((v) => validatePincode(v).valid, "PIN code must be 6 digits and cannot start with 0"),
    contact_name: text(2, 120, "Contact name"),
    designation: opt(80),
    contact_email: z.string().trim().toLowerCase().email("Enter a valid email address").max(160),
    contact_phone: z
      .string()
      .trim()
      .refine((v) => normalizePhone(v).valid, "Enter a 10-digit Indian mobile number starting with 6–9")
      .transform((v) => normalizePhone(v).normalized),
    gstin: z.string().transform(upper).refine((v) => v.length === 15, "GSTIN must be exactly 15 characters"),
    pan: z.string().transform(upper).refine((v) => /^[A-Z]{5}\d{4}[A-Z]$/.test(v), "PAN must be 5 letters, 4 digits, 1 letter"),
    bank: z.object({
      account_holder: text(2, 160, "Account holder name"),
      account_number: z.string().transform((v) => v.replace(/\s/g, "")).refine((v) => /^\d{9,18}$/.test(v), "Account number must be 9–18 digits"),
      ifsc: z.string().transform(upper).refine((v) => v.length === 11, "IFSC must be 11 characters"),
      bank_name: opt(120),
      branch: opt(120),
      account_type: z.enum(["current", "savings"]).default("current"),
    }),
  })
  .superRefine((d, ctx) => {
    if (isCompany(d.constitution) && !d.cin) ctx.addIssue({ code: "custom", path: ["cin"], message: "CIN is required for companies" });
    if (d.constitution === "llp" && !d.llpin) ctx.addIssue({ code: "custom", path: ["llpin"], message: "LLPIN is required for LLPs" });
  });

export type SubmissionInput = z.input<typeof submissionDataSchema>;

/** Live, field-level hints for the form (format checks only). */
export function fieldHint(field: string, value: string): { ok: boolean; message: string } | null {
  if (!value?.trim()) return null;
  const map: Record<string, (v: string) => { valid: boolean; reason?: string }> = {
    gstin: validateGstin,
    pan: validatePan,
    ifsc: validateIfsc,
    account_number: validateAccountNumber,
    cin: validateCin,
    llpin: validateLlpin,
    udyam: validateUdyam,
    pincode: validatePincode,
    contact_phone: (v) => normalizePhone(v),
  };
  const fn = map[field];
  if (!fn) return null;
  const r = fn(value);
  return r.valid ? { ok: true, message: "Format looks right" } : { ok: false, message: r.reason ?? "Invalid format" };
}

export const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const fileMetaSchema = z.object({
  slot: z.enum(["gst_certificate", "pan_card", "bank_proof", "incorporation_certificate", "msme_certificate"]),
  name: z.string().trim().min(1).max(200),
  type: z.enum(ALLOWED_MIME, { message: "Only PDF, PNG or JPEG files are accepted" }),
  size: z.number().int().positive().max(MAX_FILE_BYTES, "Files must be 10 MB or smaller"),
});

export const vendorSchema = z.object({
  company_name: text(2, 160, "Company name"),
  contact_name: opt(120),
  contact_email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email address")]).default(""),
  contact_phone: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || normalizePhone(v).valid, "Enter a 10-digit Indian mobile number")
    .transform((v) => (v ? normalizePhone(v).normalized : "")),
  city: opt(80),
  supplies: opt(300),
  source: opt(60),
  notes: opt(2000),
});

export const decisionSchema = z.object({
  action: z.enum(["approve", "reject", "request_info"]),
  note: z.string().trim().min(10, "Note must be at least 10 characters").max(2000),
  acknowledged: z.array(z.string()).default([]),
  notify: z.boolean().default(true),
  items: z
    .array(z.object({ code: z.string(), title: z.string(), action: z.string().min(5), slot: z.string().optional(), field: z.string().optional() }))
    .optional(),
});
