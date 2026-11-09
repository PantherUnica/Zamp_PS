/** Company-name normalisation and similarity. Deterministic: no AI. */

const EXPAND: Record<string, string> = {
  pvt: "private",
  pte: "private",
  ltd: "limited",
  co: "company",
  corp: "corporation",
  inc: "incorporated",
  llc: "llc",
  gmbh: "gmbh",
  "&": "and",
};

const LEGAL_FORMS = new Set([
  "private", "limited", "company", "corporation", "incorporated", "llc", "llp", "plc",
  "gmbh", "ag", "kg", "ug", "mbh", "the", "and", "public",
]);

export function tokens(name: string): string[] {
  return (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " & ")
    .replace(/[^a-z0-9& ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => EXPAND[t] ?? t);
}

export function normalizeName(name: string): string {
  return tokens(name).join(" ");
}

/** Distinctive part of the name with legal forms removed ("Northwind Components"). */
export function coreName(name: string): string {
  const core = tokens(name).filter((t) => !LEGAL_FORMS.has(t));
  return core.length ? core.join(" ") : normalizeName(name);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

export interface NameMatch {
  score: number; // 0..1
  suffixOnly: boolean; // identical once legal forms are normalised away
  a: string;
  b: string;
}

export function compareNames(a: string, b: string): NameMatch {
  const ca = coreName(a);
  const cb = coreName(b);
  const plain = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (plain(a) === plain(b)) return { score: 1, suffixOnly: false, a: ca, b: cb };
  // Same distinctive name, legal form written differently ("Pvt Ltd" vs "Private Limited").
  if (normalizeName(a) === normalizeName(b) || ca === cb) return { score: 1, suffixOnly: true, a: ca, b: cb };
  const sorted = (s: string) => s.split(" ").sort().join(" ");
  const score = Math.max(ratio(ca, cb), ratio(sorted(ca), sorted(cb)));
  return { score: Math.round(score * 100) / 100, suffixOnly: false, a: ca, b: cb };
}
