import type { RequestItem } from "@/lib/messages";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Renders the stored plain-text body into the branded HTML shell. Plain text is the source of
 * truth (it is what staff edit), so every email has an identical text alternative.
 * Lines starting with "1. ", "2. " become an ordered list; blank lines separate paragraphs.
 */
export function renderEmailHtml(opts: { subject: string; body: string; ctaLabel?: string | null; ctaUrl?: string | null; brand: string }) {
  const blocks = opts.body.trim().split(/\n\s*\n/);
  const html = blocks
    .map((b) => {
      const lines = b.split("\n");
      if (lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
        return `<ol style="margin:0 0 16px;padding-left:20px;color:#262626">${lines
          .map((l) => `<li style="margin:0 0 8px">${esc(l.trim().replace(/^\d+\.\s/, ""))}</li>`)
          .join("")}</ol>`;
      }
      return `<p style="margin:0 0 16px">${lines.map(esc).join("<br>")}</p>`;
    })
    .join("");
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px"><tr><td style="border-radius:6px;background:#c2410c"><a href="${esc(opts.ctaUrl)}" style="display:inline-block;padding:11px 20px;font-weight:600;font-size:14px;color:#ffffff;text-decoration:none;border-radius:6px">${esc(opts.ctaLabel)}</a></td></tr></table><p style="margin:0 0 16px;font-size:12px;color:#737373">Or paste this link into your browser:<br><a href="${esc(opts.ctaUrl)}" style="color:#525252;word-break:break-all">${esc(opts.ctaUrl)}</a></p>`
      : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(opts.subject)}</title></head>
<body style="margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#262626">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f4;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e4;border-radius:10px">
<tr><td style="height:3px;background:#c2410c;border-radius:10px 10px 0 0"></td></tr>
<tr><td style="padding:24px 32px 0;font-size:13px;font-weight:600;letter-spacing:.02em;color:#171717">${esc(opts.brand)}</td></tr>
<tr><td style="padding:20px 32px 8px">${html}${cta}</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #f0efee;font-size:12px;color:#8a8a8a">This message was sent by ${esc(opts.brand)}. Reply to this email to reach your contact directly.</td></tr>
</table></td></tr></table></body></html>`;
}

export interface Composed {
  subject: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export const compose = {
  invite(o: { contactName?: string | null; company: string; ownerName: string; url: string; expires: string }): Composed {
    return {
      subject: `Complete your vendor onboarding for ${o.company}`,
      body: `Hello ${o.contactName || "there"},

${o.ownerName} has invited ${o.company} to register as a vendor. The secure form below takes about 10 minutes. You will need:

1. GSTIN and PAN of the business
2. Bank account details (account number and IFSC)
3. GST registration certificate, PAN card, and a cancelled cheque or bank letter
4. Certificate of incorporation (for companies, LLPs and partnerships)

You can save your progress and come back to the same link at any time before ${o.expires}. No account or password is needed.`,
      ctaLabel: "Start onboarding",
      ctaUrl: o.url,
    };
  },
  submissionReceived(o: { contactName?: string | null; company: string; ref: string; url: string; resubmission: boolean }): Composed {
    return {
      subject: o.resubmission ? `We received your updated details (${o.ref})` : `We received your vendor submission (${o.ref})`,
      body: `Hello ${o.contactName || "there"},

Thank you. We have received ${o.resubmission ? "the updated details" : "the onboarding details"} for ${o.company} (reference ${o.ref}).

We are now checking your documents and details. If anything needs correcting, we will email you exactly what to change, and you can update the same submission from your link. You can follow the status there at any time.`,
      ctaLabel: "View your submission",
      ctaUrl: o.url,
    };
  },
  correction(o: { contactName?: string | null; company: string; ref: string; url: string; items: RequestItem[]; note?: string }): Composed {
    const lines = o.items.map((it, i) => `${i + 1}. ${it.action}`).join("\n");
    return {
      subject: `Action needed: please update your vendor details (${o.ref})`,
      body: `Hello ${o.contactName || "there"},

Thank you for submitting ${o.company}. We could not complete verification yet. Please fix the following:

${lines}${o.note?.trim() ? `\n\n${o.note.trim()}` : ""}

Open your onboarding link, make these changes and resubmit. Everything else you provided is already saved; you do not need to start over.`,
      ctaLabel: "Update my submission",
      ctaUrl: o.url,
    };
  },
  approved(o: { contactName?: string | null; company: string; ref: string }): Composed {
    return {
      subject: `${o.company} is approved as a vendor`,
      body: `Hello ${o.contactName || "there"},

Good news: ${o.company} (reference ${o.ref}) has been verified and approved as a vendor. Our accounts team will use the bank details you provided for future payments.

If any of your bank or tax details change, please let us know before your next invoice so we can re-verify them.`,
    };
  },
  rejected(o: { contactName?: string | null; company: string; ref: string }): Composed {
    return {
      subject: `Update on your vendor registration (${o.ref})`,
      body: `Hello ${o.contactName || "there"},

Thank you for your interest in working with us. After review, we are unable to approve the vendor registration for ${o.company} (reference ${o.ref}) at this time.

If you believe this is a mistake, please reply to this email and your contact will get back to you.`,
    };
  },
  staffSubmitted(o: { staffName: string; company: string; ref: string; resubmission: boolean; url: string }): Composed {
    return {
      subject: `${o.company} ${o.resubmission ? "resubmitted" : "submitted"} their onboarding form`,
      body: `Hi ${o.staffName},

${o.company} (${o.ref}) has ${o.resubmission ? "resubmitted their updated details" : "submitted their onboarding form"}. Automated verification is running now; you will get another email if anything needs your action.`,
      ctaLabel: "Watch verification",
      ctaUrl: o.url,
    };
  },
  staffActionNeeded(o: { staffName: string; company: string; ref: string; headline: string; reasons: string[]; url: string }): Composed {
    return {
      subject: `${o.company}: ${o.headline}`,
      body: `Hi ${o.staffName},

Verification finished for ${o.company} (${o.ref}). ${o.headline}.

${o.reasons.slice(0, 6).map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
      ctaLabel: "Open vendor",
      ctaUrl: o.url,
    };
  },
  teammate(o: { name: string; roleLabel: string; inviter: string; url: string }): Composed {
    return {
      subject: `You have been added to Vendor Onboarding`,
      body: `Hi ${o.name},

${o.inviter} added you as a ${o.roleLabel}. Set your password to sign in. The link works once and expires in 24 hours.`,
      ctaLabel: "Set password",
      ctaUrl: o.url,
    };
  },
};
