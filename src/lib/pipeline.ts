import "server-only";
import { admin } from "@/lib/supabase/admin";
import { serverEnv, STORAGE_BUCKET } from "@/lib/env";
import { extractDocument, extractionModel } from "@/lib/ai/extract";
import { draftCorrectionEmail } from "@/lib/ai/correction";
import { createAndSend, createEmail } from "@/lib/email/outbox";
import { compose } from "@/lib/email/templates";
import { logEvent } from "@/lib/events";
import {
  decide,
  stageCrosscheck,
  stageExternal,
  stageIntake,
  stageRead,
  stageRisk,
  stageValidate,
  type EngineContext,
  type StageOutcome,
} from "@/lib/rules/engine";
import { lookupIfsc } from "@/lib/rules/external";
import { bankAccountKey, compact, validateIfsc } from "@/lib/rules/validators";
import { fieldsForFinding, itemFromFinding } from "@/lib/messages";
import { STAGES, type DuplicateHit, type Extraction, type Finding, type RunResult, type Slot, type StageKey, type StageStatus, type SubmissionData } from "@/lib/types";

type Db = ReturnType<typeof admin>;

/** Creates a queued run with every stage "pending", so the live view can render it immediately. */
export async function createRun(submissionId: string, version: number, trigger: "submission" | "resubmission" | "reprocess") {
  const db = admin();
  const { data: run, error } = await db
    .from("runs")
    .insert({ submission_id: submissionId, version, trigger, status: "queued", model: extractionModel() })
    .select("id")
    .single();
  if (error || !run) throw new Error(`Could not create run: ${error?.message}`);
  const { error: stErr } = await db.from("run_stages").insert(STAGES.map((s, i) => ({ run_id: run.id, key: s.key, label: s.label, position: i, status: "pending" })));
  if (stErr) throw new Error(`Could not create run stages: ${stErr.message}`);
  await db.from("submissions").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", submissionId);
  return run.id as string;
}

async function setStage(db: Db, runId: string, key: StageKey, patch: Record<string, unknown>) {
  const { error } = await db.from("run_stages").update(patch).eq("run_id", runId).eq("key", key);
  if (error) throw new Error(`Stage ${key} update failed: ${error.message}`);
}

function stageStatus(o: StageOutcome): StageStatus {
  if (o.findings.some((f) => f.severity === "block")) return "failed";
  if (o.findings.some((f) => f.severity === "review" || f.severity === "fixable")) return "warning";
  if (o.checks.some((c) => c.status === "fail")) return "warning";
  return "passed";
}

function stageSummary(o: StageOutcome): string {
  const counted = o.checks.filter((c) => c.status !== "skip");
  const pass = counted.filter((c) => c.status === "pass").length;
  const skipped = o.checks.length - counted.length;
  const issues = o.findings.filter((f) => f.severity !== "info").length;
  return `${pass}/${counted.length} passed${skipped ? ` · ${skipped} not connected` : ""}${issues ? ` · ${issues} issue${issues > 1 ? "s" : ""}` : ""}`;
}

async function runStage(db: Db, runId: string, key: StageKey, fn: () => Promise<StageOutcome & { extra?: Record<string, unknown> }> | (StageOutcome & { extra?: Record<string, unknown> })) {
  await setStage(db, runId, key, { status: "running", started_at: new Date().toISOString() });
  try {
    const out = await fn();
    await setStage(db, runId, key, {
      status: stageStatus(out),
      summary: stageSummary(out),
      output: { checks: out.checks, findings: out.findings, ...(out.extra ?? {}) },
      finished_at: new Date().toISOString(),
    });
    return out;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStage(db, runId, key, { status: "error", error: message, finished_at: new Date().toISOString() });
    throw err;
  }
}

