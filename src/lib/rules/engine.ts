import type { Check, DuplicateHit, Evidence, Extraction, ExtractField, Finding, Slot, SubmissionData } from "@/lib/types";
import { constitution, DOCS, isCompany, requiredSlots, stateName } from "@/lib/india";
import {
  bankAccountKey,
  compact,
  gstinParts,
  PAN_HOLDER,
  parseDate,
  pincodeMatchesState,
  validateAccountNumber,
  validateCin,
  validateGstin,
  validateIfsc,
  validateLlpin,
  validatePan,
  validateUdyam,
} from "./validators";
import { compareNames, coreName } from "./names";
import { NOT_CONNECTED, type IfscLookup } from "./external";

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
  /** Fields/slots the vendor was asked to change in the last request. Changes to anything else are flagged. */
  requested: Set<string>;
  duplicates: DuplicateHit[];
  ifsc?: IfscLookup;
  round: number;
  now: Date;
}

const label = (slot: Slot) => DOCS[slot].label;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

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
  const required = requiredSlots(ctx.data.constitution);
  checks.push({ id: "form_complete", stage: "intake", source: "format", label: "Mandatory form fields", status: "pass", detail: "Company, address, contact, tax and bank fields are present." });
  for (const slot of required) {
    const doc = ctx.docs.find((d) => d.slot === slot);
    if (doc) {
      checks.push({ id: `doc_${slot}`, stage: "intake", source: "rules", label: label(slot), status: "pass", detail: `Received ${doc.file_name}` });
    } else {
      checks.push({ id: `doc_${slot}`, stage: "intake", source: "rules", label: label(slot), status: "fail", detail: "Not uploaded" });
      findings.push({
        code: "MISSING_DOCUMENT",
        severity: "fixable",
        stage: "intake",
        slot,
        title: `Missing ${label(slot).toLowerCase()}`,
        detail: `${constitution(ctx.data.constitution)?.label ?? "This vendor type"} must provide a ${label(slot).toLowerCase()} (${DOCS[slot].hint}).`,
        vendorAction: `Upload your ${label(slot)} (${DOCS[slot].hint}).`,
      });
    }
  }
  const optional = ctx.docs.filter((d) => !required.includes(d.slot));
  for (const d of optional) checks.push({ id: `doc_${d.slot}`, stage: "intake", source: "rules", label: `${label(d.slot)} (optional)`, status: "pass", detail: `Received ${d.file_name}` });
  return { checks, findings };
}

// ---------------------------------------------------------------- 2. read (AI output → findings)
const KEY_FIELDS: Record<Slot, ExtractField[][]> = {
  gst_certificate: [["legal_name"], ["gstin"]],
  pan_card: [["legal_name"], ["pan"]],
  bank_proof: [["account_holder"], ["account_number"]],
  incorporation_certificate: [["legal_name"]],
  msme_certificate: [["legal_name"]],
};

