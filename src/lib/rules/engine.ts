import type {
  Check,
  Country,
  DuplicateHit,
  Evidence,
  Extraction,
  ExtractField,
  Finding,
  Recommendation,
  Slot,
  SubmissionData,
} from "@/lib/types";
import { SLOTS } from "@/lib/types";
import { COUNTRIES, SLOT_LABEL } from "./countries";
import {
  bankAccountKey,
  compact,
  detectTaxIdCountries,
  gstinPan,
  parseDate,
  validateAccountNumber,
  validateIban,
  validateIfsc,
  validateRouting,
  validateTaxId,
} from "./validators";
import { compareNames, coreName } from "./names";

/**
 * Policy. All thresholds live here. The decision is a pure function of findings + policy.
 * AI output only ever becomes *input* to these rules; it never sets the outcome.
 */
export const POLICY = {
  nameMatchPass: 0.92,
  nameMatchGrey: 0.75,
  minFieldConfidence: 0.75,
  minTypeConfidence: 0.6,
  bankProofMaxAgeDays: 90,
  maxRounds: 3,
} as const;

export interface StageOutcome {
  checks: Check[];
  findings: Finding[];
}

export interface EngineContext {
  data: SubmissionData;
  docs: { id: string; slot: Slot; file_name: string }[];
  extractions: Extraction[];
  previousData?: SubmissionData;
  /** Fields/slots the vendor was asked to change in the open request. Changes to anything else are flagged. */
  requested: Set<string>;
  duplicates: DuplicateHit[];
  round: number;
  now: Date;
}

const countryName = (c: string) => COUNTRIES[c as Country]?.name ?? c;
const docLabel = (country: Country, slot: Slot) => COUNTRIES[country].documents[slot].label;

function ex(ctx: EngineContext, slot: Slot): Extraction | undefined {
  return ctx.extractions.find((e) => e.slot === slot && !e.error);
}

/** A document value we are willing to compare against: right document type, confident read. */
function reliable(e: Extraction | undefined, field: ExtractField): string | null {
  if (!e || e.error || e.document_type !== e.slot) return null;
  const f = e.fields[field];
  if (!f?.value || f.confidence < POLICY.minFieldConfidence) return null;
  return f.value;
}

// ---------------------------------------------------------------- 1. intake
export function stageIntake(ctx: EngineContext): StageOutcome {
  const checks: Check[] = [];
  const findings: Finding[] = [];
  const c = COUNTRIES[ctx.data.country];
  checks.push({
    id: "form_complete",
    stage: "intake",
    label: "Mandatory form fields",
    status: "pass",
    detail: "Company, tax, contact and bank fields are present and well-formed.",
  });
  for (const slot of SLOTS) {
    const doc = ctx.docs.find((d) => d.slot === slot);
    if (doc) {
      checks.push({ id: `doc_${slot}`, stage: "intake", label: c.documents[slot].label, status: "pass", detail: `Received ${doc.file_name}` });
    } else {
      checks.push({ id: `doc_${slot}`, stage: "intake", label: c.documents[slot].label, status: "fail", detail: "Not uploaded" });
      findings.push({
        code: "MISSING_DOCUMENT",
        severity: "fixable",
        stage: "intake",
        slot,
        title: `Missing ${c.documents[slot].label.toLowerCase()}`,
        detail: `${c.name} vendors must provide a ${c.documents[slot].label.toLowerCase()} (${c.documents[slot].hint}).`,
        vendorAction: `Upload your ${c.documents[slot].label} (${c.documents[slot].hint}).`,
      });
    }
  }
  return { checks, findings };
}

// ---------------------------------------------------------------- 2. read (AI output → findings)
const KEY_FIELDS: Record<Slot, ExtractField[][]> = {
  tax_certificate: [["legal_name"], ["tax_id"]],
  bank_proof: [["account_holder"], ["account_number", "iban"]],
  incorporation_certificate: [["legal_name"]],
};

