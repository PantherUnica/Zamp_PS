---
deliverable: 01-problem-brief
status: draft
updated: YYYY-MM-DD
---

# PS-2 Problem Brief: Vendor Onboarding Digital Employee

## 1. One-line problem (trust framing)
> [Buyer] can't tell, quickly and provably, whether a new vendor is who they say they are before
> paying them. Today that takes [N] days of inbox-driven checking and chasing, and a bad
> onboarding means payment fraud or a compliance breach.

Anchors: P4, P6, P7, P9, P10

## 2. Buyer and context (D-003)
- Company: [fictional name], mid-size manufacturer, [headcount], suppliers in IN/US/DE/GB
- Volume: [N] new vendors/quarter (ASSUMPTION A-01)
- Teams touched: Procurement Ops, Finance/AP, Compliance, Category/Sales (requester)
- Current tooling: email + spreadsheet + ERP vendor master

## 3. What PS-2 asks vs what we add

| Item | PS-2 requires? | Tier (D-002) | Pain point | Why it earns its place |
|------|----------------|--------------|------------|------------------------|
| Submission in → approved/pending/rejected + reasoning | Yes | MUST | P9, P11 | Core ask |
| Communicate back what's needed | Yes | MUST | P1, P8 | Core ask |
| 2-4 non-trivial edge cases | Yes | MUST | G2 | Graded |
| Live run view + dashboard | Yes (guide) | MUST | G3 | Graded |
| Wait & resume same case | No | MUST | P8 | Makes it a digital employee, not a form checker |
| Human signs every approval (D-001) | No | MUST | P10, P11 | Builder's control stance |
| Sales magic-link intake (D-006) | No | MUST | P1, P2 | Pre-fill cuts incomplete submissions at source |
| Bank-change watch | No | SHOULD | P4, P7 | Highest-fraud lifecycle moment |
| Contract/NDA/MoU from template (D-009) | No | COULD | - | Completes "ready-to-transact" |
| Learn from overrides | No | COULD | P11 | Shows the system improving |

## 4. Success in one paragraph
[What the buyer sees after 1 quarter, and what the interviewer sees after 5 minutes.]

## 5. Assumptions (label each; this list is shown in the interview)

| ID | Assumption | Why it's reasonable | Interview line |
|----|------------|---------------------|----------------|
| A-01 | | | |
| A-02 | policy.yaml thresholds (name ≥92 pass, 75-91 grey, bank proof ≤90 days) | Blueprint defaults | "These are my assumptions. A customer gives us theirs, and it's one config file." |
| A-03 | Countries limited to IN/US/DE/GB | Covers GSTIN, EIN, VAT, IBAN/IFSC validators | |
| A-04 | Mock ERP table, fake sanctions list, email to a test inbox (D-007) | Case study FAQ allows self-made data | |

## 6. Out of scope (said out loud as limitations)
- Real bank account verification API · real ERP · live sanctions feed · multi-tenant · e-signature

## 7. Challenge pass
- [ ] Every "what we add" row has a P# or G#
- [ ] Nothing promised exceeds the 7-day plan once D-002 cuts are applied
- [ ] Buyer named; volume assumption labelled
- [ ] At least one decision logged (D-0xx)
