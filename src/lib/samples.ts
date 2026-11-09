import type { Slot, SubmissionData } from "@/lib/types";

/**
 * Prepared demo vendors (fictional companies; real IFSC branches so the external lookup works).
 * Staff can create these as vendors, then — on the vendor's magic link — "Fill demo details"
 * loads the form and uploads the real PDFs from /public/samples. Everything after that (upload,
 * AI reading, rules, emails, decision) runs exactly as for any other vendor.
 * Regenerate the PDFs with `npm run samples`.
 */
export interface SampleCase {
  id: string;
  label: string;
  expect: string;
  vendor: { company_name: string; contact_name: string; contact_phone: string; city: string; supplies: string };
  data: SubmissionData;
  files: { slot: Slot; url: string; name: string }[];
  /** Files the vendor adds when answering a correction request. */
  resubmission?: { slot: Slot; url: string; name: string }[];
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "happy",
    label: "Happy path · Northwind Components (Karnataka)",
    expect: "Every check passes → ready for approval → reviewer approves",
    vendor: { company_name: "Northwind Components Pvt Ltd", contact_name: "Ananya Rao", contact_phone: "+91 98450 12345", city: "Bengaluru", supplies: "Precision machined components and fasteners" },
    data: {
      legal_name: "Northwind Components Pvt Ltd",
      trade_name: "Northwind Components",
      constitution: "private_limited",
      cin: "U29100KA2019PTC123456",
      llpin: "",
      udyam: "UDYAM-KA-03-0012345",
      supplies: "Precision machined components and fasteners",
      address_line: "21 Residency Road",
      city: "Bengaluru",
      state: "29",
      pincode: "560025",
      contact_name: "Ananya Rao",
      designation: "Finance Manager",
      contact_email: "",
      contact_phone: "+91 98450 12345",
      gstin: "29AABCN1234F1ZS",
      pan: "AABCN1234F",
      bank: { account_holder: "Northwind Components Private Limited", account_number: "50200012345678", ifsc: "HDFC0000075", bank_name: "HDFC Bank", branch: "Airport Road, Bangalore", account_type: "current" },
    },
    files: [
      { slot: "gst_certificate", url: "/samples/northwind/gst_certificate.pdf", name: "gst_certificate.pdf" },
      { slot: "pan_card", url: "/samples/northwind/pan_card.pdf", name: "pan_card.pdf" },
      { slot: "bank_proof", url: "/samples/northwind/cancelled_cheque.pdf", name: "cancelled_cheque.pdf" },
      { slot: "incorporation_certificate", url: "/samples/northwind/incorporation_certificate.pdf", name: "incorporation_certificate.pdf" },
    ],
  },
  {
    id: "incomplete",
    label: "Edge 1 · Missing cancelled cheque · Kestrel Fasteners (Maharashtra)",
    expect: "Missing document → request emailed automatically → vendor adds cheque → resumes → ready",
    vendor: { company_name: "Kestrel Fasteners Pvt Ltd", contact_name: "Rohan Deshmukh", contact_phone: "+91 98220 45678", city: "Pune", supplies: "Industrial fasteners and anchors" },
    data: {
      legal_name: "Kestrel Fasteners Pvt Ltd",
      trade_name: "",
      constitution: "private_limited",
      cin: "U28990MH2020PTC345678",
      llpin: "",
      udyam: "",
      supplies: "Industrial fasteners and anchors",
      address_line: "Plot 14, MIDC Bhosari",
      city: "Pune",
      state: "27",
      pincode: "411026",
      contact_name: "Rohan Deshmukh",
      designation: "Director",
      contact_email: "",
      contact_phone: "+91 98220 45678",
      gstin: "27AAECK4821Q1Z2",
      pan: "AAECK4821Q",
      bank: { account_holder: "Kestrel Fasteners Pvt Ltd", account_number: "003905012345", ifsc: "ICIC0000039", bank_name: "ICICI Bank", branch: "Pune", account_type: "current" },
    },
    files: [
      { slot: "gst_certificate", url: "/samples/kestrel/gst_certificate.pdf", name: "gst_certificate.pdf" },
      { slot: "pan_card", url: "/samples/kestrel/pan_card.pdf", name: "pan_card.pdf" },
      { slot: "incorporation_certificate", url: "/samples/kestrel/incorporation_certificate.pdf", name: "incorporation_certificate.pdf" },
    ],
    resubmission: [{ slot: "bank_proof", url: "/samples/kestrel/cancelled_cheque.pdf", name: "cancelled_cheque.pdf" }],
  },
  {
    id: "bank-mismatch",
    label: "Edge 2 · Bank holder mismatch · Brightline Packaging LLP (Gujarat)",
    expect: "Cheque is in another company's name → needs review → correction drafted for the salesperson",
    vendor: { company_name: "Brightline Packaging LLP", contact_name: "Meera Shah", contact_phone: "+91 99090 23456", city: "Ahmedabad", supplies: "Corrugated boxes and protective packaging" },
    data: {
      legal_name: "Brightline Packaging LLP",
      trade_name: "",
      constitution: "llp",
      cin: "",
      llpin: "AAB-1234",
      udyam: "",
      supplies: "Corrugated boxes and protective packaging",
      address_line: "B-402, Titanium City Centre, Satellite",
      city: "Ahmedabad",
      state: "24",
      pincode: "380015",
      contact_name: "Meera Shah",
      designation: "Designated Partner",
      contact_email: "",
      contact_phone: "+91 99090 23456",
      gstin: "24AAFFB2345K1ZN",
      pan: "AAFFB2345K",
      bank: { account_holder: "Brightline Packaging LLP", account_number: "917020045678123", ifsc: "UTIB0000003", bank_name: "Axis Bank", branch: "Ahmedabad", account_type: "current" },
    },
    files: [
      { slot: "gst_certificate", url: "/samples/brightline/gst_certificate.pdf", name: "gst_certificate.pdf" },
      { slot: "pan_card", url: "/samples/brightline/pan_card.pdf", name: "pan_card.pdf" },
      { slot: "bank_proof", url: "/samples/brightline/cancelled_cheque.pdf", name: "cancelled_cheque.pdf" },
      { slot: "incorporation_certificate", url: "/samples/brightline/llp_certificate.pdf", name: "llp_certificate.pdf" },
    ],
  },
  {
    id: "tax-invalid",
    label: "Edge 3 · GSTIN from another state and entity · Albion Precision (Tamil Nadu)",
    expect: "GSTIN is Maharashtra's and embeds another PAN; certificate shows a different GSTIN → blocked from clearance",
    vendor: { company_name: "Albion Precision Pvt Ltd", contact_name: "Karthik Iyer", contact_phone: "+91 94440 56789", city: "Chennai", supplies: "CNC turned parts" },
    data: {
      legal_name: "Albion Precision Pvt Ltd",
      trade_name: "",
      constitution: "private_limited",
      cin: "U29299TN2018PTC123987",
      llpin: "",
      udyam: "",
      supplies: "CNC turned parts",
      address_line: "45 SIDCO Industrial Estate, Guindy",
      city: "Chennai",
      state: "33",
      pincode: "600032",
      contact_name: "Karthik Iyer",
      designation: "Accounts Head",
      contact_email: "",
      contact_phone: "+91 94440 56789",
      gstin: "27AABCA5678K1ZA",
      pan: "AABCA9876M",
      bank: { account_holder: "Albion Precision Pvt Ltd", account_number: "50100234567890", ifsc: "HDFC0000004", bank_name: "HDFC Bank", branch: "Anna Salai, Chennai", account_type: "current" },
    },
    files: [
      { slot: "gst_certificate", url: "/samples/albion/gst_certificate.pdf", name: "gst_certificate.pdf" },
      { slot: "pan_card", url: "/samples/albion/pan_card.pdf", name: "pan_card.pdf" },
      { slot: "bank_proof", url: "/samples/albion/cancelled_cheque.pdf", name: "cancelled_cheque.pdf" },
      { slot: "incorporation_certificate", url: "/samples/albion/incorporation_certificate.pdf", name: "incorporation_certificate.pdf" },
    ],
  },
];

export const sampleFor = (companyName: string | null | undefined) => SAMPLE_CASES.find((s) => s.vendor.company_name === companyName);
