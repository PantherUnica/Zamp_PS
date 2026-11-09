/**
 * External records. The only external source wired in today is the public Razorpay IFSC
 * directory (no key, real RBI branch data). GSTIN, PAN and bank-account ownership have no free
 * public API, so those checks are reported as "not connected" — never as passed.
 */
export interface IfscRecord {
  bank: string;
  branch: string;
  city: string;
  state: string;
  bankCode: string;
}

export type IfscLookup =
  | { status: "found"; record: IfscRecord }
  | { status: "not_found" }
  | { status: "unavailable"; error: string };

export async function lookupIfsc(ifsc: string): Promise<IfscLookup> {
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc)}`, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "unavailable", error: `Directory returned HTTP ${res.status}` };
    const j = (await res.json()) as Record<string, string>;
    return {
      status: "found",
      record: { bank: j.BANK, branch: j.BRANCH, city: j.CITY, state: j.STATE, bankCode: j.BANKCODE },
    };
  } catch (err) {
    return { status: "unavailable", error: err instanceof Error ? err.message : String(err) };
  }
}

export const NOT_CONNECTED = [
  { id: "registry_gstin", label: "GSTIN in GST Network records", detail: "Not connected. No GSTN / GST Suvidha Provider API is configured, so the GSTIN was checked for format, checksum and against the uploaded certificate only." },
  { id: "registry_pan", label: "PAN in Income Tax records", detail: "Not connected. No PAN verification provider is configured, so the PAN was checked for format and against the uploaded card only." },
  { id: "registry_bank", label: "Bank account ownership (penny drop)", detail: "Not connected. Account ownership was checked against the uploaded cheque / bank letter only; no money was deposited to confirm the holder name." },
];