export function stageRead(ctx: EngineContext): StageOutcome {
  const checks: Check[] = [];
  const findings: Finding[] = [];
  for (const e of ctx.extractions) {
    const name = label(e.slot);
    if (e.error) {
      checks.push({ id: `read_${e.slot}`, stage: "read", source: "document", label: name, status: "fail", detail: `AI extraction failed: ${e.error}` });
      findings.push({ code: "EXTRACTION_FAILED", severity: "review", stage: "read", slot: e.slot, title: `Could not read ${name.toLowerCase()}`, detail: `Automatic extraction failed (${e.error}). A person must inspect this document; nothing was assumed.` });
      continue;
    }
    if (e.document_type !== e.slot && e.type_confidence >= POLICY.minTypeConfidence) {
      const actual = e.document_type === "other" ? "an unrelated document" : `a ${label(e.document_type as Slot).toLowerCase()}`;
      checks.push({ id: `type_${e.slot}`, stage: "read", source: "document", label: name, status: "fail", detail: `Looks like ${actual} (${pct(e.type_confidence)})` });
      findings.push({
        code: "WRONG_DOCUMENT",
        severity: "fixable",
        stage: "read",
        slot: e.slot,
        title: `Wrong document uploaded as ${name.toLowerCase()}`,
        detail: `${e.file_name} appears to be ${actual}, not a ${name.toLowerCase()}.`,
        evidence: [{ label: "Classified as", value: `${e.document_type} · ${pct(e.type_confidence)}` }],
        vendorAction: `The file uploaded as your ${name} (${e.file_name}) is ${actual}. Please upload the correct ${name}.`,
      });
      continue;
    }
    checks.push({ id: `type_${e.slot}`, stage: "read", source: "document", label: name, status: "pass", detail: `Recognised as ${name.toLowerCase()} (${pct(e.type_confidence)})` });

    const weak: string[] = [];
    for (const group of KEY_FIELDS[e.slot]) {
      const best = group.map((f) => e.fields[f]).filter((v) => v.value).sort((a, b) => b.confidence - a.confidence)[0];
      if (!best || best.confidence < POLICY.minFieldConfidence) weak.push(group.join(" / ").replace(/_/g, " "));
    }
    if (e.readability === "unreadable" || weak.length) {
      checks.push({ id: `conf_${e.slot}`, stage: "read", source: "document", label: `${name}: key fields`, status: "fail", detail: weak.length ? `Not confidently readable: ${weak.join(", ")}` : "Document unreadable" });
      findings.push({
        code: "UNCLEAR_DOCUMENT",
        severity: "fixable",
        stage: "read",
        slot: e.slot,
        title: `${name} is not clearly readable`,
        detail: `Could not confidently read ${weak.join(", ") || "the document"} (threshold ${pct(POLICY.minFieldConfidence)}). Values are never guessed.`,
        vendorAction: `Upload a clearer, complete copy of your ${name}. We could not read: ${weak.join(", ") || "the document"}.`,
      });
    } else {
      checks.push({ id: `conf_${e.slot}`, stage: "read", source: "document", label: `${name}: key fields`, status: "pass", detail: "Key fields read above the confidence threshold" });
    }
    if (e.embedded_instructions.detected) {
      checks.push({ id: `inj_${e.slot}`, stage: "read", source: "document", label: `${name}: content safety`, status: "fail", detail: "Instruction-like text found inside the document" });
      findings.push({ code: "SUSPICIOUS_CONTENT", severity: "review", stage: "read", slot: e.slot, title: "Document contains embedded instructions", detail: "Text inside the document tries to instruct the system. It was treated as data and ignored, but the document needs human review.", evidence: [{ label: "Text found", value: (e.embedded_instructions.text ?? "").slice(0, 200) }] });
    }
  }
  return { checks, findings };
}

// ---------------------------------------------------------------- 3. format validation
function fmt(out: StageOutcome, id: string, lbl: string, r: { valid: boolean; normalized: string; reason?: string }, submitted: string, finding: Omit<Finding, "stage" | "detail" | "evidence">) {
  out.checks.push({ id, stage: "validate", source: "format", label: lbl, status: r.valid ? "pass" : "fail", detail: r.valid ? `${r.normalized} is well-formed` : r.reason!, evidence: [{ label: "Submitted", value: submitted || "-" }] });
  if (!r.valid) out.findings.push({ ...finding, stage: "validate", detail: r.reason!, evidence: [{ label: "Submitted", value: submitted || "-" }] });
}

