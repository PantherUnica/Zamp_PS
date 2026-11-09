import "server-only";
import { admin } from "@/lib/supabase/admin";

export type ActorType = "vendor" | "agent" | "staff" | "system";

/** Append-only audit trail. Every action by the agent, a vendor or a staff member goes through here. */
export async function logEvent(e: {
  vendorId?: string | null;
  submissionId?: string | null;
  runId?: string | null;
  actor: ActorType;
  actorEmail?: string | null;
  action: string;
  note?: string | null;
  data?: Record<string, unknown> | null;
}) {
  const { error } = await admin().from("events").insert({
    vendor_id: e.vendorId ?? null,
    submission_id: e.submissionId ?? null,
    run_id: e.runId ?? null,
    actor_type: e.actor,
    actor_email: e.actorEmail ?? null,
    action: e.action,
    note: e.note ?? null,
    data: e.data ?? null,
  });
  if (error) console.error("audit log failed", error.message);
}
