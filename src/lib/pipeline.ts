import "server-only";
import { admin } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/env";
import { extractDocument, extractionModel } from "@/lib/ai/extract";
import {
  decide,
  stageCrosscheck,
  stageIntake,
  stageRead,
  stageRisk,
  stageValidate,
  type EngineContext,
  type StageOutcome,
} from "@/lib/rules/engine";
import { bankAccountKey, compact } from "@/lib/rules/validators";
import { composeRequestMessage, fieldsForFinding, itemFromFinding } from "@/lib/messages";
import {
  STAGES,
  type DuplicateHit,
  type Extraction,
  type Finding,
  type RunResult,
  type Slot,
  type StageKey,
  type StageStatus,
  type SubmissionData,
} from "@/lib/types";

type Db = ReturnType<typeof admin>;

/** Creates a queued run with all stages in "pending" so the live view can render them immediately. */
export async function createRun(submissionId: string, version: number, trigger: "submission" | "resubmission" | "reprocess") {
  const db = admin();
  const { data: run, error } = await db
    .from("runs")
    .insert({ submission_id: submissionId, version, trigger, status: "queued", model: extractionModel() })
    .select("id")
    .single();
  if (error || !run) throw new Error(`Could not create run: ${error?.message}`);
  const { error: stErr } = await db.from("run_stages").insert(
    STAGES.map((s, i) => ({ run_id: run.id, key: s.key, label: s.label, position: i, status: "pending" })),
  );
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
  const pass = o.checks.filter((c) => c.status === "pass").length;
  const issues = o.findings.filter((f) => f.severity !== "info").length;
  return `${pass}/${o.checks.length} checks passed${issues ? ` · ${issues} issue${issues > 1 ? "s" : ""}` : ""}`;
}