export function stageValidate(ctx: EngineContext): StageOutcome {
  const out: StageOutcome = { checks: [], findings: [] };
  const d = ctx.data;
  const cons = constitution(d.constitution);

  const g = validateGstin(d.gstin);
  fmt(out, "gstin_format", "GSTIN format and check character", g, d.gstin, { code: "GSTIN_INVALID", severity: "fixable", field: "gstin", title: "GSTIN is not valid", vendorAction: `Correct your GSTIN. ${g.reason ?? ""} It is the 15-character number on your GST registration certificate.` });
  const p = validatePan(d.pan);
  fmt(out, "pan_format", "PAN format", p, d.pan, { code: "PAN_INVALID", severity: "fixable", field: "pan", title: "PAN is not valid", vendorAction: `Correct your PAN. ${p.reason ?? ""}` });

  const parts = g.valid ? gstinParts(d.gstin) : null;
  if (parts) {
    const stateOk = parts.state === d.state;
    out.checks.push({ id: "gstin_state", stage: "validate", source: "format", label: "GSTIN state code vs registered state", status: stateOk ? "pass" : "fail", detail: stateOk ? `Code ${parts.state} is ${stateName(d.state)}` : `GSTIN is registered in ${stateName(parts.state)} (${parts.state}), address is in ${stateName(d.state)} (${d.state})` });
    if (!stateOk) {
      out.findings.push({ code: "GSTIN_STATE_MISMATCH", severity: "review", stage: "validate", field: "gstin", title: `GSTIN belongs to ${stateName(parts.state)}, not ${stateName(d.state)}`, detail: "The first two digits of a GSTIN are the state of registration. A vendor needs a GSTIN for the state it invoices from; a mismatch means the wrong GSTIN, the wrong address, or a different registration.", evidence: [{ label: "GSTIN state", value: `${parts.state} · ${stateName(parts.state)}` }, { label: "Declared state", value: `${d.state} · ${stateName(d.state)}` }] });
    }
    if (p.valid) {
      const panOk = parts.pan === p.normalized;
      out.checks.push({ id: "gstin_pan", stage: "validate", source: "format", label: "PAN inside GSTIN vs submitted PAN", status: panOk ? "pass" : "fail", detail: panOk ? "Characters 3–12 of the GSTIN equal the PAN" : `GSTIN contains PAN ${parts.pan}; submitted PAN is ${p.normalized}` });
      if (!panOk) {
        out.findings.push({ code: "GSTIN_PAN_MISMATCH", severity: "review", stage: "validate", field: "gstin", title: "GSTIN and PAN belong to different entities", detail: "Every GSTIN embeds the PAN of the business it was issued to. These two numbers cannot both belong to this vendor.", evidence: [{ label: "PAN inside GSTIN", value: parts.pan }, { label: "Submitted PAN", value: p.normalized }] });
      }
    }
  }
  if (p.valid && cons) {
    const typeOk = p.normalized[3] === cons.panType;
    out.checks.push({ id: "pan_type", stage: "validate", source: "format", label: "PAN holder type vs constitution", status: typeOk ? "pass" : "fail", detail: typeOk ? `'${p.normalized[3]}' is a ${PAN_HOLDER[p.normalized[3]]} PAN` : `'${p.normalized[3]}' is a ${PAN_HOLDER[p.normalized[3]] ?? "unknown"} PAN, expected ${cons.panTypeLabel} for a ${cons.label}` });
    if (!typeOk) out.findings.push({ code: "PAN_TYPE_MISMATCH", severity: "review", stage: "validate", field: "pan", title: "PAN type does not match the business type", detail: `A ${cons.label} should have a ${cons.panTypeLabel} PAN (4th character '${cons.panType}'). This PAN belongs to a ${PAN_HOLDER[p.normalized[3]] ?? "different holder type"}.`, evidence: [{ label: "PAN", value: p.normalized }, { label: "Constitution", value: cons.label }] });
    if (cons.panType !== "P") {
      const initial = coreName(d.legal_name)[0]?.toUpperCase();
      const nameOk = initial === p.normalized[4];
      out.checks.push({ id: "pan_initial", stage: "validate", source: "format", label: "PAN name initial vs legal name", status: nameOk ? "pass" : "fail", detail: nameOk ? `5th character '${p.normalized[4]}' matches the name` : `5th character is '${p.normalized[4]}', legal name starts with '${initial}'` });
      if (!nameOk) out.findings.push({ code: "PAN_NAME_MISMATCH", severity: "review", stage: "validate", field: "pan", title: "PAN does not appear to belong to this company name", detail: `For businesses, the 5th PAN character is the first letter of the registered name. '${p.normalized[4]}' does not match "${d.legal_name}".`, evidence: [{ label: "PAN", value: p.normalized }, { label: "Legal name", value: d.legal_name }] });
    }
  }

  if (isCompany(d.constitution) || d.cin) {
    const c = validateCin(d.cin ?? "");
    fmt(out, "cin_format", "CIN format", c, d.cin ?? "", { code: "CIN_INVALID", severity: "fixable", field: "cin", title: "CIN is not valid", vendorAction: `Correct your Corporate Identification Number (CIN). ${c.reason ?? ""}` });
  }
  if (d.constitution === "llp" || d.llpin) {
    const l = validateLlpin(d.llpin ?? "");
    fmt(out, "llpin_format", "LLPIN format", l, d.llpin ?? "", { code: "LLPIN_INVALID", severity: "fixable", field: "llpin", title: "LLPIN is not valid", vendorAction: `Correct your LLPIN. ${l.reason ?? ""}` });
  }
  if (d.udyam) {
    const u = validateUdyam(d.udyam);
    fmt(out, "udyam_format", "Udyam number format", u, d.udyam, { code: "UDYAM_INVALID", severity: "fixable", field: "udyam", title: "Udyam registration number is not valid", vendorAction: `Correct your Udyam number. ${u.reason ?? ""}` });
  }

  const pinOk = pincodeMatchesState(d.pincode, d.state);
  out.checks.push({ id: "pin_state", stage: "validate", source: "format", label: "PIN code zone vs state", status: pinOk ? "pass" : "fail", detail: pinOk ? `${d.pincode} is in ${stateName(d.state)}'s postal zone` : `${d.pincode} is outside ${stateName(d.state)}'s postal zone` });
  if (!pinOk) out.findings.push({ code: "PINCODE_STATE_MISMATCH", severity: "fixable", stage: "validate", field: "pincode", title: "PIN code does not match the state", detail: `PIN codes in ${stateName(d.state)} do not start with ${d.pincode[0]}.`, vendorAction: `Check your registered address: PIN code ${d.pincode} is not in ${stateName(d.state)}.` });

  const i = validateIfsc(d.bank.ifsc);
  fmt(out, "ifsc_format", "IFSC format", i, d.bank.ifsc, { code: "IFSC_INVALID", severity: "fixable", field: "bank", title: "IFSC is not valid", vendorAction: `Correct your bank's IFSC. ${i.reason ?? ""}` });
  const a = validateAccountNumber(d.bank.account_number);
  fmt(out, "acct_format", "Account number format", a, d.bank.account_number, { code: "ACCOUNT_INVALID", severity: "fixable", field: "bank", title: "Bank account number is not valid", vendorAction: `Correct your bank account number. ${a.reason ?? ""}` });

  const bankDoc = ex(ctx, "bank_proof");
  const issued = parseDate(reliable(bankDoc, "issue_date"));
  if (issued) {
    const age = Math.floor((ctx.now.getTime() - issued.getTime()) / 86_400_000);
    const fresh = age <= POLICY.bankProofMaxAgeDays;
    out.checks.push({ id: "bank_proof_age", stage: "validate", source: "document", label: "Bank letter recency", status: fresh ? "pass" : "fail", detail: `Dated ${iso(issued)} (${age} days ago, limit ${POLICY.bankProofMaxAgeDays})` });
    if (!fresh) out.findings.push({ code: "BANK_PROOF_STALE", severity: "fixable", stage: "validate", slot: "bank_proof", title: "Bank letter is older than 90 days", detail: `The bank letter is dated ${iso(issued)}, ${age} days ago.`, vendorAction: `Upload a cancelled cheque or a bank letter issued in the last ${POLICY.bankProofMaxAgeDays} days (the current one is dated ${iso(issued)}).` });
  }
  for (const e of ctx.extractions) {
    const exp = parseDate(reliable(e, "expiry_date"));
    if (exp && exp < ctx.now) {
      out.checks.push({ id: `expiry_${e.slot}`, stage: "validate", source: "document", label: `${label(e.slot)} validity`, status: "fail", detail: `Expired ${iso(exp)}` });
      out.findings.push({ code: "DOCUMENT_EXPIRED", severity: "fixable", stage: "validate", slot: e.slot, title: `${label(e.slot)} has expired`, detail: `Expired on ${iso(exp)}.`, vendorAction: `Upload a current ${label(e.slot)}; the one provided expired on ${iso(exp)}.` });
    }
  }
  return out;
}

