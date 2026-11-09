import "server-only";
import { admin } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import type { Staff } from "@/lib/auth";

export interface PortalSubmission {
  id: string;
  ref: string;
  vendor_id: string | null;
  status: string;
  current_version: number;
  submitted_at: string | null;
  link_expires_at: string | null;
  link_sent_at: string | null;
  draft_data: Record<string, unknown> | null;
  draft_saved_at: string | null;
  access_token: string;
  legal_name: string;
  contact_email: string;
}

export async function loadByToken(token: string) {
  const { data } = await admin().from("submissions").select("*").eq("access_token", token).maybeSingle();
  return data as (PortalSubmission & Record<string, unknown>) | null;
}

/** The version a vendor is currently editing: v1 before the first submission, then latest + 1. */
export const draftVersion = (s: Pick<PortalSubmission, "status" | "submitted_at" | "current_version">) =>
  !s.submitted_at ? s.current_version : s.current_version + 1;

export const linkExpired = (s: Pick<PortalSubmission, "link_expires_at">) => Boolean(s.link_expires_at && Date.parse(s.link_expires_at) < Date.now());

/** Who may change the form right now. Vendors only while it is theirs to edit; staff until a decision. */
export function canEdit(s: PortalSubmission, staff: Staff | null) {
  if (staff) return !["processing", "approved", "rejected"].includes(s.status);
  return ["draft", "awaiting_vendor"].includes(s.status) && !linkExpired(s);
}

export const vendorLink = (token: string) => `${serverEnv.appUrl()}/v/${token}`;

export const newExpiry = () => new Date(Date.now() + serverEnv.linkValidityDays() * 86_400_000).toISOString();