/** The current document for each slot: latest upload at or below this version. */
export async function currentDocuments(db: Db, submissionId: string, version: number) {
  const { data } = await db
    .from("documents")
    .select("id, slot, file_name, mime_type, storage_path, version, size_bytes, created_at")
    .eq("submission_id", submissionId)
    .eq("uploaded", true)
    .eq("superseded", false)
    .lte("version", version)
    .order("version", { ascending: false })
    .order("created_at", { ascending: false });
  const seen = new Set<string>();
  return (data ?? []).filter((d) => (seen.has(d.slot) ? false : (seen.add(d.slot), true))) as {
    id: string;
    slot: Slot;
    file_name: string;
    mime_type: string;
    storage_path: string;
    version: number;
    size_bytes: number;
    created_at: string;
  }[];
}

async function vendorContext(db: Db, vendorId: string | null) {
  if (!vendorId) return { vendor: null, owner: null };
  const { data } = await db.from("vendors").select("id, ref, company_name, contact_name, contact_email, owner_id, owner:profiles!vendors_owner_id_fkey(id, email, full_name)").eq("id", vendorId).single();
  const owner = (data?.owner as unknown as { id: string; email: string; full_name: string | null } | null) ?? null;
  return { vendor: data, owner };
}

/** Executes every stage for a run. Safe inside after(); all state is persisted as it goes. */
export async function executeRun(runId: string): Promise<void> {
  const db = admin();
  const { data: run } = await db.from("runs").select("*").eq("id", runId).single();
  if (!run) throw new Error(`Run ${runId} not found`);
  const { data: sub } = await db.from("submissions").select("*").eq("id", run.submission_id).single();
  if (!sub) throw new Error(`Submission for run ${runId} not found`);
  await db.from("runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", runId);
  await logEvent({ vendorId: sub.vendor_id, submissionId: sub.id, runId, actor: "agent", action: "verification_started", note: `Version ${run.version}` });

  try {
    const { data: versions } = await db
      .from("submission_versions")
      .select("version, data")
      .eq("submission_id", sub.id)
      .lte("version", run.version)
      .order("version", { ascending: false })
      .limit(2);
    const data = versions?.[0]?.data as SubmissionData;
    const previousData = versions?.[1]?.data as SubmissionData | undefined;
    if (!data) throw new Error("Submission data missing");
    const docs = await currentDocuments(db, sub.id, run.version);

    const { data: lastReq } = await db.from("info_requests").select("items").eq("submission_id", sub.id).neq("status", "draft").order("created_at", { ascending: false }).limit(1);
    const requested = new Set<string>();
    for (const it of (lastReq?.[0]?.items ?? []) as { code: string; field?: string; slot?: Slot }[]) fieldsForFinding(it).forEach((f) => requested.add(f));

    const ctx: EngineContext = { data, docs, extractions: [], previousData, requested, duplicates: [], round: run.version, now: new Date() };
    const findings: Finding[] = [];
    const checks: StageOutcome["checks"] = [];
    const collect = (o: StageOutcome) => {
      findings.push(...o.findings);
      checks.push(...o.checks);
      return o;
    };

    await runStage(db, runId, "intake", () => collect(stageIntake(ctx)));

    await runStage(db, runId, "read", async () => {
      const extractions: Extraction[] = [];
      await Promise.all(
        docs.map(async (d) => {
          const file = await db.storage.from(STORAGE_BUCKET).download(d.storage_path);
          if (file.error || !file.data) throw new Error(`Could not load ${d.file_name} from storage: ${file.error?.message}`);
          extractions.push(await extractDocument({ documentId: d.id, slot: d.slot, fileName: d.file_name, mimeType: d.mime_type, bytes: await file.data.arrayBuffer() }));
          await setStage(db, runId, "read", { output: { extractions, checks: [], findings: [] }, summary: `${extractions.length}/${docs.length} documents read` });
        }),
      );
      ctx.extractions = extractions;
      return { ...collect(stageRead(ctx)), extra: { extractions } };
    });

    await runStage(db, runId, "validate", () => collect(stageValidate(ctx)));
    await runStage(db, runId, "crosscheck", () => collect(stageCrosscheck(ctx)));
    await runStage(db, runId, "external", async () => {
      const ifsc = validateIfsc(data.bank.ifsc);
      ctx.ifsc = ifsc.valid ? await lookupIfsc(ifsc.normalized) : undefined;
      return { ...collect(stageExternal(ctx)), extra: { ifsc: ctx.ifsc ?? null } };
    });
    await runStage(db, runId, "risk", async () => {
      ctx.duplicates = await findDuplicates(db, sub.id, data);
      return { ...collect(stageRisk(ctx)), extra: { duplicates: ctx.duplicates } };
    });

    const decision = decide(findings, run.version);
    const counts = Object.fromEntries((["block", "review", "fixable", "info"] as const).map((k) => [k, decision.findings.filter((f) => f.severity === k).length]));
    await runStage(db, runId, "decide", () => ({
      checks: [{ id: "decision", stage: "decide", source: "rules", label: "Rule-based recommendation", status: decision.recommendation === "approve" ? "pass" : decision.recommendation === "reject" ? "fail" : "warn", detail: decision.summary }],
      findings: decision.findings.filter((f) => f.stage === "decide"),
      extra: { recommendation: decision.recommendation, reasons: decision.reasons, counts },
    }));

    const result: RunResult = { extractions: ctx.extractions, checks, findings: decision.findings, recommendation: decision.recommendation, route: decision.route, reasons: decision.reasons, summary: decision.summary };
    const { vendor, owner } = await vendorContext(db, sub.vendor_id);
    const vendorUrl = `${serverEnv.appUrl()}/v/${sub.access_token}`;
    const staffUrl = sub.vendor_id ? `${serverEnv.appUrl()}/vendors/${sub.vendor_id}` : `${serverEnv.appUrl()}/runs/${runId}`;

    await runStage(db, runId, "communicate", async () => {
      const now = new Date().toISOString();
      await db.from("info_requests").update({ status: "resolved", resolved_at: now }).eq("submission_id", sub.id).in("status", ["open", "draft"]);
      await db.from("emails").update({ status: "discarded" }).eq("submission_id", sub.id).eq("kind", "correction_request").eq("status", "draft");
      const outChecks: StageOutcome["checks"] = [];
      let emailInfo: Record<string, unknown> | null = null;

      if (decision.route === "awaiting_vendor") {
        const fixable = decision.findings.filter((f) => f.severity === "fixable");
        const items = fixable.map(itemFromFinding);
        const onlyMissing = fixable.every((f) => f.code === "MISSING_DOCUMENT");
        const { data: req, error } = await db
          .from("info_requests")
          .insert({ submission_id: sub.id, run_id: runId, items, message: items.map((i, n) => `${n + 1}. ${i.action}`).join("\n"), status: onlyMissing ? "open" : "draft", created_by: "agent" })
          .select("id")
          .single();
        if (error || !req) throw new Error(`Could not create request: ${error?.message}`);
        const { content, byAgent } = await draftCorrectionEmail({ contactName: data.contact_name, company: data.legal_name, ref: sub.ref, url: vendorUrl, items, ownerName: owner?.full_name });
        const base = { kind: "correction_request" as const, audience: "vendor" as const, to: data.contact_email, content, vendorId: sub.vendor_id, submissionId: sub.id, infoRequestId: req.id, generatedBy: byAgent ? ("agent" as const) : ("system" as const) };
        if (onlyMissing) {
          const sent = await createAndSend(base);
          emailInfo = { email_id: sent.id, status: sent.status, error: sent.error, subject: sent.subject, auto: true };
          outChecks.push({ id: "route", stage: "communicate", source: "rules", label: "Missing-document request emailed to vendor", status: sent.status === "sent" ? "pass" : "fail", detail: sent.status === "sent" ? `Sent to ${data.contact_email}. Objective request (missing documents only), so it went out automatically.` : `Email failed: ${sent.error}. Retry from the Emails page.` });
        } else {
          const draft = await createEmail(base);
          emailInfo = { email_id: draft.id, status: "draft", subject: draft.subject, auto: false };
          outChecks.push({ id: "route", stage: "communicate", source: "rules", label: `Correction email drafted${byAgent ? " by the agent" : ""} for the salesperson`, status: "warn", detail: "Contains judgment calls, so it waits for a salesperson to review and send. Nothing has been sent to the vendor yet." });
          if (owner?.email) await createAndSend({ kind: "staff_action_needed", audience: "staff", to: owner.email, content: compose.staffActionNeeded({ staffName: owner.full_name || "there", company: data.legal_name, ref: sub.ref, headline: "a correction email is ready for you to send", reasons: decision.reasons, url: staffUrl }), vendorId: sub.vendor_id, submissionId: sub.id });
        }
        emailInfo = { ...emailInfo, body: content.body, generated_by: byAgent ? "agent" : "system" };
      } else {
        outChecks.push({ id: "route", stage: "communicate", source: "rules", label: "Routed to the human review queue", status: "pass", detail: "A reviewer must approve, reject or request more information. The agent cannot finalise a decision." });
        if (owner?.email) {
          const headline = decision.recommendation === "approve" ? "ready for approval" : decision.recommendation === "reject" ? "recommended for rejection" : "needs review";
          const sent = await createAndSend({ kind: "staff_action_needed", audience: "staff", to: owner.email, content: compose.staffActionNeeded({ staffName: owner.full_name || "there", company: data.legal_name, ref: sub.ref, headline, reasons: decision.reasons, url: staffUrl }), vendorId: sub.vendor_id, submissionId: sub.id });
          outChecks.push({ id: "notify_owner", stage: "communicate", source: "rules", label: "Salesperson notified", status: sent.status === "sent" ? "pass" : "fail", detail: sent.status === "sent" ? `Emailed ${owner.email}` : `Email failed: ${sent.error}` });
        }
      }
      return { checks: outChecks, findings: [], extra: { route: decision.route, email: emailInfo } };
    });

    const finished = new Date().toISOString();
    await db.from("runs").update({ status: "completed", recommendation: decision.recommendation, result, finished_at: finished }).eq("id", runId);
    await db.from("submissions").update({ status: decision.route, recommendation: decision.recommendation, updated_at: finished }).eq("id", sub.id);
    if (vendor) await db.from("vendors").update({ updated_at: finished }).eq("id", vendor.id);
    await logEvent({ vendorId: sub.vendor_id, submissionId: sub.id, runId, actor: "agent", action: "recommended", note: decision.summary, data: { recommendation: decision.recommendation, reasons: decision.reasons, counts } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finished = new Date().toISOString();
    await db.from("runs").update({ status: "failed", error: message, finished_at: finished }).eq("id", runId);
    await db.from("run_stages").update({ status: "skipped" }).eq("run_id", runId).eq("status", "pending");
    await db.from("submissions").update({ status: "error", updated_at: finished }).eq("id", sub.id);
    await logEvent({ vendorId: sub.vendor_id, submissionId: sub.id, runId, actor: "agent", action: "processing_failed", note: message });
  }
}

async function findDuplicates(db: Db, submissionId: string, data: SubmissionData): Promise<DuplicateHit[]> {
  const probes: [DuplicateHit["matched_on"], string, string | null][] = [
    ["gstin", "tax_id", compact(data.gstin)],
    ["pan", "pan", compact(data.pan)],
    ["bank_account", "bank_account", bankAccountKey(data.bank)],
  ];
  const hits: DuplicateHit[] = [];
  for (const [matched_on, col, value] of probes) {
    if (!value) continue;
    const { data: rows } = await db.from("submissions").select("ref, legal_name, status").eq(col, value).neq("id", submissionId).not("status", "in", "(rejected,draft)");
    rows?.forEach((r) => hits.push({ ...r, matched_on }));
  }
  return hits;
}
