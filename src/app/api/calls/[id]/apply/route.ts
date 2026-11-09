import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isUuid, json } from "@/lib/api";
import { createTasks } from "@/lib/calls";
import { logEvent } from "@/lib/events";
import { normalizePhone } from "@/lib/rules/validators";
import { STATES } from "@/lib/india";
import type { CallAnalysis } from "@/lib/types";

const body = z.object({
  vendor_id: z.string().uuid().nullable(),
  fields: z.record(z.string(), z.string()),
});

const VENDOR_COLS = ["company_name", "contact_name", "contact_email", "contact_phone", "city", "supplies"] as const;
const PREFILL_COLS = ["gstin", "pan", "state", "designation"] as const;

/**
 * Applies the details the salesperson ticked from a call analysis: to an existing vendor, or a
 * new one. Tax details go into the vendor's form pre-fill (the vendor still confirms them), never
 * straight into verified data. Action items become tasks.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/calls/[id]/apply">) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const b = body.parse(await request.json());
    const db = admin();
    const { data: call } = await db.from("calls").select("id, analysis, vendor_id, logged_by, title, applied_at").eq("id", id).single();
    if (!call?.analysis) return fail("This call has no analysis yet", 409);
    const analysis = call.analysis as CallAnalysis;

    const f = Object.fromEntries(Object.entries(b.fields).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    if (f.contact_phone && normalizePhone(f.contact_phone).valid) f.contact_phone = normalizePhone(f.contact_phone).normalized;
    if (f.state) f.state = STATES.find((s) => s.name.toLowerCase() === f.state.toLowerCase() || s.code === f.state)?.code ?? "";
    if (f.gstin) f.gstin = f.gstin.toUpperCase().replace(/\s/g, "");
    if (f.pan) f.pan = f.pan.toUpperCase().replace(/\s/g, "");
    const vendorPatch = Object.fromEntries(VENDOR_COLS.filter((k) => f[k]).map((k) => [k, f[k]]));
    const prefill = Object.fromEntries(PREFILL_COLS.filter((k) => f[k]).map((k) => [k, f[k]]));

    let vendorId = b.vendor_id;
    if (vendorId) {
      const { data: v } = await db.from("vendors").select("prefill").eq("id", vendorId).single();
      if (!v) return fail("Vendor not found", 404);
      await db.from("vendors").update({ ...vendorPatch, prefill: { ...(v.prefill ?? {}), ...prefill }, updated_at: new Date().toISOString() }).eq("id", vendorId);
      // If the vendor hasn't submitted yet, carry the new details into their saved form too.
      const { data: sub } = await db.from("submissions").select("id, draft_data, submitted_at").eq("vendor_id", vendorId).maybeSingle();
      if (sub && !sub.submitted_at) {
        const add = { ...prefill, ...(vendorPatch.company_name ? { legal_name: vendorPatch.company_name } : {}), ...Object.fromEntries(["contact_name", "contact_email", "contact_phone", "city", "supplies"].filter((k) => vendorPatch[k]).map((k) => [k, vendorPatch[k]])) };
        await db.from("submissions").update({ draft_data: { ...add, ...(sub.draft_data ?? {}) } }).eq("id", sub.id);
      }
    } else {
      if (!vendorPatch.company_name) return fail("A company name is needed to create the vendor", 422);
      const { data: v, error } = await db.from("vendors").insert({ ...vendorPatch, prefill, source: "Call", owner_id: staff.id, created_by: staff.id }).select("id").single();
      if (error || !v) throw new Error(error?.message);
      vendorId = v.id;
      await logEvent({ vendorId, actor: "staff", actorEmail: staff.email, action: "vendor_created", note: `${vendorPatch.company_name} · from call "${call.title}"` });
    }
    const firstLink = call.vendor_id !== vendorId;
    await db.from("calls").update({ vendor_id: vendorId, applied_at: new Date().toISOString() }).eq("id", id);
    if (firstLink || !call.applied_at) {
      const { count } = await db.from("tasks").select("id", { count: "exact", head: true }).eq("call_id", id);
      if (!count) await createTasks(id, vendorId!, analysis, call.logged_by);
    }
    await logEvent({ vendorId, actor: "staff", actorEmail: staff.email, action: "call_applied", note: `Applied ${Object.keys(f).join(", ") || "no fields"} from "${call.title}"`, data: { fields: f } });
    return json({ vendor_id: vendorId });
  } catch (err) {
    return fromError(err);
  }
}
