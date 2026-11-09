import "server-only";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export interface Reviewer {
  id: string;
  email: string;
}

/** Returns the signed-in reviewer, or null. Enforces the optional REVIEWER_EMAILS allow-list. */
export async function getReviewer(): Promise<Reviewer | null> {
  const supabase = await authClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return null;
  const allow = serverEnv.reviewerEmails();
  if (allow.length && !allow.includes(user.email.toLowerCase())) return null;
  return { id: user.id, email: user.email };
}

export async function requireReviewer(next = "/dashboard"): Promise<Reviewer> {
  const r = await getReviewer();
  if (!r) redirect(`/login?next=${encodeURIComponent(next)}`);
  return r;
}
