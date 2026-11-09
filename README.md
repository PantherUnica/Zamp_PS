# Vendor Onboarding: Zamp PS-2 (v2)

From the first sales call to an approved Indian supplier:

1. **A salesperson logs a call.** They upload or paste the transcript, and the agent extracts the vendor's details, requirements, objections, risk signals, action items and coaching.
2. **They send a personal magic link.** The vendor fills a guided form with no account needed. It autosaves, can be resumed later, and checks GSTIN, PAN, IFSC, account number, CIN, Udyam, PIN code and mobile formats as they type.
3. **The agent verifies the submission.** AI reads the documents. Deterministic rules then check formats, cross-check every value against the documents, look up the IFSC in RBI branch data, and check for duplicates. Every check is labelled with where its evidence comes from.
4. **Corrections go out by email.** A request for missing documents is sent automatically. Anything involving judgment is drafted by the agent for the salesperson to review and send. The vendor fixes the items on the same link, and verification resumes at version 2.
5. **A reviewer decides.** Only reviewers and admins can approve or reject, never on vendors they own, and only after acknowledging every flag. Every action by the agent, the vendor or staff is in the audit trail.

**Honesty rules.** A format check proves a number is well-formed, not that it exists. GSTN, PAN and penny-drop registry checks are shown as **Not connected** and never count as passed. The agent never sets a vendor to approved.

## Screens
| Path | Who | Purpose |
|---|---|---|
| `/` | Everyone | Landing: staff sign-in, and vendors paste their link |
| `/dashboard` | Staff | Central overview: attention list, journey funnel, follow-ups, agent runs, email activity, calls |
| `/vendors`, `/vendors/[id]` | Staff | Vendor list and record: journey, verification report, comparison table, documents, calls, activity, decision, link, emails |
| `/calls/new`, `/calls/[id]` | Staff | Transcript upload, call intelligence, apply extracted details to a vendor |
| `/review` | Reviewers | Queue grouped by recommendation |
| `/emails` | Staff | Outbox with drafts to review, failed (retry) and sent emails, with delivery status |
| `/runs/[id]` | Staff | Live stage-by-stage view of a verification run |
| `/team` | Admin | Add teammates (emailed set-password link) and change roles |
| `/v/[token]` | Vendor | Magic-link onboarding form and status |

## Setup

### 1. Database (Supabase → SQL Editor)
Run **both** files in order:
1. `supabase/migrations/0001_init.sql` (skip it if you ran it before)
2. `supabase/migrations/0002_sales_vendor_portal.sql`

Both are idempotent. 0002 adds roles, vendors, the email outbox, calls and tasks, and **makes every existing login an admin**. Alternatively, set `SUPABASE_DB_URL` and run `npm run db:migrate`.

### 2. Environment
Copy `.env.example` to `.env` and fill it in (see the comments in that file). For email you need a Gmail account with 2-Step Verification and an **App Password**, created under Google Account → Security → App passwords.

### 3. Run
```bash
npm install
npm run dev
```

### 4. Deploy (Vercel)
1. Push to GitHub, then in Vercel import the repo.
2. Add every variable from `.env`, with `APP_URL` set to your Vercel URL.
3. Deploy.
4. In Supabase → Authentication → URL Configuration, set Site URL to the Vercel URL.

Long work (verification, transcript analysis) runs in `after()` with `maxDuration` 300s/120s.

## Roles
| Role | Can |
|---|---|
| Salesperson | Log calls, add vendors, send and regenerate links, edit details, send correction emails, re-run verification |
| Reviewer | All of the above, plus approve and reject vendors they don't own |
| Admin | All of the above, plus manage the team |

## Tests
```bash
npm run test:rules   # 13 deterministic engine tests (no network)
npm run test:e2e     # full flow against a running app + your Supabase, OpenAI and Gmail
npm run samples      # regenerate the demo PDFs
npm run build
```

## Demo vendors (India)
| Case | Vendor | Expected |
|---|---|---|
| Happy path | Northwind Components Pvt Ltd (Karnataka) | All checks pass → ready for approval |
| Edge 1, missing document | Kestrel Fasteners Pvt Ltd (Maharashtra), no cheque | Request auto-emailed → vendor adds the cheque on the same link → v2 → ready |
| Edge 2, bank holder mismatch | Brightline Packaging LLP (Gujarat), cheque in "Brightline Logistics Pvt Ltd" | Needs judgment → agent drafts a correction for the salesperson |
| Edge 3, tax identity | Albion Precision Pvt Ltd (Tamil Nadu) typed a Maharashtra GSTIN embedding another PAN | GSTIN state, GSTIN↔PAN and certificate conflicts → blocked from clearance |

Use **New vendor → Demo vendor…** to create one (the contact email defaults to yours). Open the link, and as a signed-in staff member use **Fill demo details**. See [DEMO.md](DEMO.md).

## Assumptions and limits
India only. Thresholds live in `POLICY` (`src/lib/rules/engine.ts`). There is no GSTN, NSDL or penny-drop provider and no sanctions feed. Gmail SMTP acceptance is recorded as "sent"; bounces are not tracked. Replaced v1 screens are kept in `legacy/` (excluded from the build) and can be deleted.
