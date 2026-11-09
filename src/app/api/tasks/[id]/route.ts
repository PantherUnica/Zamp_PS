import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isUuid, json } from "@/lib/api";
import { logEvent } from "@/lib/events";

export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const { done } = z.object({ done: z.boolean() }).parse(await request.json());
    const { data } = await admin().from("tasks").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id).select("vendor_id, title").maybeSingle();
    if (!data) return fail("Not found", 404);
    if (done) await logEvent({ vendorId: data.vendor_id, actor: "staff", actorEmail: staff.email, action: "task_done", note: data.title });
    return json({ ok: true });
  } catch (err) {
    return fromError(err);
  }
}
