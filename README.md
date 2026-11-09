# Vendor Onboarding: Zamp PS-2

A working vendor-onboarding process: **a vendor submits company, tax and bank details plus documents → AI reads the documents → deterministic rules check completeness, formats, consistency and risk → the system recommends Approve / Pending / Reject with reasons and evidence → a human reviewer makes the final decision.** For anything not approved, the vendor is told exactly what to fix and can reopen the same submission. Processing then resumes on the same case.

**Golden rule:** AI reads, code decides, a human signs. The model only extracts fields (with per-field confidence) from documents. It never sets a status. Only the rules engine produces a recommendation, and only a signed-in reviewer can approve or reject.

## What's in the box

| Screen | Path | Who |
|---|---|---|
| Vendor submission form | `/onboard` | Vendor (public) |
| Vendor status + resubmission | `/v/<secret token>` | Vendor (link only) |
| Operations dashboard | `/dashboard` | Reviewer |
| Live run view (stage by stage) | `/runs/<id>` | Reviewer |
| Case review and decision | `/cases/<id>` | Reviewer |
| Case history with filters | `/cases` | Reviewer |

**Pipeline** (`src/lib/pipeline.ts`). Each stage is persisted to `run_stages` as it runs, which is what the live view shows:

1. **Intake and completeness** (rules): required documents per country.
2. **Document classification and extraction** (AI, OpenAI): classifies each file, extracts typed fields with confidence, and flags instruction-like text inside documents.
3. **Format validation** (rules): GSTIN checksum, EIN prefix, UK VAT mod-97, German USt-IdNr. MOD 11,10, IBAN mod-97, IFSC, ABA routing checksum, bank-proof age, document expiry.
4. **Cross-checks** (rules): company name vs registration/tax certificate, company name vs bank account holder (legal-suffix normalisation plus fuzzy score), tax ID vs certificate, bank account vs bank document, document country, GSTIN-embedded PAN vs name, unrequested changes between versions.
5. **Risk and duplicates** (rules): tax ID or bank account already used by another submission or vendor; bank country mismatch.
6. **Decision rules** (rules, `src/lib/rules/engine.ts`): any hard stop → *reject* recommendation. Any finding needing judgment → *pending* (review queue). Only vendor-fixable items → *pending* (request sent to the vendor). Otherwise → *approve* recommendation.
7. **Routing and vendor communication** (rules): either an information request listing exactly what to fix, or the human review queue.

Thresholds live in `POLICY` in `src/lib/rules/engine.ts`. Name match: pass ≥ 92, grey zone 75 to 91. Field confidence ≥ 0.75. Bank proof ≤ 90 days. 3 resubmission rounds.

**Human controls** (`src/app/api/cases/[id]/decision/route.ts`, enforced server-side):
- A written note is required on every decision.
- Every *review* or *hard stop* finding must be explicitly acknowledged before approval.
- Approval is blocked while vendor-fixable items are open.
- A confirmation step is shown, and the decision is logged with the reviewer's email, including whether it overrode the recommendation.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Supabase Postgres + Auth + Storage (private bucket) · OpenAI Responses API with strict JSON-schema output · zod · deployed on Vercel. Long-running processing uses `after()` with `maxDuration = 300`, so the HTTP request returns immediately while the run continues and streams its state into Postgres.

Security: all database and storage access happens in server routes with the service-role key, after a reviewer-session or vendor-token check. RLS is enabled on every table with no public policies. Documents go straight from the browser to private storage via signed upload URLs, and reviewers open them via 60-second signed URLs. No secret is exposed to the browser (only the public anon key).

## Setup (about 10 minutes)

### 1. Supabase
1. Create a project at supabase.com.
2. Apply the schema. Either paste `supabase/migrations/0001_init.sql` into **SQL Editor → Run**, or set `SUPABASE_DB_URL` and run `npm run db:migrate`. This creates the tables, enables RLS and creates the private `vendor-documents` bucket.
3. Create a reviewer: **Authentication → Users → Add user** (email + password, "Auto confirm user").
4. Recommended: **Authentication → Sign In / Providers → Email → disable "Allow new users to sign up"**, so only users you add can sign in. Optionally restrict further with `REVIEWER_EMAILS`.

### 2. Environment variables
Copy `.env.example` to `.env.local` and fill it in:

| Variable | Where | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (server only) | yes |
| `OPENAI_API_KEY` | platform.openai.com | yes |
| `OPENAI_MODEL` | any model with PDF/image input + structured outputs (default `gpt-5.4-mini`) | no |
| `REVIEWER_EMAILS` | comma-separated allow-list | no |
| `SUPABASE_DB_URL` | only for `npm run db:migrate` | no |

### 3. Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000, sign in at `/login` with the reviewer you created, and go to **New submission**.

### 4. Deploy to Vercel
1. Push this repository to GitHub.
2. In Vercel: **Add New → Project → Import** the repo. The framework is detected as Next.js, and no build settings need changing.
3. Add the environment variables from the table above (Production and Preview).
4. Deploy. In Supabase → Authentication → URL Configuration, set **Site URL** to your Vercel URL.

Processing runs in a serverless function with `maxDuration = 300`. That fits Vercel Hobby and Pro with Fluid Compute, which is on by default for new projects.

## Test data and tests

`public/samples/` contains generated PDFs for four prepared vendors, with real check digits. A signed-in reviewer sees **Load test case** on the submission form. It fills the form and attaches the PDFs, and everything after that (upload, AI extraction, rules, decision) runs for real.

| Case | Input | Expected |
|---|---|---|
| Happy path | Northwind Components Pvt Ltd (IN), 3 clean documents | Recommend **approve** → reviewer approves |
| Edge 1, incomplete | Kestrel Fasteners Inc. (US), bank proof missing | **Pending**: request sent → vendor uploads `kestrel/bank_letter.pdf` on the same link → re-run → approve |
| Edge 2, bank name mismatch | Brightline Packaging GmbH (DE), bank letter holder "Brightline Logistik GmbH" | **Pending**, human review: `BANK_NAME_MISMATCH` with both names and score |
| Edge 3, tax ID | Albion Precision Ltd (GB) entered an Indian-format GSTIN; VAT certificate shows a different GB number | **Pending**, human review: `TAX_ID_INVALID`, `TAX_ID_COUNTRY_MISMATCH`, `TAX_ID_DOCUMENT_CONFLICT`. Approval is blocked until the vendor fixes it |

```bash
npm run test:rules   # deterministic engine tests (no network)
npm run samples      # regenerate the PDFs (re-run before a demo so bank letters stay < 90 days old)
npm run build        # production build
```

See [DEMO.md](DEMO.md) for the five-minute walkthrough.

## Assumptions
- Countries in scope are IN, US, GB and DE. Each country requires a tax certificate, bank proof and a registration certificate.
- Policy thresholds are mine. A real customer would supply theirs, and they live in one object.
- Duplicate detection compares against submissions in this system. There is no external ERP or sanctions feed.
- Vendor communication is delivered through the vendor's secure link (`/v/<token>`, shown on the case as "Copy vendor link"). No email provider is wired in.

## Limitations / next steps
Real email delivery, live sanctions screening, bank account verification APIs, ERP vendor creation after approval, and per-customer policy configuration.
