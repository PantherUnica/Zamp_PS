import { getStaff } from "@/lib/auth";
import { fail, fromError, isToken, json } from "@/lib/api";
import { fileMetaSchema } from "@/lib/schema";
import { createUpload } from "@/lib/data";
import { canEdit, draftVersion, loadByToken } from "@/lib/portal";

/** Issues a signed upload URL so the file goes straight from the browser to private storage. */
export async function POST(request: Request, ctx: RouteContext<"/api/v/[token]/documents">) {
  try {
    const { token } = await ctx.params;
    if (!isToken(token)) return fail("Not found", 404);
    const sub = await loadByToken(token);
    if (!sub) return fail("Not found", 404);
    if (!canEdit(sub, await getStaff())) return fail("This form can no longer be edited from this link.", 409);
    const meta = fileMetaSchema.parse(await request.json());
    return json(await createUpload(sub.id, draftVersion(sub), meta), 201);
  } catch (err) {
    return fromError(err);
  }
}
