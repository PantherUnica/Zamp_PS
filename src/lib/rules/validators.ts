import type { Country } from "@/lib/types";

/** Deterministic, offline validators. No AI is involved in any of these. */

const B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function compact(v: string | null | undefined): string {
  return (v ?? "").toUpperCase().replace(/[\s.\-/]/g, "");
}

// ---------- India: GSTIN ----------
export function gstinChecksum(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = B36.indexOf(first14[i]);
    const prod = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(prod / 36) + (prod % 36);
  }
  return B36[(36 - (sum % 36)) % 36];
}

const GSTIN_RE = /^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$/;

export function validateGstin(raw: string): Result {
  const v = compact(raw);
  const m = GSTIN_RE.exec(v);
  if (!m) return fail(v, "GSTIN must be 15 characters: 2-digit state code, 10-character PAN, entity code, 'Z', checksum.");
  const state = Number(m[1]);
  if (state < 1 || state > 38) return fail(v, `State code ${m[1]} does not exist.`);
  const expected = gstinChecksum(v.slice(0, 14));
  if (expected !== v[14]) return fail(v, `Checksum character is '${v[14]}', expected '${expected}'. The number is mistyped or invented.`);
  return ok(v);
}

/** PAN embedded in a GSTIN: 4th char is holder type (C = company), 5th char is the first letter of the name. */
export function gstinPan(gstin: string): { pan: string; holderType: string; nameInitial: string } | null {
  const v = compact(gstin);
  if (!GSTIN_RE.test(v)) return null;
  const pan = v.slice(2, 12);
  return { pan, holderType: pan[3], nameInitial: pan[4] };
}

// ---------- US: EIN ----------
const EIN_INVALID_PREFIX = new Set(["00", "07", "08", "09", "17", "18", "19", "28", "29", "49", "69", "70", "78", "79", "89", "96", "97"]);

export function validateEin(raw: string): Result {
  const v = compact(raw);
  if (!/^\d{9}$/.test(v)) return fail(v, "EIN must be 9 digits (NN-NNNNNNN).");
  if (EIN_INVALID_PREFIX.has(v.slice(0, 2))) return fail(v, `EIN prefix ${v.slice(0, 2)} is not issued by the IRS.`);
  return ok(`${v.slice(0, 2)}-${v.slice(2)}`);
}

// ---------- UK: VAT ----------
export function gbVatValid(nine: string): boolean {
  const d = nine.split("").map(Number);
  const weights = [8, 7, 6, 5, 4, 3, 2];
  const total = weights.reduce((s, w, i) => s + w * d[i], 0);
  const check = d[7] * 10 + d[8];
  return (total + check) % 97 === 0 || (total + check + 55) % 97 === 0;
}

export function validateGbVat(raw: string): Result {
  let v = compact(raw);
  if (v.startsWith("GB")) v = v.slice(2);
  if (!/^\d{9}(\d{3})?$/.test(v)) return fail(compact(raw), "UK VAT number must be 'GB' followed by 9 digits.");
  if (!gbVatValid(v.slice(0, 9))) return fail(`GB${v}`, "UK VAT check digits do not match (modulus 97). The number is mistyped or invented.");
  return ok(`GB${v}`);
}

// ---------- Germany: USt-IdNr ----------
export function deVatCheckDigit(first8: string): number {
  let product = 10;
  for (const ch of first8) {
    let sum = (Number(ch) + product) % 10;
    if (sum === 0) sum = 10;
    product = (2 * sum) % 11;
  }
  const check = 11 - product;
  return check === 10 ? 0 : check;
}

export function validateDeVat(raw: string): Result {
  let v = compact(raw);
  if (v.startsWith("DE")) v = v.slice(2);
  if (!/^[1-9]\d{8}$/.test(v)) return fail(compact(raw), "German USt-IdNr. must be 'DE' followed by 9 digits.");
  if (deVatCheckDigit(v.slice(0, 8)) !== Number(v[8])) return fail(`DE${v}`, "USt-IdNr. check digit does not match (ISO 7064 MOD 11,10).");
  return ok(`DE${v}`);
}

