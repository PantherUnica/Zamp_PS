---
deliverable: 03-prd
status: draft
updated: YYYY-MM-DD
---

# PRD: Vendor Onboarding Digital Employee (PS-2)

## 1. Summary
[3 sentences: who, what problem, what the product does end to end. Use the trust framing from 01.]

## 2. Goals and non-goals
**Goals** (each tied to a KPI in 06):
- G-a: Every submission reaches a status with visible reasoning (PS-2 core, G1)
- G-b: Vendor-fixable issues are requested precisely, and the case resumes without restart (P8, E3)
- G-c: No vendor reaches `approved` without a human signature, and that signature is informed (D-001)
- G-d: Fraud signals P4/P7 are caught on the seeded test pack (E1b, E2)

**Non-goals:** real bank verification API · real ERP · live sanctions feed · multi-tenant ·
e-signature · countries beyond IN/US/DE/GB.

## 3. Statuses (the product's contract)

| Status | Set by | Meaning | Next |
|--------|--------|---------|------|
| `pending_vendor` | Decision Engine | Vendor-fixable issue | Email, wait, resume |
| `pending_review` | Decision Engine | Judgment needed | Human review (full brief) |
| `ready_for_approval` | Decision Engine | All checks clean | Human one-click sign-off (D-001) |
| `pending_reject` | Decision Engine | `block` finding | Human confirms (O-1) |
| `approved` | **Human only** | Signed off | `create_vendor` (+ contract, COULD) |
| `rejected` | **Human only** (or timeout rule) | Closed | Reason email (O-2) + log |
| `on_hold_bank_change` | Watch trigger | Bank details changed post-approval | Finance approval (SHOULD) |

## 4. Functional requirements

Format: `FR-xx | node | requirement | anchor(s) | tier | story`

### Intake & magic link
| ID | Node | Requirement | Anchor | Tier | Story |
|----|------|-------------|--------|------|-------|
| FR-01 | intake | Sales can generate a tokenised magic link for a named vendor, with pre-filled legal name and contact email | D-006, P1 | MUST | US-01 |
| FR-02 | intake | The submission is checked against `country_rules.json`; each missing doc becomes a `fixable` finding | P1 | MUST | US-02 |
| FR-03 | intake | If the vendor edits a pre-filled field, that creates an `info` or `review` finding (O-4) | P6 | MUST | |

### Read
| ID | Node | Requirement | Anchor | Tier | Story |
|----|------|-------------|--------|------|-------|
| FR-04 | read_docs | Each file is classified; a wrong doc type becomes a `fixable` finding naming the expected type | P2 | MUST | |
| FR-05 | read_docs | Fields are extracted to a Pydantic schema with per-field confidence; below `policy.extraction.min_confidence` gives `fixable` "clearer copy of page N" | P3, E4 | MUST | |
| FR-06 | read_docs | Instruction-like text inside a document creates a `review` finding "embedded instructions detected"; it never alters flow | P10, E4 | MUST | |

### Check, cross-check, risk
| ID | Node | Requirement | Anchor | Tier | Story |
|----|------|-------------|--------|------|-------|
| FR-07 | hard_checks | Tax ID format + checksum per country; IBAN/IFSC; doc expiry; bank proof age ≤ `bank_proof.max_age_days` | P5, X2 | MUST | |
| FR-08 | cross_check | Legal-suffix normalisation, then a fuzzy score; ≥ pass gives info, grey zone gives `review` plus an LLM opinion (text only) | P4, E1 | MUST | |
| FR-09 | cross_check | Form vs document vs bank comparison of name, country, address, tax ID | P6 | MUST | |
| FR-10 | risk | Bank account / tax ID / domain / fuzzy-name lookup in `vendor_master`; a hit gives `review` naming the other vendor | P7, E2 | MUST | |
| FR-11 | risk | Sanctions hit gives `block`; high-risk country gives `review` (never one-click) | X3 | MUST | |

### Decide, act, wait
| ID | Node | Requirement | Anchor | Tier | Story |
|----|------|-------------|--------|------|-------|
| FR-12 | decide | Status derived only from finding severities per policy; LLM writes the explanation only | D-005 | MUST | |
| FR-13 | email_vendor | One consolidated email per round listing only open items, with what a correct doc looks like and a deadline | P8 | MUST | |
| FR-14 | (resume) | A reply resumes the same thread_id; only changed items are re-checked; changed previously-verified fields are flagged | E3 | MUST | |
| FR-15 | (timers) | Reminder / escalate / close per `reminders` policy (O-5) | X4 | MUST | |
| FR-16 | human_review | Approval queue with lanes; brief shows evidence; anti-rubber-stamp controls (see 04) | D-001, P11 | MUST | |
| FR-17 | create_vendor | Writes the vendor to the mock ERP table and returns a vendor ID | P9 | MUST | |
| FR-18 | audit | Every node writes an event (case_id, node, ts, input summary, output summary, actor) | P9 | MUST | |
| FR-19 | watch | A bank-detail change on an approved vendor reopens verification, holds payments, and needs Finance approval | X1 | SHOULD | |
| FR-20 | contract | Generates an NDA/MoU from a template after approval and attaches it to the vendor record | D-009 | COULD | |
| FR-21 | learn | Override reasons are stored; repeated patterns appear as suggested policy changes | P11 | COULD | |

## 5. AI-specific requirements
- Structured output only (Pydantic). Malformed output gets 1 retry, then a `review` finding "extraction failed", never a silent pass
- Temperature 0; model and prompt version stored on each event
- Documents are untrusted input; system prompt states this; no tool is reachable from document content
- Confidence thresholds are in `policy.yaml`, not prompts
- LLM unavailable: the case pauses in `pending_review` with reason "AI unavailable"; it never auto-advances

## 6. User stories (one per MUST FR minimum)

```
US-01 (FR-01) As a Category Manager, I want to send a pre-filled onboarding link to an agreed
vendor, so that they start with the right fields and I can track where they are.

Scenario: Sales sends a magic link
  Given vendor "Northwind Components Pvt Ltd" with contact accounts@northwindcomponents.in
  When I click "Invite vendor"
  Then a single-use link valid for [O-4] days is created and emailed to that address
  And the case appears on the dashboard as "Invited"
  And I cannot approve this case later (separation of duties)
```
[Continue US-02...]

## 7. UI requirements (G3, D-008)
| Screen | Must show | Anchor |
|--------|-----------|--------|
| New case | Prepared-case dropdown + upload + Run; Invite vendor (magic link) | G6, FR-01 |
| Live run view | Vertical timeline; each node lights up with its output, streamed | G3 |
| Case detail | Status badge, reasoning, findings + evidence, email draft, audit log, actions | G3, FR-16 |
| Approval queue | Lanes, risk-ordered; Approve disabled until review flags are ticked | D-001 |
| Dashboard | Counts by status, time to decision, waiting-on-vendor aging, queue, history filters, ≥1 control-health tile | G3, 06 |

Style: white cards, light grey canvas, single red accent for alerts/status, rounded corners, compact KPI tiles.

## 8. Challenge pass
- [ ] Every MUST FR has ≥1 story with Gherkin AC
- [ ] No FR lets an LLM set status or reach `approved`
- [ ] Every status in §3 is reachable and visible in the UI
- [ ] Open decisions O-4, O-5 resolved or logged in open-questions.md
