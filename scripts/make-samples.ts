// Generates realistic Indian vendor documents for the 15 demo/test cases into public/samples/.
// Usage: npm run samples   (re-run before a demo to keep dated documents current)
// Which document is drawn is decided by the file names in each case's `files`; variants come from `docs`.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import sharp from "sharp";
import { SAMPLE_CASES } from "../src/lib/samples";
import { stateName } from "../src/lib/india";

const OUT = join(process.cwd(), "public", "samples");
const ink = rgb(0.1, 0.1, 0.1);
const grey = rgb(0.42, 0.42, 0.42);
const white = rgb(1, 1, 1);
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

/** Certificate-style A4 document. `hidden` is drawn as tiny white text (an injection attempt a human can't see). */
async function certificate(dir: string, file: string, spec: { issuer: string; sub: string; title: string; ref?: string; date: string; intro?: string; rows: [string, string][]; signer: string; hidden?: string }) {
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
  if (spec.hidden) wrap(spec.hidden, fonts.reg, 4, 480).forEach((l, i) => page.drawText(l, { x: 56, y: 120 - i * 5, size: 4, font: fonts.reg, color: white }));
  page.drawText("This is a system generated document.", { x: 56, y: 60, size: 8, font: fonts.reg, color: grey });
  await save(pdf, dir, file, spec.title);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * A bad phone photo of a PAN card: an image-only PDF (no text layer, like a real scan) where the
 * header is legible but the number, name and date are smeared beyond reading, with a glare patch.
 */
async function blurryPanCard(dir: string, o: { name: string; pan: string; incorporated: string; dateLabel: string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="540">
    <defs><filter id="soft"><feGaussianBlur stdDeviation="2.4"/></filter><filter id="smear"><feGaussianBlur stdDeviation="9 5"/></filter>
    <radialGradient id="glare"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="840" height="540" fill="#e9ebef"/><rect x="20" y="20" width="800" height="500" rx="14" fill="#f2f3f6" stroke="#9aa0ab" stroke-width="2"/>
    <g filter="url(#soft)" font-family="Arial" fill="#2a2a2a"><text x="48" y="80" font-size="24" font-weight="bold">INCOME TAX DEPARTMENT</text><text x="600" y="80" font-size="24" font-weight="bold">GOVT. OF INDIA</text><text x="48" y="122" font-size="18" fill="#666">Permanent Account Number Card</text></g>
    <g filter="url(#smear)" font-family="Arial" fill="#2a2a2a"><text x="48" y="200" font-size="42" font-weight="bold">${esc(o.pan)}</text><text x="48" y="290" font-size="22" font-weight="bold">${esc(o.name.toUpperCase())}</text><text x="48" y="380" font-size="22" font-weight="bold">${esc(o.incorporated)}</text></g>
    <g filter="url(#soft)" font-family="Arial" fill="#777"><text x="48" y="256" font-size="16">Name</text><text x="48" y="346" font-size="16">${esc(o.dateLabel)}</text></g>
    <ellipse cx="250" cy="215" rx="230" ry="95" fill="url(#glare)"/>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 270]);
  page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: 420, height: 270 });
  await save(pdf, dir, "pan_card.pdf", "PAN card (photo)");
}

/** e-PAN card layout. */
async function panCard(dir: string, o: { name: string; pan: string; incorporated: string; dateLabel: string; blurry?: boolean }) {
  if (o.blurry) return blurryPanCard(dir, o);
  const { pdf, page, fonts } = await newDoc([420, 270]);
  page.drawRectangle({ x: 10, y: 10, width: 400, height: 250, borderColor: rgb(0.55, 0.55, 0.6), borderWidth: 1, color: rgb(0.95, 0.96, 0.98) });
  page.drawText("INCOME TAX DEPARTMENT", { x: 24, y: 232, size: 11, font: fonts.bold, color: ink });
  page.drawText("GOVT. OF INDIA", { x: 300, y: 232, size: 11, font: fonts.bold, color: ink });
  page.drawText("Permanent Account Number Card", { x: 24, y: 210, size: 9, font: fonts.reg, color: grey });
  page.drawText(o.pan, { x: 24, y: 178, size: 20, font: fonts.bold, color: ink });
  page.drawText(o.name.toUpperCase(), { x: 24, y: 132, size: 11, font: fonts.bold, color: ink });
  page.drawText("Name", { x: 24, y: 146, size: 8, font: fonts.reg, color: grey });
  page.drawText(o.dateLabel, { x: 24, y: 104, size: 8, font: fonts.reg, color: grey });
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

/** Bank account confirmation letter on bank letterhead, dated `date`. */
function bankLetter(dir: string, o: { bank: string; branch: string; ifsc: string; holder: string; account: string; micr: string; date: string }) {
  return certificate(dir, "bank_letter.pdf", {
    issuer: o.bank,
    sub: `${o.branch} Branch · IFSC ${o.ifsc} · MICR ${o.micr}`,
    title: "Bank Account Confirmation Letter",
    ref: `BAC/${o.ifsc.slice(0, 4)}/${o.account.slice(-4)}`,
    date: o.date,
    intro: `To whomsoever it may concern. This is to confirm that the following current account is maintained with us and is in operation as on the date of this letter.`,
    rows: [["Account Holder", o.holder], ["Account Number", o.account], ["Account Type", "Current Account"], ["IFSC", o.ifsc], ["MICR", o.micr], ["Branch", o.branch]],
    signer: "Branch Manager (Authorised Signatory)",
  });
}

/** A utility bill uploaded in the GST certificate slot. */
function electricityBill(dir: string, o: { consumer: string; address: string }) {
  return certificate(dir, "electricity_bill.pdf", {
    issuer: "Tamil Nadu Generation and Distribution Corporation",
    sub: "TANGEDCO · Low Tension Electricity Bill",
    title: "Electricity Bill - Commercial (LT-V)",
    ref: "SC No. 09-204-118-552",
    date: daysAgo(12),
    rows: [["Consumer Name", o.consumer], ["Service Address", o.address], ["Billing Period", `${daysAgo(72)} to ${daysAgo(12)}`], ["Units Consumed", "4,812 kWh"], ["Amount Payable", "Rs. 46,930.00"], ["Due Date", daysAgo(-8)]],
    signer: "Assistant Engineer / O&M",
  });
}

function gstCert(dir: string, o: { gstin: string; legal: string; trade?: string; constitution: string; address: string; state: string; liability: string; hidden?: string }) {
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
    hidden: o.hidden,
  });
}

