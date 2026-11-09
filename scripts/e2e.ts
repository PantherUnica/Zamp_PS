// End-to-end check against a running app (npm run dev / npm start) with your real Supabase,
// OpenAI and Gmail. For each demo vendor it creates the vendor + magic link directly in the
// database (the staff step), then drives the PUBLIC vendor-portal APIs exactly like the browser:
// save draft → upload PDFs to signed URLs → confirm → submit → wait for the agent → check the
// persisted outcome and the emails. Edge 1 then resubmits with the missing cheque.
// Usage: npm run test:e2e        (BASE_URL defaults to http://localhost:3000)
//        E2E_EMAIL=you@x.com npm run test:e2e   (where vendor emails should go; default GMAIL_USER)
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { SAMPLE_CASES, type SampleCase } from "../src/lib/samples";

config({ path: [".env.local", ".env"], quiet: true });
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const INBOX = process.env.E2E_EMAIL || process.env.GMAIL_USER || "vendor@example.com";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const EXPECT: Record<string, { rec: string; status: string; codes: string[]; email: "auto" | "draft" | "none" }> = {
  happy: { rec: "approve", status: "awaiting_review", codes: [], email: "none" },
  incomplete: { rec: "pending", status: "awaiting_vendor", codes: ["MISSING_DOCUMENT"], email: "auto" },
  "bank-mismatch": { rec: "pending", status: "awaiting_review", codes: ["BANK_NAME_MISMATCH"], email: "none" },
  "tax-invalid": { rec: "pending", status: "awaiting_review", codes: ["GSTIN_STATE_MISMATCH", "GSTIN_PAN_MISMATCH", "GSTIN_DOCUMENT_CONFLICT"], email: "none" },
};

const file = (url: string) => readFileSync(join(process.cwd(), "public", url));