export function stageRead(ctx: EngineContext): StageOutcome {
  const checks: Check[] = [];
  const findings: Finding[] = [];
  const country = ctx.data.country;
  for (const e of ctx.extractions) {
    const label = docLabel(country, e.slot);
    if (e.error) {
      checks.push({ id: `read_${e.slot}`, stage: "read", label, status: "fail", detail: `AI extraction failed: ${e.error}` });
      findings.push({
        code: "EXTRACTION_FAILED",
        severity: "review",
        stage: "read",
        slot: e.slot,
        title: `Could not read ${label.toLowerCase()}`,
        detail: `Automatic extraction failed (${e.error}). A reviewer must inspect this document manually; nothing was assumed.`,
      });
      continue;
    }
    if (e.document_type !== e.slot && e.type_confidence >= POLICY.minTypeConfidence) {
      const actual = e.document_type === "other" ? "an unrelated document" : `a ${SLOT_LABEL[e.document_type as Slot].toLowerCase()}`;
      checks.push({ id: `type_${e.slot}`, stage: "read", label, status: "fail", detail: `Classified as ${e.document_type} (${pct(e.type_confidence)})` });
      findings.push({
        code: "WRONG_DOCUMENT",
        severity: "fixable",
        stage: "read",
        slot: e.slot,
        title: `Wrong document uploaded as ${label.toLowerCase()}`,
        detail: `${e.file_name} appears to be ${actual}, not a ${label.toLowerCase()}.`,
        evidence: [{ label: "Classified as", value: `${e.document_type} · ${pct(e.type_confidence)}` }],
        vendorAction: `The file you uploaded as your ${label} (${e.file_name}) is ${actual}. Please upload the correct ${label}.`,
      });
      continue;
    }
    checks.push({ id: `type_${e.slot}`, stage: "read", label, status: "pass", detail: `Classified as ${label} (${pct(e.type_confidence)})` });

    const weak: string[] = [];
    for (const group of KEY_FIELDS[e.slot]) {
      const vals = group.map((f) => e.fields[f]).filter((v) => v.value);
      const best = vals.sort((a, b) => b.confidence - a.confidence)[0];
      if (!best || best.confidence < POLICY.minFieldConfidence) weak.push(group.join(" / ").replace(/_/g, " "));
    }
    if (e.readability === "unreadable" || weak.length) {
      checks.push({ id: `conf_${e.slot}`, stage: "read", label: `${label}: key fields`, status: "fail", detail: weak.length ? `Low confidence or missing: ${weak.join(", ")}` : "Document unreadable" });
      findings.push({
        code: "UNCLEAR_DOCUMENT",
        severity: "fixable",
        stage: "read",
        slot: e.slot,
        title: `${label} is not clearly readable`,
        detail: `Could not confidently read ${weak.join(", ") || "the document"} (threshold ${pct(POLICY.minFieldConfidence)}). Values are not guessed.`,
        vendorAction: `Upload a clearer, complete copy of your ${label}. We could not read: ${weak.join(", ") || "the document"}.`,
      });
    } else {
      checks.push({ id: `conf_${e.slot}`, stage: "read", label: `${label}: key fields`, status: "pass", detail: "Key fields read above confidence threshold" });
    }

    if (e.embedded_instructions.detected) {
      checks.push({ id: `inj_${e.slot}`, stage: "read", label: `${label}: content safety`, status: "fail", detail: "Instruction-like text found inside the document" });
      findings.push({
        code: "SUSPICIOUS_CONTENT",
        severity: "review",
        stage: "read",
        slot: e.slot,
        title: "Document contains embedded instructions",
        detail: "Text inside the document tries to instruct the system. It was treated as data and ignored, but the document needs human review.",
        evidence: [{ label: "Text found", value: (e.embedded_instructions.text ?? "").slice(0, 200) }],
      });
    }
  }
  return { checks, findings };
}

