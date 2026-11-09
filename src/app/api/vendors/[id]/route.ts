import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getStaff, isAdmin } from "@/lib/auth";
import { vendorSchema } from "@/lib/schema";
import { fail, fromError, isUuid, json } from "@/lib/api";
import { logEvent } from "@/lib/events";

const patchSchema = vendorSchema.partial().extend({ owner_id: z.string().uuid().optional() });

/** Edit vendor (lead) details. Every changed field is written to the audit trail with before/after. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/vendors/[id]">) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const b = patchSchema.parse(await request.json());
    if (b.owner_id && !isAdmin(staff) && staff.role !== "reviewer") return fail("Only reviewers and admins can reassign vendors", 403);
    const db = admin();
    const { data: before } = await db.from("vendors").select("*").eq("id", id).single();
    if (!before) return fail("Not found", 404);
    const patch: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(b)) {
      if (v === undefined) continue;
      const next = v === "" ? null : v;
      if ((before as Record<string, unknown>)[k] !== next) {
        patch[k] = next;
        changes[k] = { from: (before as Record<string, unknown>)[k], to: next };
      }
    }
    if (!Object.keys(patch).length) return json({ ok: true, changed: 0 });
    patch.updated_at = new Date().toISOString();
    const { error } = await db.from("vendors").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    // Keep the onboarding form's contact in step with the vendor record until the vendor submits.
    if (patch.contact_email || patch.company_name) {
      await db
        .from("submissions")
        .update({ ...(patch.contact_email ? { contact_email: patch.contact_email } : {}), ...(patch.company_name ? { legal_name: patch.company_name } : {}) })
        .eq("vendor_id", id)
        .is("submitted_at", null);
    }
    await logEvent({ vendorId: id, actor: "staff", actorEmail: staff.email, action: "vendor_updated", note: Object.keys(changes).join(", "), data: { changes } });
    return json({ ok: true, changed: Object.keys(changes).length });
  } catch (err) {
    return fromError(err);
  }
}