async function api(path: string, init: { method: string; body?: unknown }) {
  const res = await fetch(BASE + path, { method: init.method, headers: { "Content-Type": "application/json" }, body: init.body ? JSON.stringify(init.body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function setupVendor(s: SampleCase) {
  const { data: owner } = await db.from("profiles").select("id").order("created_at").limit(1).single();
  const { data: v, error } = await db.from("vendors").insert({ ...s.vendor, contact_email: INBOX, source: "E2E", owner_id: owner?.id ?? null, created_by: owner?.id ?? null }).select("id, ref").single();
  if (error || !v) throw new Error(`vendor insert: ${error?.message}`);
  const token = randomBytes(24).toString("hex");
  const { data: sub, error: e2 } = await db
    .from("submissions")
    .insert({ vendor_id: v.id, legal_name: s.vendor.company_name, contact_email: INBOX, status: "draft", current_version: 1, access_token: token, link_expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(), draft_data: { legal_name: s.vendor.company_name } })
    .select("id, ref")
    .single();
  if (e2 || !sub) throw new Error(`submission insert: ${e2?.message}`);
  return { vendorId: v.id, ref: sub.ref as string, subId: sub.id as string, token };
}

async function uploadAll(token: string, files: SampleCase["files"]) {
  for (const f of files) {
    const bytes = file(f.url);
    const up = await api(`/api/v/${token}/documents`, { method: "POST", body: { slot: f.slot, name: f.name, type: "application/pdf", size: bytes.length } });
    const { error } = await anon.storage.from("vendor-documents").uploadToSignedUrl(up.path, up.token, bytes, { contentType: "application/pdf" });
    if (error) throw new Error(`upload ${f.name}: ${error.message}`);
    await api(`/api/v/${token}/documents/${up.documentId}`, { method: "POST" });
  }
}

async function waitRun(runId: string) {
  const t0 = Date.now();
  for (;;) {
    const { data } = await db.from("runs").select("status, recommendation, result, error").eq("id", runId).single();
    if (data && (data.status === "completed" || data.status === "failed")) return { ...data, ms: Date.now() - t0 };
    if (Date.now() - t0 > 240_000) throw new Error(`run ${runId} timed out`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function emailsFor(subId: string) {
  await new Promise((r) => setTimeout(r, 2500)); // confirmation emails are sent alongside the run
  const { data } = await db.from("emails").select("kind, status, audience, generated_by, error").eq("submission_id", subId);
  return data ?? [];
}

/** Makes the test re-runnable: removes vendors (and their files) created by earlier E2E runs. */
async function cleanup() {
  const { data: old } = await db.from("vendors").select("id").eq("source", "E2E");
  const ids = (old ?? []).map((v) => v.id);
  if (!ids.length) return;
  const { data: subs } = await db.from("submissions").select("id").in("vendor_id", ids);
  for (const s of subs ?? []) {
    const { data: docs } = await db.from("documents").select("storage_path").eq("submission_id", s.id);
    const paths = (docs ?? []).map((d) => d.storage_path);
    if (paths.length) await db.storage.from("vendor-documents").remove(paths);
  }
  await db.from("vendors").delete().in("id", ids); // submissions, runs, documents, emails, events cascade
  console.log(`Cleaned up ${ids.length} vendor(s) from earlier E2E runs.\n`);
}

async function main() {
  console.log(`E2E against ${BASE} · vendor emails → ${INBOX}\n`);
  await cleanup();
  let failures = 0;
  for (const s of SAMPLE_CASES) {
    console.log(s.label);
    const ctx = await setupVendor(s);
    const data = { ...s.data, contact_email: INBOX };
    await api(`/api/v/${ctx.token}/draft`, { method: "PUT", body: { data: { legal_name: data.legal_name } } });
    await uploadAll(ctx.token, s.files);
    const { runId } = await api(`/api/v/${ctx.token}/submit`, { method: "POST", body: { data } });
    const run = await waitRun(runId);
    const { data: sub } = await db.from("submissions").select("status").eq("id", ctx.subId).single();
    const exp = EXPECT[s.id];
    const codes: string[] = (run.result?.findings ?? []).filter((f: { severity: string }) => f.severity !== "info").map((f: { code: string }) => f.code);
    const mails = await emailsFor(ctx.subId);
    const problems: string[] = [];
    if (run.status !== "completed") problems.push(`run ${run.status}: ${run.error}`);
    if (run.recommendation !== exp.rec) problems.push(`recommendation ${run.recommendation} ≠ ${exp.rec}`);
    if (sub?.status !== exp.status) problems.push(`status ${sub?.status} ≠ ${exp.status}`);
    for (const c of exp.codes) if (!codes.includes(c)) problems.push(`missing finding ${c}`);
    if (!mails.some((m) => m.kind === "submission_received")) problems.push("no submission confirmation email recorded");
    if (exp.email === "auto" && !mails.some((m) => m.kind === "correction_request" && m.status !== "draft")) problems.push("missing-document request was not auto-sent");
    console.log(`  ${ctx.ref} · run ${runId.slice(0, 8)} · ${(run.ms / 1000).toFixed(1)}s → ${run.recommendation} / ${sub?.status} · findings [${codes.join(", ") || "none"}]`);
    for (const e of (run.result?.extractions ?? []) as { file_name: string; document_type: string; type_confidence: number; error?: string }[]) console.log(`    AI read ${e.file_name}: ${e.error ? "ERROR " + e.error : `${e.document_type} ${Math.round(e.type_confidence * 100)}%`}`);
    console.log(`    emails: ${mails.map((m) => `${m.kind}=${m.status}${m.generated_by === "agent" ? "(agent)" : ""}${m.error ? ` [${m.error.slice(0, 60)}]` : ""}`).join(", ")}`);
    console.log(problems.length ? `  ✗ ${problems.join("; ")}\n` : "  ✓ as expected\n");
    if (problems.length) failures++;

    if (s.id === "incomplete" && s.resubmission && !problems.length) {
      console.log("  Resubmitting on the same link with the cheque…");
      await uploadAll(ctx.token, s.resubmission);
      const r2 = await api(`/api/v/${ctx.token}/submit`, { method: "POST", body: { data } });
      const run2 = await waitRun(r2.runId);
      const { data: sub2 } = await db.from("submissions").select("status, current_version").eq("id", ctx.subId).single();
      const ok = run2.recommendation === "approve" && sub2?.status === "awaiting_review" && sub2.current_version === 2;
      console.log(`  → v${sub2?.current_version} ${run2.recommendation} / ${sub2?.status} ${ok ? "✓ resumed and cleared" : "✗ " + JSON.stringify(run2.result?.findings?.map((f: { code: string }) => f.code))}\n`);
      if (!ok) failures++;
    }
  }
  console.log(failures ? `${failures} problem(s)` : "All end-to-end cases behaved as expected");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