// ---------------------------------------------------------------- 3. validate (formats, dates)
export function stageValidate(ctx: EngineContext): StageOutcome {
  const checks: Check[] = [];
  const findings: Finding[] = [];
  const { data } = ctx;
  const c = COUNTRIES[data.country];

  const tax = validateTaxId(data.country, data.tax_id);
  const looksLike = detectTaxIdCountries(data.tax_id).filter((x) => x !== data.country);
  checks.push({
    id: "tax_format",
    stage: "validate",
    label: `${c.taxIdLabel} format (${c.name})`,
    status: tax.valid ? "pass" : "fail",
    detail: tax.valid ? `${tax.normalized} is a valid ${c.taxIdLabel}` : tax.reason!,
    evidence: [{ label: "Submitted", value: data.tax_id }],
  });
  if (!tax.valid) {
    findings.push({
      code: "TAX_ID_INVALID",
      severity: "fixable",
      stage: "validate",
      field: "tax_id",
      title: `${c.taxIdLabel} is not valid for ${c.name}`,
      detail: tax.reason!,
      evidence: [
        { label: "Submitted", value: data.tax_id },
        { label: "Expected format", value: `${c.taxIdHint} (e.g. ${c.taxIdExample})` },
      ],
      vendorAction: `Correct your ${c.taxIdLabel}. ${tax.reason} Expected format: ${c.taxIdHint}, e.g. ${c.taxIdExample}.`,
    });
  }
  if (looksLike.length) {
    findings.push({
      code: "TAX_ID_COUNTRY_MISMATCH",
      severity: "review",
      stage: "validate",
      field: "tax_id",
      title: `Tax ID matches the ${looksLike.map(countryName).join("/")} format, not ${c.name}`,
      detail: `The company is declared in ${c.name}, but the tax ID has the shape of a ${looksLike.map((x) => COUNTRIES[x].taxIdLabel).join(" / ")}. Either the country or the tax registration is wrong.`,
      evidence: [
        { label: "Declared country", value: c.name },
        { label: "Tax ID", value: data.tax_id },
        { label: "Format detected", value: looksLike.map((x) => `${COUNTRIES[x].taxIdLabel} (${x})`).join(", ") },
      ],
    });
  }

  // Bank details per bank country
  const b = data.bank;
  const bankRules: [string, ReturnType<typeof validateIban>][] = [];
  if (b.iban) bankRules.push(["IBAN", validateIban(b.iban)]);
  if (b.ifsc) bankRules.push(["IFSC", validateIfsc(b.ifsc)]);
  if (b.routing_number) bankRules.push(["Routing number", validateRouting(b.routing_number)]);
  if (b.account_number) bankRules.push(["Account number", validateAccountNumber(b.bank_country, b.account_number)]);
  for (const [label, r] of bankRules) {
    checks.push({ id: `bank_${label}`, stage: "validate", label, status: r.valid ? "pass" : "fail", detail: r.valid ? `${r.normalized} is valid` : r.reason! });
    if (!r.valid) {
      findings.push({
        code: "BANK_DETAILS_INVALID",
        severity: "fixable",
        stage: "validate",
        field: `bank.${label.toLowerCase().replace(/ /g, "_")}`,
        title: `${label} is not valid`,
        detail: r.reason!,
        evidence: [{ label: "Submitted", value: r.normalized }],
        vendorAction: `Correct your ${label}: ${r.reason}`,
      });
    }
  }

  // Document dates
  const bankDoc = ex(ctx, "bank_proof");
  const issued = parseDate(reliable(bankDoc, "issue_date"));
  if (issued) {
    const age = Math.floor((ctx.now.getTime() - issued.getTime()) / 86_400_000);
    const fresh = age <= POLICY.bankProofMaxAgeDays;
    checks.push({ id: "bank_proof_age", stage: "validate", label: "Bank proof recency", status: fresh ? "pass" : "fail", detail: `Issued ${iso(issued)} (${age} days ago, limit ${POLICY.bankProofMaxAgeDays})` });
    if (!fresh) {
      findings.push({
        code: "BANK_PROOF_STALE",
        severity: "fixable",
        stage: "validate",
        slot: "bank_proof",
        title: "Bank proof is older than 90 days",
        detail: `The bank document is dated ${iso(issued)}, ${age} days ago.`,
        vendorAction: `Upload a bank letter or statement issued within the last ${POLICY.bankProofMaxAgeDays} days (the current one is dated ${iso(issued)}).`,
      });
    }
  }
  for (const e of ctx.extractions) {
    const exp = parseDate(reliable(e, "expiry_date"));
    if (exp && exp < ctx.now) {
      const label = docLabel(data.country, e.slot);
      findings.push({
        code: "DOCUMENT_EXPIRED",
        severity: "fixable",
        stage: "validate",
        slot: e.slot,
        title: `${label} has expired`,
        detail: `Expired on ${iso(exp)}.`,
        vendorAction: `Upload a current ${label}; the one provided expired on ${iso(exp)}.`,
      });
      checks.push({ id: `expiry_${e.slot}`, stage: "validate", label: `${label} validity`, status: "fail", detail: `Expired ${iso(exp)}` });
    }
  }
  return { checks, findings };
}

