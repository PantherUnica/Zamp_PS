import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import type { RequestItem } from "@/lib/messages";
import { compose, type Composed } from "@/lib/email/templates";
import { modelOptions, openai } from "./extract";

/**
 * Agent-written correction email. The agent only chooses wording: the list of issues comes from
 * the rules engine, one sentence per issue, in the same order. If the model returns anything that
 * does not line up with the issue list, the deterministic template is used instead.
 */
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "opening", "items", "closing"],
  properties: {
    subject: { type: "string" },
    opening: { type: "string" },
    items: { type: "array", items: { type: "string" } },
    closing: { type: "string" },
  },
};

const parsed = z.object({ subject: z.string().min(5).max(140), opening: z.string().min(10).max(800), items: z.array(z.string().min(5).max(400)), closing: z.string().max(600) });

const SYSTEM = `You write short, polite correction emails to Indian business vendors who are completing supplier onboarding.

Rules:
- Write one plain-language instruction per issue, in exactly the order given, the same number of items. Each must say what is wrong and exactly how to fix it, keeping any concrete values (GSTIN, PAN, IFSC, dates) from the issue text.
- Never mention fraud, risk scores, internal reviews, AI, automated systems, or other vendors' names or identifiers.
- Never invent requirements, deadlines or documents that are not in the issues.
- Warm, professional Indian business English. No exclamation marks. No sign-off name (it is added separately).
- opening: 1–2 sentences addressed to the contact by name, referencing the company. closing: 1–2 sentences explaining they can update the same submission from their link without starting over.`;

export async function draftCorrectionEmail(o: {
  contactName?: string | null;
  company: string;
  ref: string;
  url: string;
  items: RequestItem[];
  ownerName?: string | null;
  note?: string;
}): Promise<{ content: Composed; byAgent: boolean }> {
  const fallback = compose.correction(o);
  if (!o.items.length) return { content: fallback, byAgent: false };
  try {
    const model = serverEnv.openaiModel();
    const res = await openai().responses.create({
      model,
      ...modelOptions(model),
      input: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            contact_name: o.contactName || null,
            company: o.company,
            reference: o.ref,
            note_from_salesperson: o.note || null,
            issues: o.items.map((i) => ({ title: i.title, instruction: i.action })),
          }),
        },
      ],
      text: { format: { type: "json_schema", name: "correction_email", schema: SCHEMA, strict: true } },
    });
    const p = parsed.parse(JSON.parse(res.output_text));
    if (p.items.length !== o.items.length) return { content: fallback, byAgent: false };
    const sign = o.ownerName ? `\n\nRegards,\n${o.ownerName}` : "";
    return {
      byAgent: true,
      content: {
        subject: `${p.subject.replace(/\s*\(VND-\d+\)$/, "")} (${o.ref})`,
        body: `${p.opening}\n\n${p.items.map((t, i) => `${i + 1}. ${t}`).join("\n")}${o.note?.trim() ? `\n\n${o.note.trim()}` : ""}\n\n${p.closing}${sign}`,
        ctaLabel: fallback.ctaLabel,
        ctaUrl: fallback.ctaUrl,
      },
    };
  } catch {
    return { content: fallback, byAgent: false };
  }
}
