# Five-minute demo walkthrough

**Before you record:** run `npm run samples` (keeps bank letters under 90 days old). Sign in as the reviewer. Check the OpenAI key with one throwaway run. Keep two tabs open: **Overview** (`/dashboard`) and **New submission** (`/onboard`).

| Time | Do | Say |
|---|---|---|
| 0:00 | Overview dashboard | "Vendor onboarding is a trust problem. Before we pay anyone, we need to know the company, the tax registration and the bank account all belong to the same legal entity. AI reads the documents; rules decide; a person signs." |
| 0:20 | New submission → **Load test case → Happy path · Northwind** → Submit | "This is the real vendor form. The test case just fills fields and attaches three real PDFs." |
| 0:35 | Live run view, stages lighting up | "Intake checks the per-country document list. The AI stage classifies each file and extracts fields with confidence; you can see every value and its score. Then pure code: GSTIN checksum, IFSC, name match with legal-suffix normalisation ('Pvt Ltd' = 'Private Limited'), duplicates." |
| 1:15 | Outcome: **Approve** → *Review and decide* | "The system can only *recommend*. It lands in the review queue." Show *Submitted vs documents*. Type a note → Approve → confirm. "Recorded under my name, in the decision history." |
| 1:45 | **Edge 1 · Kestrel (missing bank proof)** → Submit | Run ends **Pending** and routes to the vendor. Open the case → *Vendor communication* shows the exact request. "No human touched it; the vendor gets a precise list." |
| 2:15 | Case → **Copy vendor link** → open it | The vendor page says *Action needed* and lists the bank letter. Click **Attach test file** (or upload `public/samples/kestrel/bank_letter.pdf`) → **Resubmit**. "Same case, version 2. Nothing starts over." Watch it resume and reach **Approve**. |
| 3:00 | **Edge 2 · Brightline (bank holder mismatch)** → Submit | Outcome **Pending → human review**. On the case: `BANK_NAME_MISMATCH`, "Brightline Packaging GmbH" vs "Brightline Logistik GmbH", score 60. "Everything else is valid: tax ID, IBAN checksum. This is exactly how payment fraud gets through a manual check." Show that Approve requires ticking the finding. |
| 3:45 | **Edge 3 · Albion (tax ID)** → Submit | Outcome **Pending**. Findings: the tax ID isn't a valid UK VAT number, it has the shape of an Indian GSTIN, and it conflicts with the GB number on the VAT certificate. Show the Approve tab is blocked: "a vendor-fixable item is open." Use **Request info** → note → send. |
| 4:30 | Back to **Overview** | Totals, review queue, waiting-on-vendor with age, every run with its stage strip, median time to decision. "Every stage, input, extracted value, rule result and human decision is persisted in Postgres." |
| 4:50 | Close | "Next: real email delivery, sanctions screening, ERP vendor creation on approval." |

**If a run is slow:** narrate the design (AI only extracts; status comes from `decide()`; documents are untrusted data). Every stage keeps updating live.

**Optional fifth case (rejection path):** after approving Northwind, submit any vendor using GSTIN `29AABCN1234F1ZS` under a different name. Risk stage → `IDENTITY_CONFLICT` → recommend **Reject**, which still needs human confirmation.