// ---------------------------------------------------------------- 4. cross-checks
function nameCheck(
  out: StageOutcome,
  id: string,
  label: string,
  code: string,
  submitted: string,
  found: string,
  source: string,
  slot?: Slot,
) {
  const m = compareNames(submitted, found);
  const evidence: Evidence[] = [
    { label: "Submitted legal name", value: submitted },
    { label: source, value: found },
    { label: "Match score", value: `${Math.round(m.score * 100)} / 100${m.suffixOnly ? " (legal suffix only)" : ""}` },
  ];
  if (m.score >= POLICY.nameMatchPass) {
    out.checks.push({ id, stage: "crosscheck", label, status: "pass", detail: m.suffixOnly ? "Same entity; only the legal suffix is written differently" : "Names match", evidence });
    if (m.suffixOnly) {
      out.findings.push({ code: "NAME_SUFFIX_VARIANT", severity: "info", stage: "crosscheck", slot, title: `${label}: legal suffix written differently`, detail: `"${submitted}" and "${found}" are the same name once legal forms are normalised.`, evidence });
    }
    return;
  }
  const grey = m.score >= POLICY.nameMatchGrey;
  out.checks.push({ id, stage: "crosscheck", label, status: "fail", detail: grey ? "Names are similar but not the same" : "Names refer to different entities", evidence });
  out.findings.push({
    code,
    severity: "review",
    stage: "crosscheck",
    slot,
    title: `${label}: names do not match`,
    detail: grey
      ? `"${found}" is close to but not the same as "${submitted}" (score ${Math.round(m.score * 100)}). Could be a trading name or a different entity.`
      : `"${found}" does not match "${submitted}" (score ${Math.round(m.score * 100)}). Payments could go to a different entity.`,
    evidence,
  });
}