// ---------------------------------------------------------------- 4. document cross-checks
function nameCheck(out: StageOutcome, id: string, lbl: string, code: string, submitted: string, found: string, source: string, slot?: Slot) {
  const m = compareNames(submitted, found);
  const evidence: Evidence[] = [
    { label: "Submitted legal name", value: submitted },
    { label: source, value: found },
    { label: "Match score", value: `${Math.round(m.score * 100)} / 100${m.suffixOnly ? " (legal suffix only)" : ""}` },
  ];
  if (m.score >= POLICY.nameMatchPass) {
    out.checks.push({ id, stage: "crosscheck", source: "document", label: lbl, status: "pass", detail: m.suffixOnly ? "Same entity; only the legal suffix is written differently" : "Names match", evidence });
    if (m.suffixOnly) out.findings.push({ code: "NAME_SUFFIX_VARIANT", severity: "info", stage: "crosscheck", slot, title: `${lbl}: legal suffix written differently`, detail: `"${submitted}" and "${found}" are the same name once legal forms are normalised.`, evidence });
    return;
  }
  const grey = m.score >= POLICY.nameMatchGrey;
  out.checks.push({ id, stage: "crosscheck", source: "document", label: lbl, status: "fail", detail: grey ? "Similar but not the same name" : "Names refer to different entities", evidence });
  out.findings.push({
    code,
    severity: "review",
    stage: "crosscheck",
    slot,
    title: `${lbl}: names do not match`,
    detail: grey
      ? `"${found}" is close to but not the same as "${submitted}" (score ${Math.round(m.score * 100)}). Could be a trade name or a related but different entity.`
      : `"${found}" does not match "${submitted}" (score ${Math.round(m.score * 100)}). ${code === "BANK_NAME_MISMATCH" ? "Payments could go to a different legal entity." : ""}`.trim(),
    evidence,
  });
}

