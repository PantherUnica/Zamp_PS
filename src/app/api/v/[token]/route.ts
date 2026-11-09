import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isToken, json } from "@/lib/api";
import { canEdit, draftVersion, linkExpired, loadByToken } from "@/lib/portal";
import { currentDocuments } from "@/lib/pipeline";

/** Vendor-safe view of a submission: what to fill, what is uploaded, what needs fixing, progress. */
export async function GET(_req: Request, ctx: RouteContext<"/api/v/[token]">) {
  try {
    const { token } = await ctx.params;
    if (!isToken(token)) return fail("Not found", 404);
    const sub = await loadByToken(token);
    if (!sub) return fail("This link is not valid. It may have been replaced by a newer link.", 404);
    const staff = await getStaff();
    const db = admin();
    const version = draftVersion(sub);
    const [{ data: vendor }, { data: latest }, docs, { data: req }, { data: run }] = await Promise.all([
      sub.vendor_id ? db.from("vendors").select("company_name, owner:profiles!vendors_owner_id_fkey(full_name, email)").eq("id", sub.vendor_id).maybeSingle() : Promise.resolve({ data: null }),
      db.from("submission_versions").select("data").eq("submission_id", sub.id).order("version", { ascending: false }).limit(1),
      currentDocuments(db, sub.id, version),
      db.from("info_requests").select("items, created_at").eq("submission_id", sub.id).eq("status", "open").order("created_at", { ascending: false }).limit(1),
      db.from("runs").select("id, status").eq("submission_id", sub.id).order("created_at", { ascending: false }).limit(1),
    ]);
    let stages: { key: string; label: string; status: string }[] = [];
    if (run?.[0]) {
      const { data: st } = await db.from("run_stages").select("key, label, status, position").eq("run_id", run[0].id).order("position");
      stages = (st ?? []).map(({ key, label, status }) => ({ key, label, status }));
    }
    const owner = (vendor?.owner as unknown as { full_name: string | null; email: string } | null) ?? null;
    // Internal recommendation, risk findings and reviewer notes are deliberately never exposed here.
    return json({
      ref: sub.ref,
      status: sub.status,
      company: vendor?.company_name ?? sub.legal_name,
      contact: owner ? { name: owner.full_name, email: owner.email } : null,
      data: { ...((latest?.[0]?.data as object) ?? {}), ...(sub.draft_data ?? {}) },
      draftSavedAt: sub.draft_saved_at,
      submittedAt: sub.submitted_at,
      version,
      editable: canEdit(sub, staff),
      expired: linkExpired(sub),
      expiresAt: sub.link_expires_at,
      staffMode: Boolean(staff),
      documents: docs.map((d) => ({ id: d.id, slot: d.slot, file_name: d.file_name, size_bytes: d.size_bytes, version: d.version, isNew: d.version === version && Boolean(sub.submitted_at) })),
      request: req?.[0] ?? null,
      run: run?.[0] ? { status: run[0].status, stages } : null,
    });
  } catch (err) {
    return fromError(err);
  }
}