export interface Result {
  valid: boolean;
  normalized: string;
  reason?: string;
}
const ok = (normalized: string): Result => ({ valid: true, normalized });
const fail = (normalized: string, reason: string): Result => ({ valid: false, normalized, reason });

export function validateTaxId(country: Country, raw: string): Result {
  switch (country) {
    case "IN":
      return validateGstin(raw);
    case "US":
      return validateEin(raw);
    case "GB":
      return validateGbVat(raw);
    case "DE":
      return validateDeVat(raw);
  }
}

/** Which countries' tax-ID formats this value looks like (shape only), used to explain mismatches. */
export function detectTaxIdCountries(raw: string): Country[] {
  const v = compact(raw);
  const hits: Country[] = [];
  if (GSTIN_RE.test(v)) hits.push("IN");
  if (/^\d{9}$/.test(v) || /^\d{2}-\d{7}$/.test((raw ?? "").trim())) hits.push("US");
  if (/^GB\d{9}(\d{3})?$/.test(v)) hits.push("GB");
  if (/^DE\d{9}$/.test(v)) hits.push("DE");
  return hits;
}

// ---------- Banking ----------
const IBAN_LENGTH: Record<string, number> = { DE: 22, GB: 22, FR: 27, NL: 18, IE: 22, CY: 28, ES: 24, IT: 27 };

export function ibanCheckDigits(countryCode: string, bban: string): string {
  const rearranged = bban + countryCode + "00";
  const remainder = mod97(toDigits(rearranged));
  return String(98 - remainder).padStart(2, "0");
}

function toDigits(s: string): string {
  return s
    .split("")
    .map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c))
    .join("");
}

function mod97(digits: string): number {
  let rem = 0;
  for (let i = 0; i < digits.length; i += 7) rem = Number(String(rem) + digits.slice(i, i + 7)) % 97;
  return rem;
}

export function validateIban(raw: string): Result & { country?: string } {
  const v = compact(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return fail(v, "IBAN must start with a 2-letter country code and 2 check digits.");
  const cc = v.slice(0, 2);
  if (IBAN_LENGTH[cc] && v.length !== IBAN_LENGTH[cc]) return { ...fail(v, `${cc} IBANs are ${IBAN_LENGTH[cc]} characters; this one has ${v.length}.`), country: cc };
  if (mod97(toDigits(v.slice(4) + v.slice(0, 4))) !== 1) return { ...fail(v, "IBAN check digits do not match (ISO 13616 mod 97)."), country: cc };
  return { ...ok(v), country: cc };
}

export function validateIfsc(raw: string): Result {
  const v = compact(raw);
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) ? ok(v) : fail(v, "IFSC must be 11 characters: 4-letter bank code, '0', 6-character branch code.");
}

export function validateRouting(raw: string): Result {
  const v = compact(raw);
  if (!/^\d{9}$/.test(v)) return fail(v, "ABA routing number must be 9 digits.");
  const d = v.split("").map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return sum % 10 === 0 ? ok(v) : fail(v, "ABA routing number checksum fails.");
}

export function validateAccountNumber(country: Country, raw: string): Result {
  const v = compact(raw);
  if (country === "IN") return /^\d{9,18}$/.test(v) ? ok(v) : fail(v, "Indian account numbers are 9–18 digits.");
  if (country === "US") return /^\d{4,17}$/.test(v) ? ok(v) : fail(v, "US account numbers are 4–17 digits.");
  return /^\d{6,34}$/.test(v) ? ok(v) : fail(v, "Account number must be digits only.");
}

/** Canonical bank-account key used for duplicate detection across submissions. */
export function bankAccountKey(bank: { iban?: string; account_number?: string; ifsc?: string; routing_number?: string }): string | null {
  if (bank.iban) return compact(bank.iban);
  if (bank.account_number) return `${compact(bank.ifsc || bank.routing_number || "")}:${compact(bank.account_number)}`;
  return null;
}

/** Parse loose dates from documents (YYYY-MM-DD preferred). */
export function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}
