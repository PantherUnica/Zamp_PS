# Locked Decisions (seed for docs/pm/decision-log.md)

Decisions the builder made while designing this skill, or that the sources fix. Treat them as
defaults in every phase. Reopen one only if the user brings **new evidence** (not a new
preference). If you do reopen it, log a superseding entry instead of editing the old one.

| ID | Decision | Source | Status |
|----|----------|--------|--------|
| D-001 | **A human signs every approval.** The Decision Engine's best outcome is `ready_for_approval`; a person turns it into `approved`. Clean cases get a one-click lane with a pre-verified brief; risky cases get full review | Builder notes ("Nothing is auto approved... human in loop") + skill design session | Locked |
| D-002 | **Scope tiers with a Day-4 cut line.** MUST: core pipeline, resume loop, approval queue, E1-E4, live run view, dashboard, audit log, magic-link intake. SHOULD: bank-change watch. COULD: contract/NDA/MoU from template, override learning. COULD is cut automatically if any MUST is not green at the Day-4 checkpoint | Skill design session (challenge accepted) | Locked |
| D-003 | **Buyer = mid-size manufacturer** (~500-2,000 employees), suppliers across IN/US/DE/GB, with procurement, AP/finance and compliance teams, onboarding dozens of vendors a quarter | Skill design session | Locked |
| D-004 | Skill lives in `.claude/skills/ps2-vendor-onboarding-pm/`; deliverables go to `docs/pm/` in the project | Skill design session | Locked |
| D-005 | **AI reads and writes; plain code decides.** Only the Decision Engine sets status; LLM nodes add findings or draft text | Blueprint golden rule | Locked (invariant) |
| D-006 | **Intake via a sales-sent magic link**, not a cold public form. Sales triggers a personalised tokenised link once a vendor is agreed; known fields are pre-filled | Builder notes | Locked (token rules open, see O-4) |
| D-007 | Email uses a **free-tier** provider to a test inbox; drafts are always visible in the UI. **No LangSmith** | Builder notes | Locked |
| D-008 | UI: modern, Zamp-like. White cards, one red accent, timeline live run view, compact KPI tiles, following the builder's shipment-dashboard reference image | Builder notes + reference image | Locked |
| D-009 | Contract / NDA / MoU step: COULD tier, generated from a template after approval, no e-signature integration | Builder notes + D-002 | Locked (placement open, see O-3) |
| D-010 | **Fixed supervisor graph**, not free-roaming agents choosing tools | Blueprint Part 4 | Locked. Conflicts with the builder's earlier notes ("the LLM decides which tool to use"); the blueprint wins for demo determinism and explainability (G4, G6) |

## Open decisions the skill must raise (do not silently pick)

| ID | Question | Why it matters | Raise in |
|----|----------|----------------|----------|
| O-1 | Should `block` findings auto-reject, or go to `pending_reject` for a human to confirm? | D-001 covers approvals only. Fuzzy sanctions matches have high false-positive rates, and auto-rejecting a real vendor is a costly error | Phase 4 |
| O-2 | On a sanctions hit, does the rejection email state the reason? | Telling a sanctioned party why can tip them off; a generic notice plus an internal log may be safer | Phase 4 |
| O-3 | Does the contract/MoU have to be signed before the vendor is "ready-to-transact", or can the ERP record be created first? | It changes the end state of the graph and the cycle-time KPI | Phase 4 |
| O-4 | Magic link rules: expiry (days), single-use or re-usable for resubmission, bound to the vendor email? What if the vendor edits a pre-filled field? | E3 resubmission needs a way back in; an edited pre-fill (e.g. legal name) should become a finding | Phase 3/4 |
| O-5 | Reminder timing: day 3 / 7 / 14 (Part 6) vs "after 7 days: reminder, then escalate or close" (Part 3 step 9) | The blueprint contradicts itself; the X4 demo needs one answer | Phase 3 |
| O-6 | Sampling rate N for forcing a clean case into full review | An anti-rubber-stamp control; too low and nobody notices, too high and it kills throughput | Phase 4 |
| O-7 | Who may approve each lane? (Procurement alone for clean cases? Finance as second approver for bank changes and E2-type cases?) | Separation of duties; the strength of the approval story | Phase 4 |
