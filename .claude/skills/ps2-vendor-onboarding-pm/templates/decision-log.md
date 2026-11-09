---
deliverable: decision-log
updated: YYYY-MM-DD
---

# Decision Log: PS-2 Vendor Onboarding Digital Employee

Seeded from `references/locked-decisions.md` (D-001 to D-010). Append new entries; never
edit old ones. Supersede them instead ("Supersedes D-0xx").

## Index

| ID | Date | Decision (one line) | Phase | Reversible? | Status |
|----|------|---------------------|-------|-------------|--------|
| D-001 | | Human signs every approval | design | Costly | Locked |

## Entry format

```
### D-0xx: [short title]
- Date: YYYY-MM-DD · Phase: [1-7] · Anchor: [P#/E#/G#/FR#/O#]
- Context: [what forced the decision, 1-2 lines]
- Options considered:
  1. [option] (pro / con)
  2. [option] (pro / con)
  3. [option] (pro / con)
- Chosen: [n], because [reason tied to anchor]
- Trade-off accepted: [what we give up]
- Reversibility: [cheap config change / moderate refactor / costly]
- Evidence vs assumption: [fact source, or ASSUMPTION A-xx]
- Interview line: "[one sentence you'd say out loud]"
```

## Example entry

### D-012: Rejections also need a human (resolves O-1)
- Date: YYYY-MM-DD · Phase: 4 · Anchor: O-1, P10, E2 variant, D-001
- Context: the blueprint auto-rejects on `block`. Fuzzy sanctions matches create false positives,
  and rejecting a legitimate supplier costs a relationship.
- Options considered:
  1. Auto-reject on any `block` (fast, consistent / false-positive rejections, harsh vendor experience)
  2. `pending_reject` + human confirms (catches false positives / one more queue)
  3. Auto-reject only exact sanctions matches; fuzzy matches go to review (precise / more rules to explain)
- Chosen: 2, because D-001 already puts a human on the approval side, and symmetric control
  is easier to explain (G5). The queue is small, since blocks are rare.
- Trade-off accepted: a few hours' delay on true rejections.
- Reversibility: cheap (one routing rule in policy.yaml).
- Evidence vs assumption: ASSUMPTION A-07 (sanctions fuzzy-match false-positive rate is material).
- Interview line: "The system can stop a vendor instantly, but a person decides whether to turn
  them away, because a false match on a sanctions list shouldn't cost us a real supplier."
