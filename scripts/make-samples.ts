// Generates realistic test documents for the demo cases into public/samples/.
// Usage: npm run samples   (re-run before a demo so bank letters stay within the 90-day window)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { deVatCheckDigit, gbVatValid, gstinChecksum, ibanCheckDigits } from "../src/lib/rules/validators";

const OUT = join(process.cwd(), "public", "samples");
const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10);

// ---- identifiers with real check digits
const gstin = (first14: string) => first14 + gstinChecksum(first14);
const deVat = (first8: string) => `DE${first8}${deVatCheckDigit(first8)}`;
function gbVat(seven: string) {
  for (let c = 0; c < 100; c++) {
    const nine = seven + String(c).padStart(2, "0");
    if (gbVatValid(nine)) return `GB${nine}`;
  }
  throw new Error("no GB VAT");
}
const iban = (cc: string, bban: string) => `${cc}${ibanCheckDigits(cc, bban)}${bban}`;
const fmtIban = (v: string) => v.replace(/(.{4})/g, "$1 ").trim();

export const IDS = {
  northwindGstin: gstin("29AABCN1234F1Z"),
  kestrelEin: "46-3829175",
  brightlineVat: deVat("81472593"),
  brightlineIban: iban("DE", "370400440532013000"),
  albionVatOnCert: gbVat("9807806"),
  albionIban: iban("GB", "BARC20000055779911"),
};

// ---- tiny layout engine
interface Line {
  k: string;
  v: string;
}
interface DocSpec {
  file: string;
  issuer: string;
  issuerSub: string;
  title: string;
  ref?: string;
  date: string;
  intro?: string;
  rows: Line[];
  body?: string[];
  signer: string;
  hidden?: string;
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > width) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function render(dir: string, spec: DocSpec) {
  const pdf = await PDFDocument.create();
  const page: PDFPage = pdf.addPage([595, 842]);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.1);
  const grey = rgb(0.42, 0.42, 0.42);
  let y = 790;
  page.drawText(spec.issuer, { x: 56, y, size: 15, font: bold, color: ink });
  y -= 16;
  page.drawText(spec.issuerSub, { x: 56, y, size: 9, font: reg, color: grey });
  y -= 14;
  page.drawLine({ start: { x: 56, y }, end: { x: 539, y }, thickness: 0.8, color: grey });
  y -= 36;
  page.drawText(spec.title, { x: 56, y, size: 13, font: bold, color: ink });
  y -= 18;
  page.drawText(`${spec.ref ? `Reference: ${spec.ref}    ` : ""}Date of issue: ${spec.date}`, { x: 56, y, size: 9, font: reg, color: grey });
  y -= 28;
  if (spec.intro) {
    for (const l of wrap(spec.intro, reg, 10, 483)) {
      page.drawText(l, { x: 56, y, size: 10, font: reg, color: ink });
      y -= 15;
    }
    y -= 10;
  }
  for (const r of spec.rows) {
    page.drawText(r.k, { x: 56, y, size: 9.5, font: reg, color: grey });
    const vl = wrap(r.v, bold, 10, 300);
    vl.forEach((l, i) => page.drawText(l, { x: 230, y: y - i * 14, size: 10, font: bold, color: ink }));
    y -= 14 * vl.length + 9;
  }
  y -= 12;
  for (const para of spec.body ?? []) {
    for (const l of wrap(para, reg, 10, 483)) {
      page.drawText(l, { x: 56, y, size: 10, font: reg, color: ink });
      y -= 15;
    }
    y -= 8;
  }
  y -= 30;
  page.drawText(spec.signer, { x: 56, y, size: 10, font: bold, color: ink });
  page.drawText("This is a system generated document.", { x: 56, y: 60, size: 8, font: reg, color: grey });
  if (spec.hidden) page.drawText(spec.hidden, { x: 56, y: 40, size: 3, font: reg, color: rgb(1, 1, 1) });
  pdf.setTitle(spec.title);
  mkdirSync(join(OUT, dir), { recursive: true });
  writeFileSync(join(OUT, dir, spec.file), await pdf.save());
  console.log(`  ${dir}/${spec.file}`);
}

