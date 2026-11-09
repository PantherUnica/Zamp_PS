import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/env";
import { getReviewer } from "@/lib/auth";
import { fail } from "@/lib/api";

/** Reviewer-only: redirect to a 60-second signed URL for a private vendor document. */
export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  if (!(await getReviewer())) return fail("Sign in required", 401);
  const { id } = await ctx.params;
  const db = admin();
  const { data: doc } = await db.from("documents").select("storage_path").eq("id", id).single();
  if (!doc) return fail("Document not found", 404);
  const { data, error } = await db.storage.from(STORAGE_BUCKET).createSignedUrl(doc.storage_path, 60);
  if (error || !data) return fail("Could not open document", 500);
  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
