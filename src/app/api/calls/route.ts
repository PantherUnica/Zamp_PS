import { after } from "next/server";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { fail, fromError, json } from "@/lib/api";
import { transcriptToText } from "@/lib/ai/transcript";
import { runAnalysis } from "@/lib/calls";
import { logEvent } from "@/lib/events";

export const maxDuration = 120;

const fields = z.object({
  title: z.string().trim().min(2, "Give the call a title").max(160),
  channel: z.enum(["call", "video", "meeting", "other"]).default("call"),
  occurred_at: z.string().optional(),
  duration_minutes: z.coerce.number().int().min(0).max(1000).optional(),
  vendor_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(5000).optional(),
  transcript: z.string().max(200_000).optional(),
});

const ACCEPTED = /\.(txt|vtt|srt|docx|pdf|md)$/i;

/** Logs a call and analyses its transcript in the background (paste text or upload a file). */
export async function POST(request: Request) {
  try {
    const staff = await getStaff();
    if (!staff) return fail("Sign in required", 401);
    const form = await request.formData();
    const f = fields.parse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
    const file = form.get("file");
    let transcript = f.transcript?.trim() ?? "";
    let sourceFile: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (!ACCEPTED.test(file.name)) return fail("Upload a .txt, .vtt, .srt, .docx or .pdf transcript", 422);
      if (file.size > 10 * 1024 * 1024) return fail("Transcript files must be 10 MB or smaller", 422);
      transcript = (await transcriptToText(file)).trim();
      sourceFile = file.name;
    }
    if (transcript.length < 40) return fail("The transcript is empty or too short to analyse", 422);

    const db = admin();
    const { data: call, error } = await db
      .from("calls")
      .insert({
        title: f.title,
        channel: f.channel,
        occurred_at: f.occurred_at ? new Date(f.occurred_at).toISOString() : new Date().toISOString(),
        duration_minutes: f.duration_minutes ?? null,
        vendor_id: f.vendor_id || null,
        notes: f.notes || null,
        transcript,
        source_file: sourceFile,
        logged_by: staff.id,
        status: "analysing",
      })
      .select("id")
      .single();
    if (error || !call) throw new Error(error?.message);
    await logEvent({ vendorId: f.vendor_id || null, actor: "staff", actorEmail: staff.email, action: "call_logged", note: f.title });
    after(() => runAnalysis(call.id));
    return json({ id: call.id }, 201);
  } catch (err) {
    return fromError(err);
  }
}
