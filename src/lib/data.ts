import "server-only";
import { admin } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/env";
import { safeFileName } from "@/lib/api";
import type { RunResult, SubmissionData, SubmissionStatus } from "@/lib/types";

export async function createUploads(
  submissionId: string,
  version: number,
  files: { slot: string; name: string; type: string; size: number }[],
) {
  const db = admin();
  const uploads: { documentId: string; slot: string; path: string; token: string }[] = [];
  for (const f of files) {
    const path = `${submissionId}/v${version}/${f.slot}/${crypto.randomUUID()}-${safeFileName(f.name)}`;
    const { data: doc, error } = await db
      .from("documents")
      .insert({ submission_id: submissionId, version, slot: f.slot, file_name: f.name, mime_type: f.type, size_bytes: f.size, storage_path: path })
      .select("id")
      .single();
    if (error || !doc) throw new Error(`Could not register document: ${error?.message}`);
    const signed = await db.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
    if (signed.error) throw new Error(`Could not create upload URL: ${signed.error.message}`);
    uploads.push({ documentId: doc.id, slot: f.slot, path, token: signed.data.token });
  }
  return uploads;
}

export interface SubmissionRow {
  id: string;
  ref: string;
  status: SubmissionStatus;
  recommendation: "approve" | "pending" | "reject" | null;
  legal_name: string;
  country: string;
  current_version: number;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
}

export interface RunRow {
  id: string;
  submission_id: string;
  version: number;
  trigger: string;
  status: "queued" | "running" | "completed" | "failed";
  recommendation: "approve" | "pending" | "reject" | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  submissions?: { ref: string; legal_name: string } | null;
  run_stages?: { key: string; status: string; position: number }[];
}

export async function getDashboard() {
  const db = admin();
  const [{ data: subs }, { data: runs }] = await Promise.all([
    db.from("submissions").select("id, ref, status, recommendation, legal_name, country, current_version, created_at, updated_at, decided_at").neq("status", "draft").order("updated_at", { ascending: false }),
    db
      .from("runs")
      .select("id, submission_id, version, trigger, status, recommendation, error, created_at, started_at, finished_at, submissions(ref, legal_name), run_stages(key, status, position)")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const all = (subs ?? []) as SubmissionRow[];
  const count = (...s: SubmissionStatus[]) => all.filter((x) => s.includes(x.status)).length;
  const decided = all.filter((s) => s.decided_at);
  return {
    counts: {
      total: all.length,
      approved: count("approved"),
      rejected: count("rejected"),
      pending: count("awaiting_review", "awaiting_vendor"),
      awaiting_review: count("awaiting_review"),
      awaiting_vendor: count("awaiting_vendor"),
      processing: count("processing"),
      error: count("error"),
    },
    medianHoursToDecision: median(decided.map((s) => (Date.parse(s.decided_at!) - Date.parse(s.created_at)) / 3_600_000)),
    queue: all.filter((s) => s.status === "awaiting_review" || s.status === "error"),
    waiting: all.filter((s) => s.status === "awaiting_vendor"),
    runs: (runs ?? []) as unknown as RunRow[],
  };
}

export async function listCases(status?: string) {
  const db = admin();
  let q = db
    .from("submissions")
    .select("id, ref, status, recommendation, legal_name, country, current_version, created_at, updated_at, decided_at")
    .neq("status", "draft")
    .order("updated_at", { ascending: false });
  if (status === "pending") q = q.in("status", ["awaiting_review", "awaiting_vendor"]);
  else if (status && status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return (data ?? []) as SubmissionRow[];
}

export async function getCase(id: string) {
  const db = admin();
  const { data: sub } = await db.from("submissions").select("*").eq("id", id).single();
  if (!sub) return null;
  const [{ data: versions }, { data: docs }, { data: runs }, { data: events }, { data: requests }] = await Promise.all([
    db.from("submission_versions").select("version, data, created_at").eq("submission_id", id).order("version", { ascending: false }),
    db.from("documents").select("id, slot, file_name, mime_type, size_bytes, version, uploaded, superseded, created_at").eq("submission_id", id).eq("uploaded", true).order("created_at", { ascending: false }),
    db.from("runs").select("id, version, trigger, status, recommendation, result, error, created_at, started_at, finished_at").eq("submission_id", id).order("created_at", { ascending: false }),
    db.from("events").select("id, actor_type, actor_email, action, note, data, created_at, run_id").eq("submission_id", id).order("created_at", { ascending: false }),
    db.from("info_requests").select("id, items, message, status, created_by, created_at, resolved_at").eq("submission_id", id).order("created_at", { ascending: false }),
  ]);
  const latestCompleted = (runs ?? []).find((r) => r.status === "completed");
  return {
    submission: sub as SubmissionRow & { access_token: string; contact_email: string; tax_id: string },
    data: versions?.[0]?.data as SubmissionData,
    versions: (versions ?? []) as { version: number; data: SubmissionData; created_at: string }[],
    documents: (docs ?? []) as { id: string; slot: string; file_name: string; mime_type: string; size_bytes: number; version: number; superseded: boolean; created_at: string }[],
    runs: (runs ?? []) as (RunRow & { result: RunResult | null })[],
    result: (latestCompleted?.result ?? null) as RunResult | null,
    latestRun: runs?.[0] ?? null,
    events: (events ?? []) as { id: string; actor_type: string; actor_email: string | null; action: string; note: string | null; data: Record<string, unknown> | null; created_at: string; run_id: string | null }[],
    requests: (requests ?? []) as { id: string; items: { code: string; title: string; action: string }[]; message: string; status: string; created_by: string; created_at: string }[],
  };
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
