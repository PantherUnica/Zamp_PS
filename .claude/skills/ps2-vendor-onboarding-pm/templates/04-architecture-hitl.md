---
deliverable: 04-architecture-hitl
status: draft
updated: YYYY-MM-DD
---

# Architecture, Workflow and Human-in-the-Loop

## 1. Graph (fixed supervisor graph, D-010)

```
invite(magic link) → intake → read_docs → hard_checks → cross_check → risk → decide
decide ─ ready_for_approval → human_review(1-click lane) ─ approve → create_vendor → [contract: COULD] → END
       ─ pending_review     → human_review(full lane)   ─ approve / reject / ask vendor
       ─ pending_reject     → human_review(confirm)     ─ confirm reject → email_vendor(O-2) → END
       ─ pending_vendor     → email_vendor → WAIT ──(reply, same thread_id)──→ re-check changed items → decide
watch(bank change on approved vendor) → hold payments → hard_checks/cross_check/risk → human_review(Finance) [SHOULD]
audit() wraps every node → events table → dashboard
```
**D-001 check:** no edge reaches `create_vendor` except from a human `approve` action.

## 2. CaseState additions beyond the blueprint
| Field | Why |
|-------|-----|
| `round` (int) | E3 / reject-after-3-rounds rule |
| `field_history` (dict of lists) | Detect a previously verified field changing (E3) |
| `invited_by` | Separation of duties (requester ≠ approver) |
| `approvals` (list: who, lane, ts, ticked_findings, note) | Audit + control-health KPIs |
| `payment_hold` (bool) | E2, X1 |

## 3. AI vs code split

| Node | LLM may | Code decides | If the LLM fails / times out |
|------|---------|--------------|------------------------------|
| intake | Map free-text doc names to types (light) | Checklist completeness | Fall back to filename rules; flag `review` |
| read_docs | Classify, extract fields + confidence, flag instruction-like text | Confidence threshold gate | 1 retry, then `review` "extraction failed" |
| hard_checks | none | Everything | n/a |
| cross_check | Opinion on grey-zone names (text) | Normalisation, score, severity | Grey zone stays `review` without an opinion |
| risk | none | Everything | n/a |
| decide | Write the reasoning paragraph | Status | Templated reasoning from findings |
| email_vendor | Draft email from open findings | Which items are listed | Template email |

## 4. Approval matrix (resolve O-1, O-6, O-7)

| Lane | Trigger | Approver(s) | Brief shows | SLA | Blocked until done |
|------|---------|-------------|-------------|-----|--------------------|
| One-click | `ready_for_approval` | Procurement Ops (≠ inviter) | Each check: source value vs doc value vs result; doc thumbnails | 1 business day | ERP record |
| Full review | `pending_review` | Procurement Ops; + Finance if P7/E2 | Findings with evidence side by side; AI opinion labelled as opinion; suggested action | 2 business days | ERP record, payments |
| Reject confirm | `pending_reject` | Compliance / Procurement lead | Match evidence (sanctions entry, blocked vendor) | 1 business day | Vendor notification |
| Bank change | Watch trigger (SHOULD) | Finance + callback evidence | Old vs new account, request channel/domain vs on file | Before next payment run | All payments to vendor |

## 5. Anti-rubber-stamp controls (each: Designed in / Rejected + reason)

| # | Control | Decision | Reason / D-0xx |
|---|---------|----------|----------------|
| C1 | Evidence-first brief (no "all checks passed" summaries) | | |
| C2 | On review lanes, each `review` finding must be ticked or overridden with a note before Approve is enabled | | |
| C3 | Separation of duties: inviter can't approve; bank change needs 2 people | | |
| C4 | Sampling: 1 in N one-click cases is forced into full review (`policy.review_sample_rate`) | | |
| C5 | Log time-to-decision, evidence-opened flag, override reason → control-health KPIs (06) | | |
| C6 (optional) | Seeded "canary" case with a planted flaw in the demo queue, to show the reviewer catches it | | |

**Blind-click test:** if a reviewer clicked Approve 20 times in a row without opening anything,
which control blocks it, and which metric shows it? Answer here: ...

## 6. ADRs to log (decision-log.md)
- Fixed graph vs agentic tool choice (D-010)
- Rules vs LLM for status (D-005)
- Reject requires human confirm? (O-1) · Sanctions reason disclosed? (O-2)
- Magic link token: expiry, single-use, reuse for resubmission, edited pre-fills (O-4)
- Contract before or after ERP creation (O-3)

## 7. Challenge pass
- [ ] Trace E2 and E4 end to end: neither reaches `approved` without a human
- [ ] No document text can change a status or call a tool
- [ ] Blind-click test answered
- [ ] Every LLM node has a failure behaviour that does not advance the case