function idCheck(out: StageOutcome, id: string, lbl: string, code: string, formVal: string, docVal: string, slot: Slot, field: string) {
  const same = compact(formVal) === compact(docVal);
  const evidence = [{ label: "Form", value: formVal }, { label: label(slot), value: docVal }];
  out.checks.push({ id, stage: "crosscheck", source: "document", label: lbl, status: same ? "pass" : "fail", detail: same ? "Matches the document" : "Differs from the document", evidence });
  if (!same) out.findings.push({ code, severity: "review", stage: "crosscheck", field, slot, title: `${lbl.split(" vs ")[0]} conflicts with the ${label(slot).toLowerCase()}`, detail: `The value on the form is not the one printed on the uploaded ${label(slot).toLowerCase()}.`, evidence });
}

export function stageCrosscheck(ctx: EngineContext): StageOutcome {
  const out: StageOutcome = { checks: [], findings: [] };
  const d = ctx.data;
  const gst = ex(ctx, "gst_certificate");
  const pan = ex(ctx, "pan_card");
  const bank = ex(ctx, "bank_proof");
  const inc = ex(ctx, "incorporation_certificate");

  for (const [e, slot] of [[gst, "gst_certificate"], [pan, "pan_card"], [inc, "incorporation_certificate"]] as const) {
    const n = reliable(e, "legal_name");
    if (n) nameCheck(out, `name_${slot}`, `Legal name vs ${label(slot).toLowerCase()}`, "NAME_MISMATCH", d.legal_name, n, label(slot), slot);
  }
  nameCheck(out, "bank_holder_form", "Legal name vs account holder (form)", "BANK_NAME_MISMATCH", d.legal_name, d.bank.account_holder, "Account holder on form");
  const holder = reliable(bank, "account_holder");
  if (holder) nameCheck(out, "bank_holder_doc", "Legal name vs account holder (cheque / bank letter)", "BANK_NAME_MISMATCH", d.legal_name, holder, label("bank_proof"), "bank_proof");

  const docGstin = reliable(gst, "gstin");
  if (docGstin) idCheck(out, "gstin_vs_cert", "GSTIN vs GST certificate", "GSTIN_DOCUMENT_CONFLICT", d.gstin, docGstin, "gst_certificate", "gstin");
  const docPan = reliable(pan, "pan");
  if (docPan) idCheck(out, "pan_vs_card", "PAN vs PAN card", "PAN_DOCUMENT_CONFLICT", d.pan, docPan, "pan_card", "pan");
  const docAcct = reliable(bank, "account_number");
  if (docAcct) idCheck(out, "acct_vs_doc", "Account number vs cheque / bank letter", "BANK_ACCOUNT_CONFLICT", d.bank.account_number, docAcct, "bank_proof", "bank");
  const docIfsc = reliable(bank, "ifsc");
  if (docIfsc) idCheck(out, "ifsc_vs_doc", "IFSC vs cheque / bank letter", "IFSC_DOCUMENT_CONFLICT", d.bank.ifsc, docIfsc, "bank_proof", "bank");
  const docCin = reliable(inc, "cin");
  if (docCin && d.cin) idCheck(out, "cin_vs_cert", "CIN vs incorporation certificate", "CIN_DOCUMENT_CONFLICT", d.cin, docCin, "incorporation_certificate", "cin");

  // Resubmission: anything already submitted that changed without being requested.
  if (ctx.previousData) {
    const prev = ctx.previousData;
    const pairs: [string, string, string][] = [
      ["legal_name", prev.legal_name, d.legal_name],
      ["gstin", compact(prev.gstin), compact(d.gstin)],
      ["pan", compact(prev.pan), compact(d.pan)],
      ["bank.account", bankAccountKey(prev.bank) ?? "", bankAccountKey(d.bank) ?? ""],
      ["bank.account_holder", prev.bank.account_holder, d.bank.account_holder],
    ];
    for (const [field, before, after] of pairs) {
      const requested = ctx.requested.has(field) || (field.startsWith("bank") && ctx.requested.has("bank")) || (field.startsWith("bank") && ctx.requested.has("bank_proof"));
      if (before !== after && !requested) {
        out.findings.push({ code: "VERIFIED_FIELD_CHANGED", severity: "review", stage: "crosscheck", field, title: `${field.replace("bank.", "bank ").replace("_", " ")} changed without being requested`, detail: "This value was submitted in an earlier round and was not part of the correction request. Unrequested changes to identity or bank details need review.", evidence: [{ label: "Before", value: before }, { label: "Now", value: after }] });
        out.checks.push({ id: `changed_${field}`, stage: "crosscheck", source: "internal", label: `Unrequested change: ${field}`, status: "fail", detail: `${before} → ${after}` });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- 5. external records
export function stageExternal(ctx: EngineContext): StageOutcome {
  const out: StageOutcome = { checks: [], findings: [] };
  const d = ctx.data;
  const r = ctx.ifsc;
  if (!r) {
    out.checks.push({ id: "ifsc_directory", stage: "external", source: "external", label: "IFSC in RBI branch directory", status: "skip", detail: "Skipped: IFSC format is invalid." });
  } else if (r.status === "found") {
    const rec = r.record;
    out.checks.push({ id: "ifsc_directory", stage: "external", source: "external", label: "IFSC in RBI branch directory", status: "pass", detail: `${rec.bank}, ${rec.branch}, ${rec.city} (${rec.state})`, evidence: [{ label: "Source", value: "Razorpay IFSC directory (RBI data)" }] });
    if (d.bank.bank_name?.trim()) {
      const m = compareNames(d.bank.bank_name, rec.bank);
      const bankOk = m.score >= 0.6 || rec.bank.toLowerCase().includes(d.bank.bank_name.toLowerCase().split(" ")[0]);
      out.checks.push({ id: "ifsc_bank_name", stage: "external", source: "external", label: "Bank name vs IFSC record", status: bankOk ? "pass" : "warn", detail: bankOk ? `${rec.bank}` : `Form says "${d.bank.bank_name}", IFSC belongs to ${rec.bank}` });
      if (!bankOk) out.findings.push({ code: "IFSC_BANK_MISMATCH", severity: "fixable", stage: "external", field: "bank", title: "IFSC belongs to a different bank", detail: `IFSC ${compact(d.bank.ifsc)} is a ${rec.bank} branch, but the form says "${d.bank.bank_name}".`, evidence: [{ label: "IFSC record", value: `${rec.bank} · ${rec.branch}` }, { label: "Form", value: d.bank.bank_name }], vendorAction: `Check your bank details: IFSC ${compact(d.bank.ifsc)} belongs to ${rec.bank} (${rec.branch}), not ${d.bank.bank_name}.` });
    }
  } else if (r.status === "not_found") {
    out.checks.push({ id: "ifsc_directory", stage: "external", source: "external", label: "IFSC in RBI branch directory", status: "fail", detail: `${compact(d.bank.ifsc)} does not exist in the branch directory` });
    out.findings.push({ code: "IFSC_NOT_FOUND", severity: "fixable", stage: "external", field: "bank", title: "IFSC does not exist", detail: `IFSC ${compact(d.bank.ifsc)} is well-formed but is not a real bank branch.`, vendorAction: `Your IFSC ${compact(d.bank.ifsc)} does not match any bank branch. Please copy it exactly from your cheque or bank letter.` });
  } else {
    out.checks.push({ id: "ifsc_directory", stage: "external", source: "external", label: "IFSC in RBI branch directory", status: "skip", detail: `Directory unavailable (${r.error}). Not counted as a pass.` });
  }
  for (const n of NOT_CONNECTED) out.checks.push({ id: n.id, stage: "external", source: "external", label: n.label, status: "skip", detail: n.detail });
  return out;
}

// ---------------------------------------------------------------- 6. risk
export function stageRisk(ctx: EngineContext): StageOutcome {
  const checks: Check[] = [];
  const findings: Finding[] = [];
  const d = ctx.data;
  const what = { gstin: "GSTIN", pan: "PAN", bank_account: "bank account" } as const;
  if (!ctx.duplicates.length) checks.push({ id: "dupes", stage: "risk", source: "internal", label: "Duplicate GSTIN / PAN / bank account", status: "pass", detail: "No other vendor in this system uses these identifiers" });
  for (const dup of ctx.duplicates) {
    const m = compareNames(d.legal_name, dup.legal_name);
    const w = what[dup.matched_on];
    const evidence = [{ label: "Other vendor", value: `${dup.ref} · ${dup.legal_name} · ${dup.status.replace(/_/g, " ")}` }, { label: "Shared", value: w }];
    if (dup.status === "approved" && m.score < POLICY.nameMatchPass) {
      checks.push({ id: `dupe_${dup.ref}_${dup.matched_on}`, stage: "risk", source: "internal", label: `Shared ${w}`, status: "fail", detail: `Registered to approved vendor ${dup.ref} (${dup.legal_name})` });
      findings.push({ code: "IDENTITY_CONFLICT", severity: "block", stage: "risk", title: `${w[0].toUpperCase() + w.slice(1)} belongs to another approved vendor`, detail: `This ${w} is already registered to ${dup.legal_name} (${dup.ref}), a different approved vendor. Re-using another vendor's identifiers is a known payment-fraud pattern.`, evidence });
    } else if (m.score >= POLICY.nameMatchPass) {
      checks.push({ id: `dupe_${dup.ref}_${dup.matched_on}`, stage: "risk", source: "internal", label: `Possible duplicate of ${dup.ref}`, status: "warn", detail: `Same ${w} and name as ${dup.ref}` });
      findings.push({ code: "DUPLICATE_VENDOR", severity: "review", stage: "risk", title: `Possible duplicate of ${dup.ref}`, detail: `${dup.ref} has the same ${w} and name and is ${dup.status.replace(/_/g, " ")}. Approving would create a second record for the same vendor.`, evidence });
    } else {
      checks.push({ id: `dupe_${dup.ref}_${dup.matched_on}`, stage: "risk", source: "internal", label: `Shared ${w}`, status: "fail", detail: `Also used by ${dup.ref} (${dup.legal_name})` });
      findings.push({ code: "SHARED_IDENTIFIER", severity: "review", stage: "risk", title: `${w[0].toUpperCase() + w.slice(1)} shared with ${dup.legal_name}`, detail: `Another vendor (${dup.ref}) under a different name uses the same ${w}.`, evidence });
    }
  }
  return { checks, findings };
}

// ---------------------------------------------------------------- 7. decide
export interface Decision {
  recommendation: "approve" | "pending" | "reject";
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
    return { recommendation: "reject", route: "awaiting_review", reasons: blocks.map((f) => f.title), summary: `Recommend reject: ${blocks.length} hard-stop condition${blocks.length > 1 ? "s" : ""}. A reviewer must confirm before the vendor is rejected.`, findings };
  }
  if (reviews.length) {
    return { recommendation: "pending", route: "awaiting_review", reasons: [...reviews, ...fixables].map((f) => f.title), summary: `Needs review: ${reviews.length} issue${reviews.length > 1 ? "s need" : " needs"} human judgment${fixables.length ? ` and ${fixables.length} item${fixables.length > 1 ? "s" : ""} the vendor must fix` : ""}.`, findings };
  }
  if (fixables.length) {
    return { recommendation: "pending", route: "awaiting_vendor", reasons: fixables.map((f) => f.title), summary: `Needs correction: ${fixables.length} item${fixables.length > 1 ? "s" : ""} the vendor can fix.`, findings };
  }
  return { recommendation: "approve", route: "awaiting_review", reasons: ["Every completeness, format, document and duplicate check passed"], summary: "Ready for approval: every automated check passed. Registry checks are not connected, so a reviewer must confirm.", findings };
}