async function runStage(
  db: Db,
  runId: string,
  key: StageKey,
  fn: () => Promise<StageOutcome & { extra?: Record<string, unknown> }> | (StageOutcome & { extra?: Record<string, unknown> }),
) {
  const started = Date.now();
  await setStage(db, runId, key, { status: "running", started_at: new Date(started).toISOString() });
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

/** Executes every stage for a run. Safe to call from `after()`; all state is persisted as it goes. */
export async function executeRun(runId: string): Promise<void> {
  const db = admin();
  const { data: run } = await db.from("runs").select("*").eq("id", runId).single();
  if (!run) throw new Error(`Run ${runId} not found`);
  const { data: sub } = await db.from("submissions").select("*").eq("id", run.submission_id).single();
  if (!sub) throw new Error(`Submission for run ${runId} not found`);

  await db.from("runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", runId);

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

    const { data: docRows } = await db
      .from("documents")
      .select("id, slot, file_name, mime_type, storage_path, version")
      .eq("submission_id", sub.id)
      .eq("uploaded", true)
      .eq("superseded", false)
      .lte("version", run.version);
    const docs = (docRows ?? []) as { id: string; slot: Slot; file_name: string; mime_type: string; storage_path: string }[];

    // Fields/slots the vendor was asked to change (open request from the previous round).
    const { data: openReq } = await db
      .from("info_requests")
      .select("items")
      .eq("submission_id", sub.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const requested = new Set<string>();
    for (const it of (openReq?.[0]?.items ?? []) as { code: string; field?: string; slot?: Slot }[]) {
      fieldsForFinding({ code: it.code, field: it.field, slot: it.slot }).forEach((f) => requested.add(f));
    }

    const ctx: EngineContext = {
      data,
      docs,
      extractions: [],
      previousData,
      requested,
      duplicates: [],
      round: run.version,
      now: new Date(),
    };
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
          const e = await extractDocument({
            documentId: d.id,
            slot: d.slot,
            fileName: d.file_name,
            mimeType: d.mime_type,
            bytes: await file.data.arrayBuffer(),
            country: data.country,
          });
          extractions.push(e);
          // Progressive update so the live view shows each document as soon as it is read.
          await setStage(db, runId, "read", { output: { extractions, checks: [], findings: [] }, summary: `${extractions.length}/${docs.length} documents read` });
        }),
      );
      ctx.extractions = extractions;
      return { ...collect(stageRead(ctx)), extra: { extractions } };
    });

    await runStage(db, runId, "validate", () => collect(stageValidate(ctx)));
    await runStage(db, runId, "crosscheck", () => collect(stageCrosscheck(ctx)));

    await runStage(db, runId, "risk", async () => {
      ctx.duplicates = await findDuplicates(db, sub.id, data);
      return { ...collect(stageRisk(ctx)), extra: { duplicates: ctx.duplicates } };
    });

    const decision = decide(findings, run.version);
    await runStage(db, runId, "decide", () => ({
      checks: [
        {
          id: "decision",
          stage: "decide",
          label: "Rule-based recommendation",
          status: decision.recommendation === "approve" ? "pass" : decision.recommendation === "reject" ? "fail" : "warn",
          detail: decision.summary,
        },
      ],
      findings: decision.findings.filter((f) => f.stage === "decide"),
      extra: {
        recommendation: decision.recommendation,
        reasons: decision.reasons,
        counts: {
          block: decision.findings.filter((f) => f.severity === "block").length,
          review: decision.findings.filter((f) => f.severity === "review").length,
          fixable: decision.findings.filter((f) => f.severity === "fixable").length,
          info: decision.findings.filter((f) => f.severity === "info").length,
        },
      },
    }));

    const result: RunResult = {
      extractions: ctx.extractions,
      checks,
      findings: decision.findings,
      recommendation: decision.recommendation,
      route: decision.route,
      reasons: decision.reasons,
      summary: decision.summary,
    };

    await runStage(db, runId, "communicate", async () => {
      const now = new Date().toISOString();
      await db.from("info_requests").update({ status: "resolved", resolved_at: now }).eq("submission_id", sub.id).eq("status", "open");
      let request: { id: string; message: string } | null = null;
      if (decision.route === "awaiting_vendor") {
        const items = decision.findings.filter((f) => f.severity === "fixable").map(itemFromFinding);
        const message = composeRequestMessage(data, sub.ref, items);
        const { data: req, error } = await db
          .from("info_requests")
          .insert({ submission_id: sub.id, run_id: runId, items, message, created_by: "system" })
          .select("id, message")
          .single();
        if (error) throw new Error(`Could not create request: ${error.message}`);
        request = req;
      }
      return {
        checks: [
          {
            id: "route",
            stage: "communicate",
            label: decision.route === "awaiting_vendor" ? "Information request sent to vendor" : "Routed to human review queue",
            status: "pass",
            detail:
              decision.route === "awaiting_vendor"
                ? "Vendor can reopen the same submission, fix the listed items and resubmit."
                : "A reviewer must approve, reject or request more information. The system cannot finalise the decision.",
          },
        ],
        findings: [],
        extra: { route: decision.route, request },
      };
    });

    const finished = new Date().toISOString();
    await db
      .from("runs")
      .update({ status: "completed", recommendation: decision.recommendation, result, finished_at: finished })
      .eq("id", runId);
    await db
      .from("submissions")
      .update({ status: decision.route, recommendation: decision.recommendation, updated_at: finished })
      .eq("id", sub.id);
    await db.from("events").insert([
      {
        submission_id: sub.id,
        run_id: runId,
        actor_type: "system",
        action: "recommended",
        note: decision.summary,
        data: { recommendation: decision.recommendation, reasons: decision.reasons },
      },
      ...(decision.route === "awaiting_vendor"
        ? [{ submission_id: sub.id, run_id: runId, actor_type: "system", action: "info_requested", note: `Requested: ${decision.reasons.join("; ")}` }]
        : []),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finished = new Date().toISOString();
    await db.from("runs").update({ status: "failed", error: message, finished_at: finished }).eq("id", runId);
    await db.from("run_stages").update({ status: "skipped" }).eq("run_id", runId).eq("status", "pending");
    await db.from("submissions").update({ status: "error", updated_at: finished }).eq("id", sub.id);
    await db.from("events").insert({ submission_id: sub.id, run_id: runId, actor_type: "system", action: "processing_failed", note: message });
  }
}

async function findDuplicates(db: Db, submissionId: string, data: SubmissionData): Promise<DuplicateHit[]> {
  const tax = compact(data.tax_id);
  const acct = bankAccountKey(data.bank);
  const hits: DuplicateHit[] = [];
  const { data: byTax } = await db
    .from("submissions")
    .select("ref, legal_name, status")
    .eq("tax_id", tax)
    .neq("id", submissionId)
    .neq("status", "rejected");
  byTax?.forEach((r) => hits.push({ ...r, matched_on: "tax_id" }));
  if (acct) {
    const { data: byAcct } = await db
      .from("submissions")
      .select("ref, legal_name, status")
      .eq("bank_account", acct)
      .neq("id", submissionId)
      .neq("status", "rejected");
    byAcct?.forEach((r) => hits.push({ ...r, matched_on: "bank_account" }));
  }
  return hits;
}
