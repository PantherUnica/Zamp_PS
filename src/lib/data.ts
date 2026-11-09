import "server-only";
import { admin } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/env";
import { safeFileName } from "@/lib/api";
import { vendorStage, type StageInfo, type SubmissionSnapshot } from "@/lib/vendor-stage";
import type { CallAnalysis, Role, RunResult, SubmissionData } from "@/lib/types";
import type { EmailRow } from "@/lib/email/outbox";

type Db = ReturnType<typeof admin>;
const one = <T>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

export async function createUpload(submissionId: string, version: number, f: { slot: string; name: string; type: string; size: number }) {
  const db = admin();
  const path = `${submissionId}/v${version}/${f.slot}/${crypto.randomUUID()}-${safeFileName(f.name)}`;
  const { data: doc, error } = await db
    .from("documents")
    .insert({ submission_id: submissionId, version, slot: f.slot, file_name: f.name, mime_type: f.type, size_bytes: f.size, storage_path: path })
    .select("id")
    .single();
  if (error || !doc) throw new Error(`Could not register document: ${error?.message}`);
  const signed = await db.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
  if (signed.error) throw new Error(`Could not create upload URL: ${signed.error.message}`);
  return { documentId: doc.id as string, slot: f.slot, path, token: signed.data.token };
}

// ---------------------------------------------------------------- vendors
const SUB_COLS = "id, ref, status, recommendation, current_version, link_sent_at, link_expires_at, draft_saved_at, submitted_at, updated_at, access_token, legal_name";

export interface VendorListRow {
  id: string;
  ref: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  city: string | null;
  supplies: string | null;
  owner_id: string | null;
  owner: { full_name: string | null; email: string } | null;
  updated_at: string;
  created_at: string;
  submission: (SubmissionSnapshot & { id: string; ref: string; current_version: number; updated_at: string; access_token: string }) | null;
  stage: StageInfo;
  latestScore: number | null;
}

export async function listVendors(db: Db = admin()): Promise<VendorListRow[]> {
  const [{ data: vendors }, { data: openReqs }, { data: drafts }, { data: calls }] = await Promise.all([
    db.from("vendors").select(`id, ref, company_name, contact_name, contact_email, city, supplies, owner_id, created_at, updated_at, owner:profiles!vendors_owner_id_fkey(full_name, email), submission:submissions(${SUB_COLS})`).order("updated_at", { ascending: false }),
    db.from("info_requests").select("submission_id").eq("status", "open"),
    db.from("emails").select("vendor_id").eq("status", "draft").eq("kind", "correction_request"),
    db.from("calls").select("vendor_id, analysis, occurred_at").eq("status", "done").not("vendor_id", "is", null).order("occurred_at", { ascending: false }),
  ]);
  const open = new Set((openReqs ?? []).map((r) => r.submission_id));
  const draftSet = new Set((drafts ?? []).map((r) => r.vendor_id));
  const scores = new Map<string, number>();
  for (const c of calls ?? []) if (c.vendor_id && !scores.has(c.vendor_id)) scores.set(c.vendor_id, (c.analysis as CallAnalysis | null)?.intelligence?.score ?? 0);
  return (vendors ?? []).map((v) => {
    const s = one(v.submission as unknown) as VendorListRow["submission"];
    return {
      ...(v as unknown as VendorListRow),
      owner: one(v.owner as unknown) as VendorListRow["owner"],
      submission: s,
      stage: vendorStage(s, { openRequest: s ? open.has(s.id) : false, draftEmail: draftSet.has(v.id) }),
      latestScore: scores.get(v.id) || null,
    };
  });
}

