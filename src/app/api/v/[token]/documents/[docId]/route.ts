import { admin } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/env";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isToken, isUuid, json } from "@/lib/api";
import { canEdit, draftVersion, loadByToken } from "@/lib/portal";
import { logEvent } from "@/lib/events";

async function context(ctx: RouteContext<"/api/v/[token]/documents/[docId]">) {
  const { token, docId } = await ctx.params;
  if (!isToken(token) || !isUuid(docId)) return null;
  const sub = await loadByToken(token);
  if (!sub) return null;
  const { data: doc } = await admin().from("documents").select("*").eq("id", docId).eq("submission_id", sub.id).maybeSingle();
  return doc ? { sub, doc } : null;
}

/** Confirms an upload landed in storage, then makes it the current document for its slot. */
export async function POST(_req: Request, ctx: RouteContext<"/api/v/[token]/documents/[docId]">) {
  try {
    const c = await context(ctx);
    if (!c) return fail("Not found", 404);
    const staff = await getStaff();
    if (!canEdit(c.sub, staff)) return fail("This form can no longer be edited from this link.", 409);
    const db = admin();
    const folder = c.doc.storage_path.split("/").slice(0, -1).join("/");
    const name = c.doc.storage_path.split("/").pop()!;
    const { data: listed, error } = await db.storage.from(STORAGE_BUCKET).list(folder, { search: name });
    if (error || !listed?.some((o) => o.name === name)) return fail("The upload did not complete. Please try again.", 422);
    await db.from("documents").update({ superseded: true }).eq("submission_id", c.sub.id).eq("slot", c.doc.slot).eq("version", c.doc.version).eq("uploaded", true).neq("id", c.doc.id);
    await db.from("documents").update({ uploaded: true }).eq("id", c.doc.id);
    await logEvent({ vendorId: c.sub.vendor_id, submissionId: c.sub.id, actor: staff ? "staff" : "vendor", actorEmail: staff?.email ?? null, action: "document_uploaded", note: `${c.doc.slot.replace(/_/g, " ")}: ${c.doc.file_name}` });
    return json({ ok: true });
  } catch (err) {
    return fromError(err);
  }
}

/** Removes a document uploaded in the current, not-yet-submitted round. Submitted documents stay. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/v/[token]/documents/[docId]">) {
  try {
    const c = await context(ctx);
    if (!c) return fail("Not found", 404);
    const staff = await getStaff();
    if (!canEdit(c.sub, staff)) return fail("This form can no longer be edited from this link.", 409);
    if (c.doc.version !== draftVersion(c.sub)) return fail("Documents already submitted cannot be removed; upload a replacement instead.", 409);
    const db = admin();
    await db.from("documents").update({ superseded: true }).eq("id", c.doc.id);
    await db.storage.from(STORAGE_BUCKET).remove([c.doc.storage_path]);
    return json({ ok: true });
  } catch (err) {
    return fromError(err);
  }
}
