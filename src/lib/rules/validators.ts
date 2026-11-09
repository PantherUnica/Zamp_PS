import { STATES, stateByCode } from "@/lib/india";

/** Deterministic, offline validators for Indian business identifiers. No AI. */

const B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface Result {
  valid: boolean;
  normalized: string;
  reason?: string;
}
const ok = (normalized: string): Result => ({ valid: true, normalized });
const fail = (normalized: string, reason: string): Result => ({ valid: false, normalized, reason });

export function compact(v: string | null | undefined): string {
  return (v ?? "").toUpperCase().replace(/[\s.\-/]/g, "");
}

// ---------- GSTIN: SS + PAN(10) + entity + Z + checksum
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
  if (v.length !== 15) return fail(v, `GSTIN must be exactly 15 characters; this one has ${v.length}.`);
  const m = GSTIN_RE.exec(v);
  if (!m) return fail(v, "GSTIN must be: 2-digit state code, 10-character PAN, entity number, 'Z', check character.");
  if (!stateByCode(m[1]) && m[1] !== "97") return fail(v, `State code ${m[1]} is not a GST state code.`);
  const expected = gstinChecksum(v.slice(0, 14));
  if (expected !== v[14]) return fail(v, `Check character is '${v[14]}', expected '${expected}'. The GSTIN is mistyped or invented.`);
  return ok(v);
}

export function gstinParts(raw: string): { state: string; pan: string } | null {
  const v = compact(raw);
  const m = GSTIN_RE.exec(v);
  return m ? { state: m[1], pan: m[2] } : null;
}

// ---------- PAN: AAAAA9999A, 4th char = holder type
const PAN_RE = /^[A-Z]{3}([ABCFGHJLPT])[A-Z]\d{4}[A-Z]$/;
export const PAN_HOLDER: Record<string, string> = {
  C: "company",
  F: "firm / LLP",
  P: "individual",
  H: "HUF",
  A: "association of persons",
  T: "trust",
  B: "body of individuals",
  L: "local authority",
  J: "artificial juridical person",
  G: "government",
};

export function validatePan(raw: string): Result {
  const v = compact(raw);
  if (v.length !== 10) return fail(v, `PAN must be exactly 10 characters; this one has ${v.length}.`);
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(v)) return fail(v, "PAN must be 5 letters, 4 digits, 1 letter (e.g. AABCN1234F).");
  if (!PAN_RE.test(v)) return fail(v, `The 4th character '${v[3]}' is not a valid PAN holder type.`);
  return ok(v);
}

// ---------- Bank
export function validateIfsc(raw: string): Result {
  const v = compact(raw);
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) ? ok(v) : fail(v, "IFSC must be 11 characters: 4-letter bank code, '0', 6-character branch code (e.g. HDFC0000075).");
}

export function validateAccountNumber(raw: string): Result {
  const v = (raw ?? "").replace(/\s/g, "");
  if (!/^\d+$/.test(v)) return fail(v, "Account number must contain digits only.");
  return v.length >= 9 && v.length <= 18 ? ok(v) : fail(v, `Indian bank account numbers are 9–18 digits; this one has ${v.length}.`);
}

export function bankAccountKey(bank: { ifsc?: string; account_number?: string }): string | null {
  if (!bank?.account_number) return null;
  return `${compact(bank.ifsc)}:${(bank.account_number ?? "").replace(/\s/g, "")}`;
}

// ---------- Company identifiers
const CIN_RE = /^[LU]\d{5}[A-Z]{2}\d{4}(PLC|PTC|OPC|FLC|FTC|GOI|SGC|NPL|GAP|GAT|ULL|ULT)\d{6}$/;
export function validateCin(raw: string): Result {
  const v = compact(raw);
  if (v.length !== 21) return fail(v, `CIN must be 21 characters; this one has ${v.length}.`);
  return CIN_RE.test(v) ? ok(v) : fail(v, "CIN format is L/U + 5-digit industry code + 2-letter state + year + company type + 6 digits.");
}

export function validateLlpin(raw: string): Result {
  const v = (raw ?? "").toUpperCase().replace(/\s/g, "");
  return /^[A-Z]{3}-\d{4}$/.test(v) ? ok(v) : fail(v, "LLPIN format is AAA-1234.");
}

export function validateUdyam(raw: string): Result {
  const v = (raw ?? "").toUpperCase().replace(/\s/g, "");
  return /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(v) ? ok(v) : fail(v, "Udyam number format is UDYAM-XX-00-0000000.");
}

// ---------- Contact and address
export function validatePincode(raw: string): Result {
  const v = (raw ?? "").replace(/\s/g, "");
  return /^[1-9]\d{5}$/.test(v) ? ok(v) : fail(v, "PIN code must be 6 digits and cannot start with 0.");
}

/** PIN codes are zoned by first digit; a PIN outside the state's zone is almost always a typo. */
export function pincodeMatchesState(pincode: string, stateCode: string): boolean {
  const s = STATES.find((x) => x.code === stateCode);
  if (!s || !/^\d{6}$/.test(pincode)) return true;
  return s.pin.includes(Number(pincode[0]));
}

export function normalizePhone(raw: string): Result {
  const digits = (raw ?? "").replace(/[^\d+]/g, "");
  const m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(digits);
  return m ? ok(`+91 ${m[1].slice(0, 5)} ${m[1].slice(5)}`) : fail(raw, "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.");
}

export function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(v);
  if (dmy) return new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]));
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}