async function main() {
  console.log("Generating sample documents:");

  // 1. Happy path: Northwind Components Pvt Ltd (India)
  const nw = "northwind";
  await render(nw, {
    file: "gst_certificate.pdf",
    issuer: "Government of India",
    issuerSub: "Goods and Services Tax Network · Form GST REG-06",
    title: "Registration Certificate",
    ref: "REG-06/KA/2019/448812",
    date: "2019-05-10",
    rows: [
      { k: "Registration Number (GSTIN)", v: IDS.northwindGstin },
      { k: "Legal Name", v: "Northwind Components Private Limited" },
      { k: "Trade Name", v: "Northwind Components" },
      { k: "Constitution of Business", v: "Private Limited Company" },
      { k: "Address of Principal Place", v: "21 Residency Road, Bengaluru, Karnataka 560025, India" },
      { k: "Date of Liability", v: "2019-04-01" },
      { k: "Type of Registration", v: "Regular" },
      { k: "Country", v: "India" },
    ],
    signer: "Approving Authority, Central Tax, Bengaluru",
  });
  await render(nw, {
    file: "bank_letter.pdf",
    issuer: "HDFC Bank Limited",
    issuerSub: "Residency Road Branch · Bengaluru 560025 · IFSC HDFC0001234",
    title: "Bank Account Confirmation Letter",
    ref: "HDFC/RR/BAC/77231",
    date: daysAgo(6),
    intro: "To whom it may concern. This is to confirm that the following current account is maintained with our branch and is active as on the date of this letter.",
    rows: [
      { k: "Account Holder", v: "Northwind Components Private Limited" },
      { k: "Account Number", v: "50200012345678" },
      { k: "Account Type", v: "Current Account" },
      { k: "IFSC", v: "HDFC0001234" },
      { k: "Branch", v: "Residency Road, Bengaluru" },
      { k: "Country", v: "India" },
    ],
    signer: "Branch Manager, HDFC Bank Ltd.",
  });
  await render(nw, {
    file: "incorporation_certificate.pdf",
    issuer: "Ministry of Corporate Affairs",
    issuerSub: "Registrar of Companies, Karnataka · Government of India",
    title: "Certificate of Incorporation",
    date: "2019-03-14",
    intro: "I hereby certify that NORTHWIND COMPONENTS PRIVATE LIMITED is incorporated on this fourteenth day of March two thousand nineteen under the Companies Act, 2013, and that the company is limited by shares.",
    rows: [
      { k: "Company Name", v: "Northwind Components Private Limited" },
      { k: "Corporate Identity Number", v: "U29100KA2019PTC123456" },
      { k: "PAN", v: "AABCN1234F" },
      { k: "Registered Office", v: "21 Residency Road, Bengaluru, Karnataka 560025" },
      { k: "Country", v: "India" },
    ],
    signer: "Registrar of Companies, Karnataka",
  });

  // 2. Edge case: incomplete submission. Kestrel Fasteners Inc (US); bank letter withheld for resubmission.
  const ks = "kestrel";
  await render(ks, {
    file: "ein_confirmation.pdf",
    issuer: "Internal Revenue Service",
    issuerSub: "Department of the Treasury · Cincinnati, OH 45999 · Notice CP 575 A",
    title: "We assigned you an Employer Identification Number (EIN)",
    date: "2021-08-23",
    intro: "Thank you for applying for an Employer Identification Number (EIN). We assigned you the EIN shown below. This EIN will identify you, your business accounts, tax returns, and documents.",
    rows: [
      { k: "Employer Identification Number", v: IDS.kestrelEin },
      { k: "Legal Name", v: "Kestrel Fasteners Inc." },
      { k: "Address", v: "1800 Industrial Parkway, Columbus, OH 43215" },
      { k: "Form", v: "SS-4" },
      { k: "Country", v: "United States" },
    ],
    signer: "Internal Revenue Service",
  });
  await render(ks, {
    file: "certificate_of_incorporation.pdf",
    issuer: "State of Ohio · Secretary of State",
    issuerSub: "Business Services Division · Columbus, Ohio",
    title: "Certificate of Incorporation",
    date: "2021-08-02",
    intro: "It is hereby certified that the Secretary of State of Ohio has custody of the business records for the corporation named below, and that it was duly incorporated on the date shown.",
    rows: [
      { k: "Entity Name", v: "Kestrel Fasteners Inc." },
      { k: "Charter / Entity Number", v: "4783291" },
      { k: "Entity Type", v: "For-Profit Corporation" },
      { k: "Principal Office", v: "1800 Industrial Parkway, Columbus, OH 43215" },
      { k: "Country", v: "United States" },
    ],
    signer: "Secretary of State, Ohio",
  });
  await render(ks, {
    file: "bank_letter.pdf",
    issuer: "JPMorgan Chase Bank, N.A.",
    issuerSub: "Commercial Banking · Columbus, OH",
    title: "Bank Account Verification Letter",
    date: daysAgo(3),
    intro: "At the request of our client, we confirm the following deposit account is open and in good standing with JPMorgan Chase Bank, N.A.",
    rows: [
      { k: "Account Holder", v: "Kestrel Fasteners Inc." },
      { k: "Account Number", v: "483920175" },
      { k: "ABA Routing Number", v: "021000021" },
      { k: "Account Type", v: "Business Checking" },
      { k: "Country", v: "United States" },
    ],
    signer: "Relationship Manager, Chase Commercial Banking",
  });

  // 3. Edge case: bank name mismatch. Brightline Packaging GmbH (DE); account belongs to a different entity.
  const bl = "brightline";
  await render(bl, {
    file: "ust_idnr_bestaetigung.pdf",
    issuer: "Bundeszentralamt für Steuern",
    issuerSub: "An der Küppe 1 · 53225 Bonn · Federal Central Tax Office",
    title: "Confirmation of VAT Identification Number (USt-IdNr.)",
    date: "2022-02-11",
    rows: [
      { k: "USt-IdNr. (VAT ID)", v: IDS.brightlineVat },
      { k: "Company Name", v: "Brightline Packaging GmbH" },
      { k: "Address", v: "Hansaring 42, 50670 Köln" },
      { k: "Country", v: "Germany" },
    ],
    signer: "Bundeszentralamt für Steuern",
  });
  await render(bl, {
    file: "bank_confirmation.pdf",
    issuer: "Commerzbank AG",
    issuerSub: "Filiale Köln · BIC COBADEFFXXX",
    title: "Bank Account Confirmation (Kontobestätigung)",
    date: daysAgo(12),
    intro: "We hereby confirm that the following business account is held with Commerzbank AG.",
    rows: [
      { k: "Account Holder", v: "Brightline Logistik GmbH" },
      { k: "IBAN", v: fmtIban(IDS.brightlineIban) },
      { k: "BIC", v: "COBADEFFXXX" },
      { k: "Country", v: "Germany" },
    ],
    signer: "Commerzbank AG, Firmenkunden",
  });
  await render(bl, {
    file: "handelsregister_auszug.pdf",
    issuer: "Amtsgericht Köln",
    issuerSub: "Handelsregister Abteilung B",
    title: "Commercial Register Extract (Handelsregisterauszug)",
    date: "2022-01-20",
    rows: [
      { k: "Registration Number", v: "HRB 98765" },
      { k: "Company Name (Firma)", v: "Brightline Packaging GmbH" },
      { k: "Registered Office", v: "Köln" },
      { k: "Business Address", v: "Hansaring 42, 50670 Köln" },
      { k: "Legal Form", v: "Gesellschaft mit beschränkter Haftung" },
      { k: "Country", v: "Germany" },
    ],
    signer: "Registergericht Köln",
  });

  // 4. Edge case: invalid / inconsistent tax info. Albion Precision Ltd (GB) enters an Indian-format tax ID.
  const al = "albion";
  await render(al, {
    file: "vat_certificate.pdf",
    issuer: "HM Revenue & Customs",
    issuerSub: "VAT Registration Service · BX9 1WR",
    title: "Certificate of Registration for Value Added Tax (VAT4)",
    date: "2020-06-30",
    rows: [
      { k: "VAT Registration Number", v: `${IDS.albionVatOnCert.slice(0, 5)} ${IDS.albionVatOnCert.slice(5, 9)} ${IDS.albionVatOnCert.slice(9)}` },
      { k: "Name", v: "Albion Precision Ltd" },
      { k: "Address", v: "Unit 4, Kingsway Business Park, Sheffield S9 1AB" },
      { k: "Effective Date of Registration", v: "2020-07-01" },
      { k: "Country", v: "United Kingdom" },
    ],
    signer: "HM Revenue & Customs",
  });
  await render(al, {
    file: "bank_letter.pdf",
    issuer: "Barclays Bank UK PLC",
    issuerSub: "Business Banking · Sheffield",
    title: "Confirmation of Account Details",
    date: daysAgo(9),
    rows: [
      { k: "Account Name", v: "Albion Precision Ltd" },
      { k: "IBAN", v: fmtIban(IDS.albionIban) },
      { k: "Sort Code", v: "20-00-00" },
      { k: "Account Number", v: "55779911" },
      { k: "Country", v: "United Kingdom" },
    ],
    signer: "Barclays Business Banking",
  });
  await render(al, {
    file: "certificate_of_incorporation.pdf",
    issuer: "Companies House",
    issuerSub: "Registrar of Companies for England and Wales",
    title: "Certificate of Incorporation of a Private Limited Company",
    date: "2018-09-04",
    intro: "The Registrar of Companies for England and Wales hereby certifies that ALBION PRECISION LTD is this day incorporated under the Companies Act 2006 as a private company, that the company is limited by shares, and the situation of its registered office is in England/Wales.",
    rows: [
      { k: "Company Name", v: "Albion Precision Ltd" },
      { k: "Company Number", v: "11548327" },
      { k: "Registered Office", v: "Unit 4, Kingsway Business Park, Sheffield S9 1AB" },
      { k: "Country", v: "United Kingdom" },
    ],
    signer: "Registrar of Companies",
  });

  writeFileSync(join(OUT, "ids.json"), JSON.stringify(IDS, null, 2));
  console.log("IDs:", IDS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
