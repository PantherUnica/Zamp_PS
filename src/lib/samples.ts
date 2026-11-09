import type { Slot, SubmissionData } from "@/lib/types";

/**
 * Prepared test vendors for the demo. "Load test case" fills the real form and attaches the real
 * PDF files from /public/samples; everything after that (upload, AI extraction, rules, decision)
 * runs exactly as for any other vendor. Regenerate the PDFs with `npm run samples`.
 */
export interface SampleCase {
  id: string;
  label: string;
  expect: string;
  data: SubmissionData;
  files: { slot: Slot; url: string; name: string }[];
  /** Files the vendor provides later, when answering an information request. */
  resubmission?: { slot: Slot; url: string; name: string }[];
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "happy",
    label: "Happy path · Northwind Components (IN)",
    expect: "All checks pass → recommend approve → reviewer signs off",
    data: {
      legal_name: "Northwind Components Pvt Ltd",
      trading_name: "Northwind Components",
      country: "IN",
      registration_number: "U29100KA2019PTC123456",
      tax_id: "29AABCN1234F1ZS",
      address: "21 Residency Road, Bengaluru, Karnataka 560025",
      contact_name: "Ananya Rao",
      contact_email: "accounts@northwindcomponents.example",
      bank: {
        account_holder: "Northwind Components Private Limited",
        bank_name: "HDFC Bank",
        bank_country: "IN",
        account_number: "50200012345678",
        ifsc: "HDFC0001234",
      },
    },
    files: [
      { slot: "tax_certificate", url: "/samples/northwind/gst_certificate.pdf", name: "gst_certificate.pdf" },
      { slot: "bank_proof", url: "/samples/northwind/bank_letter.pdf", name: "bank_letter.pdf" },
      { slot: "incorporation_certificate", url: "/samples/northwind/incorporation_certificate.pdf", name: "incorporation_certificate.pdf" },
    ],
  },
  {
    id: "incomplete",
    label: "Edge 1 · Missing bank proof · Kestrel Fasteners (US)",
    expect: "Missing document → pending → vendor asked → resubmits → resumes",
    data: {
      legal_name: "Kestrel Fasteners Inc.",
      trading_name: "",
      country: "US",
      registration_number: "4783291",
      tax_id: "46-3829175",
      address: "1800 Industrial Parkway, Columbus, OH 43215",
      contact_name: "Daniel Price",
      contact_email: "ap@kestrelfasteners.example",
      bank: {
        account_holder: "Kestrel Fasteners Inc.",
        bank_name: "JPMorgan Chase Bank",
        bank_country: "US",
        account_number: "483920175",
        routing_number: "021000021",
      },
    },
    files: [
      { slot: "tax_certificate", url: "/samples/kestrel/ein_confirmation.pdf", name: "ein_confirmation.pdf" },
      { slot: "incorporation_certificate", url: "/samples/kestrel/certificate_of_incorporation.pdf", name: "certificate_of_incorporation.pdf" },
    ],
    resubmission: [{ slot: "bank_proof", url: "/samples/kestrel/bank_letter.pdf", name: "bank_letter.pdf" }],
  },
  {
    id: "bank-mismatch",
    label: "Edge 2 · Bank holder mismatch · Brightline Packaging (DE)",
    expect: "Bank account belongs to another entity → pending → human review",
    data: {
      legal_name: "Brightline Packaging GmbH",
      trading_name: "",
      country: "DE",
      registration_number: "HRB 98765",
      tax_id: "DE814725932",
      address: "Hansaring 42, 50670 Köln",
      contact_name: "Lena Hoffmann",
      contact_email: "buchhaltung@brightline.example",
      bank: {
        account_holder: "Brightline Packaging GmbH",
        bank_name: "Commerzbank",
        bank_country: "DE",
        iban: "DE89 3704 0044 0532 0130 00",
        bic: "COBADEFFXXX",
      },
    },
    files: [
      { slot: "tax_certificate", url: "/samples/brightline/ust_idnr_bestaetigung.pdf", name: "ust_idnr_bestaetigung.pdf" },
      { slot: "bank_proof", url: "/samples/brightline/bank_confirmation.pdf", name: "bank_confirmation.pdf" },
      { slot: "incorporation_certificate", url: "/samples/brightline/handelsregister_auszug.pdf", name: "handelsregister_auszug.pdf" },
    ],
  },
  {
    id: "tax-invalid",
    label: "Edge 3 · Invalid tax ID for country · Albion Precision (GB)",
    expect: "Indian-format tax ID for a UK company, conflicts with VAT certificate → blocked from clearance",
    data: {
      legal_name: "Albion Precision Ltd",
      trading_name: "",
      country: "GB",
      registration_number: "11548327",
      tax_id: "27AABCA5678K1ZA",
      address: "Unit 4, Kingsway Business Park, Sheffield S9 1AB",
      contact_name: "Oliver Grant",
      contact_email: "finance@albionprecision.example",
      bank: {
        account_holder: "Albion Precision Ltd",
        bank_name: "Barclays",
        bank_country: "GB",
        iban: "GB60 BARC 2000 0055 7799 11",
        bic: "BARCGB22",
      },
    },
    files: [
      { slot: "tax_certificate", url: "/samples/albion/vat_certificate.pdf", name: "vat_certificate.pdf" },
      { slot: "bank_proof", url: "/samples/albion/bank_letter.pdf", name: "bank_letter.pdf" },
      { slot: "incorporation_certificate", url: "/samples/albion/certificate_of_incorporation.pdf", name: "certificate_of_incorporation.pdf" },
    ],
  },
];
