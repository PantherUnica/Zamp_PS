import { after } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isUuid, json } from "@/lib/api";
import { runAnalysis } from "@/lib/calls";

export const maxDuration = 120;

/** Analysis status for the call page (polled while the agent reads the transcript). */
export async function GET(_req: Request, ctx: RouteContext<"/api/calls/[id]">) {
  try {
    if (!(await getStaff())) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const { data } = await admin().from("calls").select("id, status, error").eq("id", id).maybeSingle();
    if (!data) return fail("Not found", 404);
    return json(data);
  } catch (err) {
    return fromError(err);
  }
}

/** Re-run the analysis (e.g. after a model or network failure). */
export async function POST(_req: Request, ctx: RouteContext<"/api/calls/[id]">) {
  try {
    if (!(await getStaff())) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    await admin().from("calls").update({ status: "analysing", error: null }).eq("id", id);
    after(() => runAnalysis(id));
    return json({ ok: true }, 202);
  } catch (err) {
    return fromError(err);
  }
}