export async function getVendor(id: string) {
  const db = admin();
  const { data: v } = await db.from("vendors").select("*, owner:profiles!vendors_owner_id_fkey(id, full_name, email)").eq("id", id).maybeSingle();
  if (!v) return null;
  const { data: sub } = await db.from("submissions").select("*").eq("vendor_id", id).maybeSingle();
  const subId = sub?.id ?? "00000000-0000-0000-0000-000000000000";
  const [{ data: versions }, { data: docs }, { data: runs }, { data: events }, { data: requests }, { data: emails }, { data: calls }, { data: tasks }] = await Promise.all([
    db.from("submission_versions").select("version, data, created_at").eq("submission_id", subId).order("version", { ascending: false }),
    db.from("documents").select("id, slot, file_name, mime_type, size_bytes, version, superseded, created_at").eq("submission_id", subId).eq("uploaded", true).order("created_at", { ascending: false }),
    db.from("runs").select("id, version, trigger, status, recommendation, result, error, created_at, started_at, finished_at").eq("submission_id", subId).order("created_at", { ascending: false }),
    db.from("events").select("id, actor_type, actor_email, action, note, data, created_at, run_id").or(`vendor_id.eq.${id},submission_id.eq.${subId}`).order("created_at", { ascending: false }).limit(200),
    db.from("info_requests").select("id, items, message, status, created_by, created_at, resolved_at").eq("submission_id", subId).order("created_at", { ascending: false }),
    db.from("emails").select("*").eq("vendor_id", id).neq("status", "discarded").order("created_at", { ascending: false }),
    db.from("calls").select("id, title, channel, occurred_at, status, analysis, error, duration_minutes, source_file").eq("vendor_id", id).order("occurred_at", { ascending: false }),
    db.from("tasks").select("*").eq("vendor_id", id).order("done").order("due_date", { nullsFirst: false }),
  ]);
  const openRequest = (requests ?? []).find((r) => r.status === "open") ?? null;
  const draftEmail = (emails ?? []).find((e) => e.status === "draft" && e.kind === "correction_request") ?? null;
  const latestCompleted = (runs ?? []).find((r) => r.status === "completed");
  return {
    vendor: { ...v, owner: one(v.owner as unknown) as { id: string; full_name: string | null; email: string } | null },
    submission: sub as (Record<string, unknown> & SubmissionSnapshot & { id: string; ref: string; access_token: string; current_version: number; created_at: string; decided_at: string | null; draft_data: Partial<SubmissionData> | null }) | null,
    data: (versions?.[0]?.data ?? null) as SubmissionData | null,
    versions: (versions ?? []) as { version: number; data: SubmissionData; created_at: string }[],
    documents: (docs ?? []) as { id: string; slot: string; file_name: string; mime_type: string; size_bytes: number; version: number; superseded: boolean; created_at: string }[],
    runs: (runs ?? []) as { id: string; version: number; trigger: string; status: string; recommendation: string | null; result: RunResult | null; error: string | null; created_at: string; started_at: string | null; finished_at: string | null }[],
    result: (latestCompleted?.result ?? null) as RunResult | null,
    latestRun: runs?.[0] ?? null,
    events: (events ?? []) as { id: string; actor_type: string; actor_email: string | null; action: string; note: string | null; data: Record<string, unknown> | null; created_at: string; run_id: string | null }[],
    requests: (requests ?? []) as { id: string; items: { code: string; title: string; action: string }[]; message: string; status: string; created_by: string; created_at: string }[],
    emails: (emails ?? []) as EmailRow[],
    calls: (calls ?? []) as { id: string; title: string; channel: string; occurred_at: string; status: string; analysis: CallAnalysis | null; error: string | null; duration_minutes: number | null; source_file: string | null }[],
    tasks: (tasks ?? []) as TaskRow[],
    stage: vendorStage(sub as SubmissionSnapshot | null, { openRequest: !!openRequest, draftEmail: !!draftEmail }),
    openRequest,
    draftEmail: draftEmail as EmailRow | null,
  };
}

export interface TaskRow {
  id: string;
  vendor_id: string | null;
  call_id: string | null;
  title: string;
  owner: "us" | "vendor";
  due_date: string | null;
  done: boolean;
  created_at: string;
  vendors?: { ref: string; company_name: string } | null;
}

