import "server-only";
import { admin } from "@/lib/supabase/admin";
import { analyzeTranscript } from "@/lib/ai/transcript";
import { logEvent } from "@/lib/events";
import type { CallAnalysis } from "@/lib/types";

export async function runAnalysis(callId: string) {
  const db = admin();
  const { data: call } = await db.from("calls").select("id, transcript, vendor_id, logged_by, vendors(company_name)").eq("id", callId).single();
  if (!call) return;
  try {
    const known = (call.vendors as unknown as { company_name: string } | null)?.company_name ?? null;
    const { analysis, model } = await analyzeTranscript(call.transcript, { today: new Date().toISOString().slice(0, 10), knownVendor: known });
    await db.from("calls").update({ status: "done", analysis, model, error: null }).eq("id", callId);
    if (call.vendor_id) await createTasks(callId, call.vendor_id, analysis, call.logged_by);
    await logEvent({ vendorId: call.vendor_id, actor: "agent", action: "call_analysed", note: `${analysis.intelligence.score}/10 · ${analysis.intelligence.signal} · ${analysis.action_items.length} action item(s)` });
  } catch (err) {
    await db.from("calls").update({ status: "failed", error: (err instanceof Error ? err.message : String(err)).slice(0, 400) }).eq("id", callId);
  }
}

export async function createTasks(callId: string, vendorId: string, analysis: CallAnalysis, createdBy: string | null) {
  const rows = analysis.action_items.map((a) => ({ call_id: callId, vendor_id: vendorId, title: a.task, owner: a.owner, due_date: /^\d{4}-\d{2}-\d{2}$/.test(a.due ?? "") ? a.due : null, created_by: createdBy }));
  if (analysis.follow_up.date && /^\d{4}-\d{2}-\d{2}$/.test(analysis.follow_up.date)) rows.push({ call_id: callId, vendor_id: vendorId, title: `Follow up${analysis.follow_up.timeline ? ` (${analysis.follow_up.timeline})` : ""}: ${analysis.intelligence.next_step}`, owner: "us", due_date: analysis.follow_up.date, created_by: createdBy });
  if (rows.length) await admin().from("tasks").insert(rows);
}