export function stageCrosscheck(ctx: EngineContext): StageOutcome {
  const out: StageOutcome = { checks: [], findings: [] };
  const { data } = ctx;
  const country = data.country;
  const inc = ex(ctx, "incorporation_certificate");
  const tax = ex(ctx, "tax_certificate");
  const bank = ex(ctx, "bank_proof");

  const incName = reliable(inc, "legal_name");
  if (incName) nameCheck(out, "name_registry", "Company name vs registration certificate", "NAME_MISMATCH", data.legal_name, incName, docLabel(country, "incorporation_certificate"), "incorporation_certificate");
  const taxName = reliable(tax, "legal_name");
  if (taxName) nameCheck(out, "name_tax", "Company name vs tax certificate", "NAME_MISMATCH", data.legal_name, taxName, docLabel(country, "tax_certificate"), "tax_certificate");

  // Bank account holder: as typed by the vendor, and as printed on the bank document.
  nameCheck(out, "bank_holder_form", "Company name vs bank account holder (form)", "BANK_NAME_MISMATCH", data.legal_name, data.bank.account_holder, "Account holder on form");
  const docHolder = reliable(bank, "account_holder");
  if (docHolder) nameCheck(out, "bank_holder_doc", "Company name vs bank account holder (bank document)", "BANK_NAME_MISMATCH", data.legal_name, docHolder, docLabel(country, "bank_proof"), "bank_proof");

  // Tax ID on form vs tax certificate
  const docTax = reliable(tax, "tax_id");
  if (docTax) {
    const same = compact(docTax).replace(/^(GB|DE)/, "") === compact(data.tax_id).replace(/^(GB|DE)/, "");
    out.checks.push({ id: "tax_vs_cert", stage: "crosscheck", label: "Tax ID vs tax certificate", status: same ? "pass" : "fail", detail: same ? "Tax ID matches the certificate" : "Tax ID on the form differs from the certificate", evidence: [{ label: "Form", value: data.tax_id }, { label: "Certificate", value: docTax }] });
    if (!same) {
      out.findings.push({
        code: "TAX_ID_DOCUMENT_CONFLICT",
        severity: "review",
        stage: "crosscheck",
        field: "tax_id",
        slot: "tax_certificate",
        title: "Tax ID conflicts with the tax certificate",
        detail: "The tax ID entered on the form is not the one printed on the uploaded tax certificate.",
        evidence: [{ label: "Form", value: data.tax_id }, { label: "Certificate", value: docTax }],
      });
    }
  }

  // Bank account on form vs bank document
  const docAcct = reliable(bank, "iban") ?? reliable(bank, "account_number");
  const formAcct = data.bank.iban ?? data.bank.account_number;
  if (docAcct && formAcct) {
    const same = compact(docAcct) === compact(formAcct) || compact(docAcct).endsWith(compact(formAcct)) || compact(formAcct).endsWith(compact(docAcct));
    out.checks.push({ id: "acct_vs_doc", stage: "crosscheck", label: "Bank account vs bank document", status: same ? "pass" : "fail", detail: same ? "Account number matches the bank document" : "Account number differs from the bank document", evidence: [{ label: "Form", value: formAcct }, { label: "Bank document", value: docAcct }] });
    if (!same) {
      out.findings.push({ code: "BANK_ACCOUNT_CONFLICT", severity: "review", stage: "crosscheck", slot: "bank_proof", title: "Bank account conflicts with the bank document", detail: "The account entered on the form is not the account on the bank document.", evidence: [{ label: "Form", value: formAcct }, { label: "Bank document", value: docAcct }] });
    }
  }

  // Country on registration / tax documents
  for (const e of [inc, tax]) {
    const docCountry = reliable(e, "country");
    if (!docCountry || !e) continue;
    const cc = docCountry.toUpperCase().slice(0, 2);
    const same = cc === country;
    out.checks.push({ id: `country_${e.slot}`, stage: "crosscheck", label: `Country on ${docLabel(country, e.slot).toLowerCase()}`, status: same ? "pass" : "fail", detail: same ? `Issued in ${countryName(country)}` : `Issued in ${countryName(cc)}, company declared in ${countryName(country)}` });
    if (!same) {
      out.findings.push({ code: "COUNTRY_MISMATCH", severity: "review", stage: "crosscheck", slot: e.slot, title: "Document issued in a different country", detail: `${docLabel(country, e.slot)} was issued in ${countryName(cc)}, but the company is declared in ${countryName(country)}.`, evidence: [{ label: "Declared", value: countryName(country) }, { label: "Document", value: countryName(cc) }] });
    }
  }

  // India: the PAN embedded in a GSTIN encodes the holder's name initial.
  if (country === "IN") {
    const pan = gstinPan(data.tax_id);
    if (pan) {
      const initial = coreName(data.legal_name)[0]?.toUpperCase();
      const same = initial === pan.nameInitial;
      out.checks.push({ id: "gstin_pan_name", stage: "crosscheck", label: "GSTIN PAN vs company name", status: same ? "pass" : "fail", detail: same ? `PAN ${pan.pan} is consistent with the company name` : `PAN ${pan.pan} belongs to a name starting with '${pan.nameInitial}', company name starts with '${initial}'` });
      if (!same) {
        out.findings.push({ code: "TAX_ID_ENTITY_CONFLICT", severity: "review", stage: "crosscheck", field: "tax_id", title: "Tax ID belongs to a differently named entity", detail: `The PAN inside this GSTIN (${pan.pan}) is issued to a name starting with '${pan.nameInitial}', but the company is "${data.legal_name}".`, evidence: [{ label: "GSTIN", value: compact(data.tax_id) }, { label: "Embedded PAN", value: pan.pan }] });
      }
    }
  }

  // Resubmission: anything verified earlier that changed without being requested.
  if (ctx.previousData) {
    const prev = ctx.previousData;
    const pairs: [string, string, string][] = [
      ["legal_name", prev.legal_name, data.legal_name],
      ["tax_id", compact(prev.tax_id), compact(data.tax_id)],
      ["bank.account", bankAccountKey(prev.bank) ?? "", bankAccountKey(data.bank) ?? ""],
      ["bank.account_holder", prev.bank.account_holder, data.bank.account_holder],
    ];
    for (const [field, before, after] of pairs) {
      if (before !== after && !ctx.requested.has(field) && !(field.startsWith("bank") && ctx.requested.has("bank"))) {
        out.findings.push({ code: "VERIFIED_FIELD_CHANGED", severity: "review", stage: "crosscheck", field, title: `${field.replace("bank.", "bank ").replace("_", " ")} changed without being requested`, detail: "This value was already submitted in an earlier round and was not part of the information request. Unrequested changes to identity or bank fields need review.", evidence: [{ label: "Before", value: before }, { label: "Now", value: after }] });
        out.checks.push({ id: `changed_${field}`, stage: "crosscheck", label: `Unrequested change: ${field}`, status: "fail", detail: `${before} → ${after}` });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- 5. risk
export function stageRisk(ctx: EngineContext): StageOutcome {
  const checks: Check[] = [];
  const findings: Finding[] = [];
  const { data } = ctx;
  if (!ctx.duplicates.length) {
    checks.push({ id: "dupes", stage: "risk", label: "Duplicate tax ID / bank account", status: "pass", detail: "No other vendor uses this tax ID or bank account" });
  }
  for (const d of ctx.duplicates) {
    const m = compareNames(data.legal_name, d.legal_name);
    const what = d.matched_on === "tax_id" ? "tax ID" : "bank account";
    const evidence = [
      { label: "Other vendor", value: `${d.ref} · ${d.legal_name} · ${d.status}` },
      { label: "Shared", value: what },
    ];
    if (d.status === "approved" && m.score < POLICY.nameMatchPass) {
      checks.push({ id: `dupe_${d.ref}`, stage: "risk", label: `Shared ${what}`, status: "fail", detail: `Registered to approved vendor ${d.ref} (${d.legal_name})` });
      findings.push({ code: "IDENTITY_CONFLICT", severity: "block", stage: "risk", title: `${what[0].toUpperCase() + what.slice(1)} belongs to another approved vendor`, detail: `The ${what} is already registered to ${d.legal_name} (${d.ref}), a different approved vendor. This is a known payment-fraud pattern.`, evidence });
    } else if (m.score >= POLICY.nameMatchPass) {
      checks.push({ id: `dupe_${d.ref}`, stage: "risk", label: `Possible duplicate of ${d.ref}`, status: "warn", detail: `Same ${what} and name as ${d.ref} (${d.status})` });
      findings.push({ code: "DUPLICATE_VENDOR", severity: "review", stage: "risk", title: `Possible duplicate of ${d.ref}`, detail: `${d.ref} has the same ${what} and name and is ${d.status.replace("_", " ")}. Creating a second record would duplicate the vendor.`, evidence });
    } else {
      checks.push({ id: `dupe_${d.ref}`, stage: "risk", label: `Shared ${what}`, status: "fail", detail: `Also used by ${d.ref} (${d.legal_name})` });
      findings.push({ code: "SHARED_IDENTIFIER", severity: "review", stage: "risk", title: `${what[0].toUpperCase() + what.slice(1)} shared with ${d.legal_name}`, detail: `Another submission (${d.ref}, ${d.status.replace("_", " ")}) under a different name uses the same ${what}.`, evidence });
    }
  }
  const bankCountry = data.bank.bank_country;
  const ibanCc = data.bank.iban ? compact(data.bank.iban).slice(0, 2) : null;
  const sameCountry = bankCountry === data.country && (!ibanCc || ibanCc === data.country);
  checks.push({ id: "bank_country", stage: "risk", label: "Bank country vs company country", status: sameCountry ? "pass" : "fail", detail: sameCountry ? `Both ${countryName(data.country)}` : `Company in ${countryName(data.country)}, bank in ${countryName(ibanCc ?? bankCountry)}` });
  if (!sameCountry) {
    findings.push({ code: "BANK_COUNTRY_MISMATCH", severity: "review", stage: "risk", title: "Bank account is in a different country", detail: `The company is registered in ${countryName(data.country)} but the bank account is in ${countryName(ibanCc ?? bankCountry)}.`, evidence: [{ label: "Company", value: data.country }, { label: "Bank", value: ibanCc ?? bankCountry }] });
  }
  return { checks, findings };
}

// ---------------------------------------------------------------- 6. decide
export interface Decision {
  recommendation: Recommendation;
  route: "awaiting_vendor" | "awaiting_review";
  reasons: string[];
  summary: string;
  findings: Finding[];
}

export function decide(all: Finding[], round: number): Decision {
  const findings = [...all];
  const has = (s: Finding["severity"]) => findings.some((f) => f.severity === s);
  if (has("fixable") && !has("block") && !has("review") && round > POLICY.maxRounds) {
    findings.push({ code: "ROUNDS_EXCEEDED", severity: "block", stage: "decide", title: `Still incomplete after ${POLICY.maxRounds} rounds`, detail: `The vendor has resubmitted ${round - 1} times without resolving the open items.` });
  }
  const by = (s: Finding["severity"]) => findings.filter((f) => f.severity === s);
  const blocks = by("block");
  const reviews = by("review");
  const fixables = by("fixable");

  if (blocks.length) {
    return {
      recommendation: "reject",
      route: "awaiting_review",
      reasons: blocks.map((f) => f.title),
      summary: `Recommend reject: ${blocks.length} hard-stop condition${blocks.length > 1 ? "s" : ""}. A reviewer must confirm before the vendor is rejected.`,
      findings,
    };
  }
  if (reviews.length) {
    return {
      recommendation: "pending",
      route: "awaiting_review",
      reasons: [...reviews, ...fixables].map((f) => f.title),
      summary: `Pending: ${reviews.length} issue${reviews.length > 1 ? "s need" : " needs"} human judgment${fixables.length ? ` and ${fixables.length} item${fixables.length > 1 ? "s" : ""} the vendor must fix` : ""}. Routed to the review queue.`,
      findings,
    };
  }
  if (fixables.length) {
    return {
      recommendation: "pending",
      route: "awaiting_vendor",
      reasons: fixables.map((f) => f.title),
      summary: `Pending: ${fixables.length} item${fixables.length > 1 ? "s" : ""} the vendor can fix. A request listing exactly what is needed was sent to the vendor.`,
      findings,
    };
  }
  return {
    recommendation: "approve",
    route: "awaiting_review",
    reasons: ["All completeness, format, cross-check and risk rules passed"],
    summary: "Recommend approve: every check passed. Waiting for a reviewer to confirm.",
    findings,
  };
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