// ---------------------------------------------------------------- dashboard
export async function getDashboard(me: { id: string; role: Role }) {
  const db = admin();
  const [vendors, { data: runs }, { data: tasks }, { data: emails }, { count: failedEmails }, { data: calls }] = await Promise.all([
    listVendors(db),
    db.from("runs").select("id, status, recommendation, created_at, started_at, finished_at, trigger, version, submissions!inner(ref, legal_name, vendor_id), run_stages(key, status, position)").not("submissions.vendor_id", "is", null).order("created_at", { ascending: false }).limit(8),
    db.from("tasks").select("*, vendors(ref, company_name, owner_id)").eq("done", false).order("due_date", { nullsFirst: false }).limit(50),
    db.from("emails").select("id, kind, audience, to_email, subject, status, error, created_at, sent_at, vendor_id, generated_by").neq("status", "discarded").order("created_at", { ascending: false }).limit(8),
    db.from("emails").select("id", { count: "exact", head: true }).eq("status", "failed"),
    db.from("calls").select("id, title, occurred_at, status, analysis, vendor_id, vendors(company_name)").order("occurred_at", { ascending: false }).limit(5),
  ]);
  const mine = me.role === "sales" ? vendors.filter((v) => v.owner_id === me.id) : vendors;
  const by = (keys: string[]) => vendors.filter((v) => keys.includes(v.stage.key));
  const approved = vendors.filter((v) => v.stage.key === "approved" && v.submission?.submitted_at);
  const hours = approved.map((v) => (Date.parse(v.submission!.updated_at) - Date.parse(v.created_at)) / 3_600_000).sort((a, b) => a - b);
  const median = hours.length ? hours[Math.floor(hours.length / 2)] : null;

  const salesKeys = ["correction_draft", "link_ready", "link_expired", "error"];
  const reviewKeys = ["ready", "in_review", "high_risk"];
  const attention = (me.role === "sales" ? mine.filter((v) => salesKeys.includes(v.stage.key)) : [...by(reviewKeys), ...mine.filter((v) => salesKeys.includes(v.stage.key))]).slice(0, 8);
  const myTasks = ((tasks ?? []) as (TaskRow & { vendors: { owner_id: string | null } | null })[]).filter((t) => me.role !== "sales" || !t.vendors || t.vendors.owner_id === me.id);

  return {
    vendors,
    mine,
    counts: {
      total: vendors.length,
      notSubmitted: by(["lead", "link_ready", "invited", "filling", "link_expired"]).length,
      waitingVendor: by(["needs_correction", "correction_draft"]).length,
      inReview: by(["ready", "in_review", "high_risk", "verifying"]).length,
      approved: by(["approved"]).length,
      rejected: by(["rejected"]).length,
    },
    funnel: [0, 1, 2, 3, 4, 5].map((step) => vendors.filter((v) => v.stage.step === step).length),
    medianHours: median,
    attention,
    tasks: myTasks.slice(0, 8),
    runs: (runs ?? []) as unknown as { id: string; status: string; recommendation: string | null; created_at: string; started_at: string | null; finished_at: string | null; trigger: string; version: number; submissions: { ref: string; legal_name: string; vendor_id: string }; run_stages: { key: string; status: string; position: number }[] }[],
    emails: (emails ?? []) as Pick<EmailRow, "id" | "kind" | "audience" | "to_email" | "subject" | "status" | "error" | "created_at" | "sent_at" | "vendor_id" | "generated_by">[],
    failedEmails: failedEmails ?? 0,
    calls: (calls ?? []) as unknown as { id: string; title: string; occurred_at: string; status: string; analysis: CallAnalysis | null; vendor_id: string | null; vendors: { company_name: string } | null }[],
  };
}

// ---------------------------------------------------------------- emails, calls, team
export async function listEmails(filter: string) {
  let q = admin().from("emails").select("*, vendors(ref, company_name)").order("created_at", { ascending: false }).limit(200);
  if (filter === "draft" || filter === "failed" || filter === "sent") q = q.eq("status", filter);
  else q = q.neq("status", "discarded");
  const { data } = await q;
  return (data ?? []) as (EmailRow & { vendors: { ref: string; company_name: string } | null })[];
}

export async function listCalls() {
  const { data } = await admin().from("calls").select("id, title, channel, occurred_at, status, analysis, error, vendor_id, duration_minutes, vendors(ref, company_name), logger:profiles!calls_logged_by_fkey(full_name, email)").order("occurred_at", { ascending: false }).limit(200);
  return (data ?? []) as unknown as { id: string; title: string; channel: string; occurred_at: string; status: string; analysis: CallAnalysis | null; error: string | null; vendor_id: string | null; duration_minutes: number | null; vendors: { ref: string; company_name: string } | null; logger: { full_name: string | null; email: string } | null }[];
}

export async function getCall(id: string) {
  const { data } = await admin().from("calls").select("*, vendors(id, ref, company_name)").eq("id", id).maybeSingle();
  return data as (Record<string, unknown> & { id: string; title: string; channel: string; occurred_at: string; status: string; analysis: CallAnalysis | null; error: string | null; transcript: string; vendor_id: string | null; notes: string | null; source_file: string | null; applied_at: string | null; duration_minutes: number | null; vendors: { id: string; ref: string; company_name: string } | null }) | null;
}

export async function listStaff() {
  const { data } = await admin().from("profiles").select("id, email, full_name, role, created_at").order("created_at");
  return (data ?? []) as { id: string; email: string; full_name: string | null; role: Role; created_at: string }[];
}
