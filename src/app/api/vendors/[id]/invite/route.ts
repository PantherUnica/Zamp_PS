import { z } from "zod";
import { getStaff } from "@/lib/auth";
import { fail, fromError, isUuid, json } from "@/lib/api";
import { issueLink } from "@/lib/invite";

const body = z.object({ send: z.boolean().default(true), regenerate: z.boolean().default(false) });

export async function POST(request: Request, ctx: RouteContext<"/api/vendors/[id]/invite">) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail("Not found", 404);
    const b = body.parse(await request.json().catch(() => ({})));
    return json(await issueLink(id, staff, b));
  } catch (err) {
    return fromError(err);
  }
}
