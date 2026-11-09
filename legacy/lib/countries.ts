import type { Country, Slot } from "@/lib/types";

export interface CountryRule {
  code: Country;
  name: string;
  taxIdLabel: string;
  taxIdExample: string;
  taxIdHint: string;
  bankFields: ("account_number" | "ifsc" | "routing_number" | "iban" | "bic")[];
  documents: Record<Slot, { label: string; hint: string }>;
}

export const COUNTRIES: Record<Country, CountryRule> = {
  IN: {
    code: "IN",
    name: "India",
    taxIdLabel: "GSTIN",
    taxIdExample: "29AABCN1234F1Z5",
    taxIdHint: "15 characters: state code, PAN, entity code, Z, checksum",
    bankFields: ["account_number", "ifsc"],
    documents: {
      tax_certificate: { label: "GST registration certificate", hint: "Form GST REG-06" },
      bank_proof: { label: "Bank letter or cancelled cheque", hint: "Shows account holder name and number, issued in the last 90 days" },
      incorporation_certificate: { label: "Certificate of incorporation", hint: "Issued by the Registrar of Companies (MCA)" },
    },
  },
  US: {
    code: "US",
    name: "United States",
    taxIdLabel: "EIN",
    taxIdExample: "12-3456789",
    taxIdHint: "9 digits, formatted NN-NNNNNNN",
    bankFields: ["account_number", "routing_number"],
    documents: {
      tax_certificate: { label: "IRS EIN confirmation (CP 575) or W-9", hint: "Shows legal name and EIN" },
      bank_proof: { label: "Bank letter or voided cheque", hint: "Shows account holder, account and routing number, issued in the last 90 days" },
      incorporation_certificate: { label: "Certificate of incorporation / formation", hint: "Issued by the Secretary of State" },
    },
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    taxIdLabel: "VAT number",
    taxIdExample: "GB123456789",
    taxIdHint: "GB followed by 9 digits",
    bankFields: ["iban", "bic"],
    documents: {
      tax_certificate: { label: "VAT registration certificate", hint: "Issued by HMRC (VAT4)" },
      bank_proof: { label: "Bank letter or statement header", hint: "Shows account holder and IBAN, issued in the last 90 days" },
      incorporation_certificate: { label: "Certificate of incorporation", hint: "Issued by Companies House" },
    },
  },
  DE: {
    code: "DE",
    name: "Germany",
    taxIdLabel: "USt-IdNr.",
    taxIdExample: "DE123456789",
    taxIdHint: "DE followed by 9 digits",
    bankFields: ["iban", "bic"],
    documents: {
      tax_certificate: { label: "VAT ID confirmation (USt-IdNr.)", hint: "Issued by the Bundeszentralamt für Steuern" },
      bank_proof: { label: "Bank confirmation letter", hint: "Shows account holder and IBAN, issued in the last 90 days" },
      incorporation_certificate: { label: "Commercial register extract (Handelsregister)", hint: "HRB extract" },
    },
  },
};

export const COUNTRY_LIST = Object.values(COUNTRIES);

export function isCountry(v: unknown): v is Country {
  return typeof v === "string" && v in COUNTRIES;
}

export const SLOT_LABEL: Record<Slot, string> = {
  tax_certificate: "Tax registration certificate",
  bank_proof: "Bank account proof",
  incorporation_certificate: "Company registration certificate",
};
