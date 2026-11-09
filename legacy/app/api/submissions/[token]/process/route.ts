import { after } from "next/server";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/env";
import { createRun, executeRun } from "@/lib/pipeline";
import { fail, fromError, isToken, json } from "@/lib/api";

export const maxDuration = 300;

const bodySchema = z.object({ documentIds: z.array(z.string().uuid()).max(3) });

/** Confirms uploads for the current version, supersedes replaced documents and starts a processing run. */
export async function POST(request: Request, ctx: RouteContext<"/api/submissions/[token]/process">) {
  try {
    const { token } = await ctx.params;
    if (!isToken(token)) return fail("Not found", 404);
    const { documentIds } = bodySchema.parse(await request.json());
    const db = admin();
    const { data: sub } = await db.from("submissions").select("id, status, current_version").eq("access_token", token).single();
    if (!sub) return fail("Not found", 404);
    if (!["draft", "awaiting_vendor"].includes(sub.status)) return fail("This submission is already being processed or reviewed", 409);

    const { data: docs } = await db
      .from("documents")
      .select("id, slot, storage_path, version")
      .eq("submission_id", sub.id)
      .eq("version", sub.current_version)
      .in("id", documentIds.length ? documentIds : ["00000000-0000-0000-0000-000000000000"]);

    for (const d of docs ?? []) {
      // Verify the file really arrived in private storage before trusting it.
      const folder = d.storage_path.split("/").slice(0, -1).join("/");
      const name = d.storage_path.split("/").pop()!;
      const { data: listed, error } = await db.storage.from(STORAGE_BUCKET).list(folder, { search: name });
      if (error || !listed?.some((o) => o.name === name)) return fail(`Upload for ${d.slot.replace(/_/g, " ")} did not complete. Please try again.`, 422);
      await db
        .from("documents")
        .update({ superseded: true })
        .eq("submission_id", sub.id)
        .eq("slot", d.slot)
        .neq("id", d.id)
        .eq("uploaded", true);
      await db.from("documents").update({ uploaded: true }).eq("id", d.id);
    }

    const trigger = sub.current_version > 1 ? "resubmission" : "submission";
    const runId = await createRun(sub.id, sub.current_version, trigger);
    after(() => executeRun(runId));
    return json({ runId }, 202);
  } catch (err) {
    return fromError(err);
  }
}
