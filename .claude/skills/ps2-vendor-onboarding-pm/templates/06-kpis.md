---
deliverable: 06-kpis
status: draft
updated: YYYY-MM-DD
---

# KPIs and Success Metrics

**North-star (buyer):** median time from magic-link sent to vendor `approved` and ready to pay,
with zero fraud-seeded cases approved.

Rules: every KPI has a definition, a formula, a source column in `events` / `cases`, a baseline
(label ASSUMPTION if invented), a target, and a flag saying whether it's computed live on the
dashboard (**Demo**) or only a talk track (**Prod**).

## 1. Buyer outcomes

| ID | KPI | Formula | Source | Baseline | Target | Demo/Prod | Anchor |
|----|-----|---------|--------|----------|--------|-----------|--------|
| K-01 | Onboarding cycle time | median(approved_ts − invited_ts) | cases | [e.g. 10 days, ASSUMPTION] | [e.g. ≤2 days] | Demo (simulated clock) + Prod | P8 |
| K-02 | Vendor touches per case | count(outbound emails) / case | events | [3-4, ASSUMPTION] | ≤1.5 | Demo | P1, P8 |
| K-03 | Reviewer minutes per vendor | sum(decision_ts − opened_ts) / case | approvals | [45 min, ASSUMPTION] | ≤5 (one-click) / ≤15 (full) | Demo | P11 |
| K-04 | First-pass completeness | cases with 0 `fixable` findings in round 1 / all | findings | | | Demo | P1, D-006 |

## 2. Agent quality (on the seeded test pack)

| ID | KPI | Formula | Source | Target | Demo/Prod | Anchor |
|----|-----|---------|--------|--------|-----------|--------|
| K-05 | Field extraction accuracy | correct fields / labelled fields | test pack labels | ≥95% clean, flagged (not guessed) on scans | Demo | P3 |
| K-06 | Fraud-signal recall | seeded flaws caught / seeded flaws | test pack | 100% of E1b, E2, E4 | Demo | P4, P7, P10 |
| K-07 | False-review rate | clean cases sent to `pending_review` / clean cases | cases | ≤10% | Demo | P11 |
| K-08 | Unsafe-guess rate | low-confidence fields used in a pass decision | findings | 0 | Demo | E4 |

## 3. Control health (anti-rubber-stamp, required)

| ID | KPI | Formula | Source | Alert when | Demo/Prod | Anchor |
|----|-----|---------|--------|------------|-----------|--------|
| K-09 | Median time-to-approve, one-click lane | median(decision − opened) | approvals | < [10s] (too fast to have read) | Demo tile | D-001 |
| K-10 | Approve-without-evidence-opened rate | approvals with evidence_opened=false / approvals | approvals | > 0 on review lanes | Demo tile | C1, C5 |
| K-11 | Override rate + top reasons | overrides / decisions | approvals | Rising trend → policy review | Demo | P11, FR-21 |
| K-12 | Sampled-case disagreement | sampled full reviews that disagree with one-click verdict / samples | approvals | > 0 → investigate rules | Prod | C4 |

## 4. Dashboard tiles (from 03 §7)
Pick ≤6: [K-01, K-03, K-06, K-09, waiting-on-vendor aging, review queue size]. At least one
control-health tile is required.

## 5. Challenge pass
- [ ] No vanity counts ("cases processed") without a ratio or target
- [ ] Every baseline labelled ASSUMPTION or sourced
- [ ] ≥1 control-health KPI is on the dashboard
- [ ] Each KPI traces to a goal in 03 §2
