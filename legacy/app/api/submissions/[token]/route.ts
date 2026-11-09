import { admin } from "@/lib/supabase/admin";
import { fail, fromError, isToken, json } from "@/lib/api";

/** Vendor-safe view of a submission: status, what is needed, current data, processing progress. */
export async function GET(_req: Request, ctx: RouteContext<"/api/submissions/[token]">) {
  try {
    const { token } = await ctx.params;
    if (!isToken(token)) return fail("Not found", 404);
    const db = admin();
    const { data: sub } = await db
      .from("submissions")
      .select("id, ref, status, legal_name, current_version, created_at, updated_at")
      .eq("access_token", token)
      .single();
    if (!sub) return fail("Not found", 404);

    const [{ data: version }, { data: docs }, { data: req }, { data: run }] = await Promise.all([
      db.from("submission_versions").select("data").eq("submission_id", sub.id).eq("version", sub.current_version).single(),
      db.from("documents").select("slot, file_name, version, created_at").eq("submission_id", sub.id).eq("uploaded", true).eq("superseded", false),
      db.from("info_requests").select("items, message, created_at").eq("submission_id", sub.id).eq("status", "open").order("created_at", { ascending: false }).limit(1),
      db.from("runs").select("id, status, created_at").eq("submission_id", sub.id).order("created_at", { ascending: false }).limit(1),
    ]);
    let stages: { key: string; label: string; status: string }[] = [];
    if (run?.[0]) {
      const { data: st } = await db.from("run_stages").select("key, label, status, position").eq("run_id", run[0].id).order("position");
      stages = (st ?? []).map(({ key, label, status }) => ({ key, label, status }));
    }
    // Internal recommendation, risk findings and reviewer notes are deliberately not exposed to the vendor.
    return json({
      ref: sub.ref,
      status: sub.status,
      legal_name: sub.legal_name,
      version: sub.current_version,
      data: version?.data ?? null,
      documents: docs ?? [],
      request: req?.[0] ?? null,
      run: run?.[0] ? { status: run[0].status, stages } : null,
      updated_at: sub.updated_at,
    });
  } catch (err) {
    return fromError(err);
  }
}
