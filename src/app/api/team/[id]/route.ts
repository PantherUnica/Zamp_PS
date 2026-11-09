import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getStaff, isAdmin } from "@/lib/auth";
import { fail, fromError, isUuid, json } from "@/lib/api";

/** Admin changes a teammate's role. The last admin cannot be demoted. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/team/[id]">) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    if (!isAdmin(staff)) return fail("Only admins can manage the team", 403);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const { role } = z.object({ role: z.enum(["sales", "reviewer", "admin"]) }).parse(await request.json());
    const db = admin();
    if (role !== "admin") {
      const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
      if ((admins ?? []).length <= 1 && admins?.[0]?.id === id) return fail("There must be at least one admin", 409);
    }
    const { error } = await db.from("profiles").update({ role }).eq("id", id);
    if (error) throw new Error(error.message);
    await db.auth.admin.updateUserById(id, { app_metadata: { role } });
    return json({ ok: true });
  } catch (err) {
    return fromError(err);
  }
}
