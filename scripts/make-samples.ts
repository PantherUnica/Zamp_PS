// Generates realistic Indian vendor documents for the demo cases into public/samples/.
// Usage: npm run samples   (re-run before a demo to keep dates current)
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import { SAMPLE_CASES } from "../src/lib/samples";
import { stateName } from "../src/lib/india";

const OUT = join(process.cwd(), "public", "samples");
const ink = rgb(0.1, 0.1, 0.1);
const grey = rgb(0.42, 0.42, 0.42);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

async function newDoc(size: [number, number] = [595, 842]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(size);
  const fonts = { reg: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  return { pdf, page, fonts };
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(" ")) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > width) {
      out.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

async function save(pdf: PDFDocument, dir: string, file: string, title: string) {
  pdf.setTitle(title);
  mkdirSync(join(OUT, dir), { recursive: true });
  writeFileSync(join(OUT, dir, file), await pdf.save());
  console.log(`  ${dir}/${file}`);
}

/** Certificate-style A4 document. */
async function certificate(dir: string, file: string, spec: { issuer: string; sub: string; title: string; ref?: string; date: string; intro?: string; rows: [string, string][]; signer: string }) {
  const { pdf, page, fonts } = await newDoc();
  let y = 790;
  page.drawText(spec.issuer, { x: 56, y, size: 15, font: fonts.bold, color: ink });
  y -= 16;
  page.drawText(spec.sub, { x: 56, y, size: 9, font: fonts.reg, color: grey });
  y -= 14;
  page.drawLine({ start: { x: 56, y }, end: { x: 539, y }, thickness: 0.8, color: grey });
  y -= 36;
  page.drawText(spec.title, { x: 56, y, size: 13, font: fonts.bold, color: ink });
  y -= 18;
  page.drawText(`${spec.ref ? `Reference: ${spec.ref}    ` : ""}Date of issue: ${spec.date}`, { x: 56, y, size: 9, font: fonts.reg, color: grey });
  y -= 28;
  if (spec.intro) {
    for (const l of wrap(spec.intro, fonts.reg, 10, 483)) {
      page.drawText(l, { x: 56, y, size: 10, font: fonts.reg, color: ink });
      y -= 15;
    }
    y -= 10;
  }
  for (const [k, v] of spec.rows) {
    page.drawText(k, { x: 56, y, size: 9.5, font: fonts.reg, color: grey });
    const vl = wrap(v, fonts.bold, 10, 300);
    vl.forEach((l, i) => page.drawText(l, { x: 230, y: y - i * 14, size: 10, font: fonts.bold, color: ink }));
    y -= 14 * vl.length + 9;
  }
  y -= 40;
  page.drawText(spec.signer, { x: 56, y, size: 10, font: fonts.bold, color: ink });
  page.drawText("This is a system generated document.", { x: 56, y: 60, size: 8, font: fonts.reg, color: grey });
  await save(pdf, dir, file, spec.title);
}

/** e-PAN card layout. */
async function panCard(dir: string, o: { name: string; pan: string; incorporated: string }) {
  const { pdf, page, fonts } = await newDoc([420, 270]);
  page.drawRectangle({ x: 10, y: 10, width: 400, height: 250, borderColor: rgb(0.55, 0.55, 0.6), borderWidth: 1, color: rgb(0.95, 0.96, 0.98) });
  page.drawText("INCOME TAX DEPARTMENT", { x: 24, y: 232, size: 11, font: fonts.bold, color: ink });
  page.drawText("GOVT. OF INDIA", { x: 300, y: 232, size: 11, font: fonts.bold, color: ink });
  page.drawText("Permanent Account Number Card", { x: 24, y: 210, size: 9, font: fonts.reg, color: grey });
  page.drawText(o.pan, { x: 24, y: 178, size: 20, font: fonts.bold, color: ink });
  page.drawText("Name", { x: 24, y: 146, size: 8, font: fonts.reg, color: grey });
  page.drawText(o.name.toUpperCase(), { x: 24, y: 132, size: 11, font: fonts.bold, color: ink });
  page.drawText("Date of Incorporation / Formation", { x: 24, y: 104, size: 8, font: fonts.reg, color: grey });
  page.drawText(o.incorporated, { x: 24, y: 90, size: 11, font: fonts.bold, color: ink });
  page.drawText("e-PAN · This is an electronically generated PAN card.", { x: 24, y: 30, size: 7, font: fonts.reg, color: grey });
  await save(pdf, dir, "pan_card.pdf", "e-PAN card");
}

/** Cancelled cheque: holder name printed above the signature, CANCELLED across the face. */
async function cheque(dir: string, o: { bank: string; branch: string; ifsc: string; holder: string; account: string; micr: string }) {
  const { pdf, page, fonts } = await newDoc([600, 280]);
  page.drawRectangle({ x: 8, y: 8, width: 584, height: 264, borderColor: rgb(0.6, 0.65, 0.7), borderWidth: 1, color: rgb(0.96, 0.98, 0.99) });
  page.drawText(o.bank, { x: 24, y: 244, size: 14, font: fonts.bold, color: ink });
  page.drawText(`${o.branch}  ·  IFSC: ${o.ifsc}`, { x: 24, y: 228, size: 8.5, font: fonts.reg, color: grey });
  page.drawText("Date  _ _ / _ _ / _ _ _ _", { x: 430, y: 244, size: 9, font: fonts.reg, color: grey });
  page.drawText("Pay ______________________________________________  or Bearer", { x: 24, y: 196, size: 10, font: fonts.reg, color: grey });
  page.drawText("Rupees ______________________________________________", { x: 24, y: 170, size: 10, font: fonts.reg, color: grey });
  page.drawText("A/c No.", { x: 24, y: 134, size: 9, font: fonts.reg, color: grey });
  page.drawText(o.account, { x: 70, y: 134, size: 12, font: fonts.bold, color: ink });
  page.drawText("Current Account", { x: 24, y: 118, size: 8, font: fonts.reg, color: grey });
  page.drawText(`For ${o.holder.toUpperCase()}`, { x: 330, y: 104, size: 9.5, font: fonts.bold, color: ink });
  page.drawText("Authorised Signatory", { x: 400, y: 70, size: 8, font: fonts.reg, color: grey });
  page.drawText(`" 000101"  ${o.micr}:  ${o.account.slice(-6)}"  29`, { x: 120, y: 26, size: 11, font: fonts.reg, color: ink });
  page.drawText("CANCELLED", { x: 150, y: 120, size: 54, font: fonts.bold, color: rgb(0.75, 0.15, 0.12), rotate: degrees(14), opacity: 0.55 });
  await save(pdf, dir, "cancelled_cheque.pdf", "Cancelled cheque");
}

function gstCert(dir: string, o: { gstin: string; legal: string; trade?: string; constitution: string; address: string; state: string; liability: string }) {
  return certificate(dir, "gst_certificate.pdf", {
    issuer: "Government of India",
    sub: "Goods and Services Tax Network · Form GST REG-06 · [See Rule 10(1)]",
    title: "Registration Certificate",
    ref: `REG-06/${o.gstin.slice(0, 2)}/${o.liability.slice(0, 4)}`,
    date: o.liability,
    rows: [
      ["Registration Number (GSTIN)", o.gstin],
      ["Legal Name", o.legal],
      ["Trade Name, if any", o.trade || "-"],
      ["Constitution of Business", o.constitution],
      ["Address of Principal Place of Business", o.address],
      ["State", o.state],
      ["Date of Liability", o.liability],
      ["Type of Registration", "Regular"],
    ],
    signer: "Approving Authority, Central Tax",
  });
}

const CONS = { private_limited: "Private Limited Company", llp: "Limited Liability Partnership" } as Record<string, string>;
const MICR: Record<string, string> = { HDFC0000075: "560240005", ICIC0000039: "411229003", UTIB0000003: "380211002", HDFC0000004: "600240002" };
const BANK: Record<string, { bank: string; branch: string }> = {
  HDFC0000075: { bank: "HDFC BANK LTD.", branch: "Airport Road, Bangalore" },
  ICIC0000039: { bank: "ICICI BANK LTD.", branch: "Pune" },
  UTIB0000003: { bank: "AXIS BANK LTD.", branch: "Ahmedabad" },
  HDFC0000004: { bank: "HDFC BANK LTD.", branch: "ITC Centre, Anna Salai, Chennai" },
};

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  console.log("Generating sample documents:");
  for (const s of SAMPLE_CASES) {
    const d = s.data;
    const dir = s.files[0].url.split("/")[2];
    const address = `${d.address_line}, ${d.city}, ${stateName(d.state)} ${d.pincode}`;
    // Edge 3: the real GST certificate carries Albion's own Tamil Nadu GSTIN, not the one typed on the form.
    const certGstin = s.id === "tax-invalid" ? "33AABCA9876M1Z5" : d.gstin;
    await gstCert(dir, { gstin: certGstin, legal: d.legal_name.replace(/Pvt Ltd$/, "Private Limited"), trade: d.trade_name, constitution: CONS[d.constitution], address, state: stateName(d.state), liability: "2021-07-01" });
    await panCard(dir, { name: d.legal_name.replace(/Pvt Ltd$/, "Private Limited"), pan: d.pan, incorporated: "14/03/2019" });
    // Edge 2: the cheque is drawn on an account held by a different company.
    const holder = s.id === "bank-mismatch" ? "Brightline Logistics Pvt Ltd" : d.bank.account_holder;
    await cheque(dir, { ...BANK[d.bank.ifsc], ifsc: d.bank.ifsc, holder, account: d.bank.account_number, micr: MICR[d.bank.ifsc] });
    if (d.constitution === "llp") {
      await certificate(dir, "llp_certificate.pdf", {
        issuer: "Ministry of Corporate Affairs",
        sub: "Registrar of Companies · Form 16 · Limited Liability Partnership Act, 2008",
        title: "Certificate of Incorporation of Limited Liability Partnership",
        date: "2020-02-11",
        intro: `It is hereby certified that ${d.legal_name.toUpperCase()} is incorporated under the Limited Liability Partnership Act, 2008 on this eleventh day of February two thousand twenty.`,
        rows: [["LLP Name", d.legal_name], ["LLP Identification Number (LLPIN)", d.llpin!], ["Registered Office", address], ["Country", "India"]],
        signer: "Registrar of Companies, Ahmedabad",
      });
    } else {
      await certificate(dir, "incorporation_certificate.pdf", {
        issuer: "Ministry of Corporate Affairs",
        sub: "Registrar of Companies · Government of India",
        title: "Certificate of Incorporation",
        date: "2019-03-14",
        intro: `I hereby certify that ${d.legal_name.replace(/Pvt Ltd$/, "Private Limited").toUpperCase()} is incorporated under the Companies Act, 2013, and that the company is limited by shares.`,
        rows: [["Company Name", d.legal_name.replace(/Pvt Ltd$/, "Private Limited")], ["Corporate Identity Number (CIN)", d.cin!], ["PAN", d.pan], ["Registered Office", address]],
        signer: "Registrar of Companies",
      });
    }
  }
  console.log(`Done. Bank letters are not used; cheques carry no date, so samples never go stale. Generated ${daysAgo(0)}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