const CONS: Record<string, string> = { private_limited: "Private Limited Company", llp: "Limited Liability Partnership", proprietorship: "Proprietorship" };
// What each IFSC's real branch prints on its cheques (HDFC0009999 is deliberately not a real branch).
const BANK: Record<string, { bank: string; branch: string; micr: string }> = {
  HDFC0000075: { bank: "HDFC BANK LTD.", branch: "Airport Road, Bangalore", micr: "560240005" },
  ICIC0000039: { bank: "ICICI BANK LTD.", branch: "Pune", micr: "411229003" },
  UTIB0000003: { bank: "AXIS BANK LTD.", branch: "Ahmedabad", micr: "380211002" },
  HDFC0000004: { bank: "HDFC BANK LTD.", branch: "ITC Centre, Anna Salai, Chennai", micr: "600240002" },
  KKBK0000958: { bank: "KOTAK MAHINDRA BANK LTD.", branch: "Nariman Point, Mumbai", micr: "400485002" },
  ICIC0000106: { bank: "ICICI BANK LTD.", branch: "Connaught Place, New Delhi", micr: "110229002" },
  SBIN0000800: { bank: "STATE BANK OF INDIA", branch: "Chennai Main", micr: "600002002" },
  SBIN0000813: { bank: "STATE BANK OF INDIA", branch: "Bangalore", micr: "560002057" },
  HDFC0000001: { bank: "HDFC BANK LTD.", branch: "Kamala Mills, Mumbai", micr: "400240002" },
  HDFC0009999: { bank: "HDFC BANK LTD.", branch: "Peenya, Bangalore", micr: "560240099" },
};

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  console.log("Generating sample documents:");
  for (const s of SAMPLE_CASES) {
    const d = s.data;
    const v = s.docs ?? {};
    const dir = s.files[0].url.split("/")[2];
    const names = new Set([...s.files, ...(s.resubmission ?? [])].map((x) => x.name));
    const legal = d.legal_name.replace(/Pvt Ltd$/, "Private Limited");
    const address = `${d.address_line}, ${d.city}, ${stateName(d.state)} ${d.pincode}`;
    const b = BANK[d.bank.ifsc];
    if (!b) throw new Error(`No branch data for ${d.bank.ifsc} (${s.id})`);
    const proprietor = d.constitution === "proprietorship";

    if (names.has("gst_certificate.pdf"))
      await gstCert(dir, { gstin: v.certGstin ?? d.gstin, legal, trade: d.trade_name, constitution: CONS[d.constitution], address, state: stateName(d.state), liability: "2021-07-01", hidden: v.injection });
    if (names.has("electricity_bill.pdf")) await electricityBill(dir, { consumer: legal, address });
    await panCard(dir, { name: legal, pan: d.pan, incorporated: proprietor ? "22/08/1978" : "14/03/2019", dateLabel: proprietor ? "Date of Birth" : "Date of Incorporation / Formation", blurry: v.blurryPan });
    const bank = { ...b, ifsc: d.bank.ifsc, holder: v.chequeHolder ?? d.bank.account_holder, account: d.bank.account_number };
    if (names.has("cancelled_cheque.pdf")) await cheque(dir, bank);
    if (names.has("bank_letter.pdf")) await bankLetter(dir, { ...bank, date: daysAgo(v.bankLetterDaysAgo ?? 10) });
    if (names.has("llp_certificate.pdf")) {
      await certificate(dir, "llp_certificate.pdf", {
        issuer: "Ministry of Corporate Affairs",
        sub: "Registrar of Companies · Form 16 · Limited Liability Partnership Act, 2008",
        title: "Certificate of Incorporation of Limited Liability Partnership",
        date: "2020-02-11",
        intro: `It is hereby certified that ${d.legal_name.toUpperCase()} is incorporated under the Limited Liability Partnership Act, 2008 on this eleventh day of February two thousand twenty.`,
        rows: [["LLP Name", d.legal_name], ["LLP Identification Number (LLPIN)", d.llpin!], ["Registered Office", address], ["Country", "India"]],
        signer: "Registrar of Companies, Ahmedabad",
      });
    }
    if (names.has("incorporation_certificate.pdf")) {
      await certificate(dir, "incorporation_certificate.pdf", {
        issuer: "Ministry of Corporate Affairs",
        sub: "Registrar of Companies · Government of India",
        title: "Certificate of Incorporation",
        date: "2019-03-14",
        intro: `I hereby certify that ${legal.toUpperCase()} is incorporated under the Companies Act, 2013, and that the company is limited by shares.`,
        rows: [["Company Name", legal], ["Corporate Identity Number (CIN)", d.cin ?? "-"], ["PAN", d.pan], ["Registered Office", address]],
        signer: "Registrar of Companies",
      });
    }
  }
  console.log(`Done. Dated documents are relative to ${daysAgo(0)}; re-run before a demo.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
