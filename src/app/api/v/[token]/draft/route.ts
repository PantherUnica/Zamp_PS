import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isToken, json } from "@/lib/api";
import { canEdit, loadByToken } from "@/lib/portal";
import { logEvent } from "@/lib/events";

// Drafts are deliberately permissive: half-filled values are fine until submit.
const draftSchema = z.object({ data: z.record(z.string(), z.unknown()) }).refine((b) => JSON.stringify(b.data).length < 20_000, "Draft is too large");

/** Saves progress so the vendor can close the page and resume later from the same link. */
export async function PUT(request: Request, ctx: RouteContext<"/api/v/[token]/draft">) {
  try {
    const { token } = await ctx.params;
    if (!isToken(token)) return fail("Not found", 404);
    const sub = await loadByToken(token);
    if (!sub) return fail("Not found", 404);
    const staff = await getStaff();
    if (!canEdit(sub, staff)) return fail(sub.status === "processing" ? "Your submission is being checked. You can edit again if we ask for changes." : "This form can no longer be edited from this link.", 409);
    const { data } = draftSchema.parse(await request.json());
    const now = new Date().toISOString();
    const first = !sub.draft_saved_at;
    await admin().from("submissions").update({ draft_data: data, draft_saved_at: now }).eq("id", sub.id);
    if (first) await logEvent({ vendorId: sub.vendor_id, submissionId: sub.id, actor: staff ? "staff" : "vendor", actorEmail: staff?.email ?? null, action: "form_started", note: staff ? "Filled in by staff on the vendor's link" : null });
    return json({ savedAt: now });
  } catch (err) {
    return fromError(err);
  }
}
