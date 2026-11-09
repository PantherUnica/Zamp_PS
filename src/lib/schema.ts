import { z } from "zod";
import { SLOTS } from "@/lib/types";

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long`);

const country = z.enum(["IN", "US", "GB", "DE"]);

export const bankSchema = z
  .object({
    account_holder: text(2, 160, "Account holder name"),
    bank_name: z.string().trim().max(120).optional().default(""),
    bank_country: country,
    account_number: z.string().trim().max(40).optional(),
    ifsc: z.string().trim().max(20).optional(),
    routing_number: z.string().trim().max(20).optional(),
    iban: z.string().trim().max(42).optional(),
    bic: z.string().trim().max(15).optional(),
  })
  .superRefine((b, ctx) => {
    const need = (k: keyof typeof b, label: string) => {
      if (!b[k]) ctx.addIssue({ code: "custom", path: [k], message: `${label} is required` });
    };
    if (b.bank_country === "IN") {
      need("account_number", "Account number");
      need("ifsc", "IFSC");
    } else if (b.bank_country === "US") {
      need("account_number", "Account number");
      need("routing_number", "Routing number");
    } else {
      need("iban", "IBAN");
    }
  });

export const submissionDataSchema = z.object({
  legal_name: text(2, 160, "Legal company name"),
  trading_name: z.string().trim().max(160).optional().default(""),
  country,
  registration_number: text(2, 60, "Registration number"),
  tax_id: text(5, 40, "Tax ID"),
  address: text(5, 300, "Registered address"),
  contact_name: text(2, 120, "Contact name"),
  contact_email: z.string().trim().email("Enter a valid email address").max(160),
  bank: bankSchema,
});

export const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const fileMetaSchema = z.object({
  slot: z.enum(SLOTS as [string, ...string[]]),
  name: z.string().trim().min(1).max(200),
  type: z.enum(ALLOWED_MIME, { message: "Only PDF, PNG or JPEG files are accepted" }),
  size: z.number().int().positive().max(MAX_FILE_BYTES, "Files must be 10 MB or smaller"),
});

export const createSubmissionSchema = z.object({
  data: submissionDataSchema,
  files: z.array(fileMetaSchema).max(3),
});

export const decisionSchema = z.object({
  action: z.enum(["approve", "reject", "request_info"]),
  note: z.string().trim().min(10, "Reviewer note must be at least 10 characters").max(2000),
  acknowledged: z.array(z.string()).default([]),
  items: z
    .array(z.object({ code: z.string(), title: z.string(), action: z.string().min(5), slot: z.string().optional(), field: z.string().optional() }))
    .optional(),
});
