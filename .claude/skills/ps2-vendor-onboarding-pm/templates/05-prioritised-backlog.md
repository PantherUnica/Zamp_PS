---
deliverable: 05-prioritised-backlog
status: draft
updated: YYYY-MM-DD
---

# Prioritised Backlog and Build Plan

Current day: [D?] · Hours available until Day 7 submission: [h] · Already green: [...]

## 1. Scoring rules
- **Grade impact (1-5):** how much it moves G1-G6. 5 = demo fails without it
- **Business value (1-5):** how much buyer risk/cost it removes (P#). 5 = stops payment fraud
- **Demo value (0-3):** visible and explainable in the 5-min video
- **Effort (h):** honest build + test hours, including debugging
- **Priority = (Grade + Business + Demo) / Effort**
- **Tier (D-002) beats score.** No COULD starts while a MUST is red. Score orders work within a tier.

## 2. Backlog

| # | Item | Tier | Anchors | Grade | Business | Demo | Effort (h) | Priority | Planned day | Status |
|---|------|------|---------|-------|----------|------|------------|----------|-------------|--------|
| 1 | Reference data + test pack (docs, vendor_master, sanctions, country_rules, policy.yaml) | MUST | G1, G2 | 5 | 3 | 1 | | | D2 | |
| 2 | Hard-check validators + unit tests | MUST | P5 | | | | | | D2 | |
| 3 | Document Reader (structured output, confidence, injection flag) | MUST | P2, P3, E4 | | | | | | D3 | |
| 4 | Cross-check + suffix normaliser + grey-zone opinion | MUST | P4, E1 | | | | | | D3 | |
| 5 | Risk & duplicate tools | MUST | P7, E2 | | | | | | D3 | |
| 6 | Graph wiring, Decision Engine, audit, checkpointer | MUST | G1, P9 | | | | | | D4 | |
| 7 | Resume loop (E3) | MUST | P8, E3 | | | | | | D4 | |
| 8 | Approval queue + anti-rubber-stamp controls | MUST | D-001, P11 | | | | | | D4-5 | |
| 9 | Magic-link invite | MUST | D-006, P1 | | | | | | D5 | |
| 10 | Live run view (streaming timeline) | MUST | G3 | | | | | | D5 | |
| 11 | Case detail + dashboard | MUST | G3 | | | | | | D5 | |
| 12 | Email via free tier (D-007) | MUST | P8 | | | | | | D5 | |
| 13 | Bank-change watch | SHOULD | X1, P4 | | | | | | D6 | |
| 14 | Contract/NDA/MoU from template | COULD | D-009 | | | | | | D6 | |
| 15 | Override log + rule suggestions | COULD | P11 | | | | | | D6 | |
| 16 | Rehearse demo ×2, record video | MUST | G6 | | | | | | D6-7 | |

## 3. Day-4 checkpoint (end of Day 4)
Must be green: #1-#7. If any is not green:
- [ ] Cut #14 and #15 (move them to "next steps" talk track with PRD designs)
- [ ] Re-plan #13 to "Day 5 review: build only if #8-#12 are green by noon"
- [ ] Log D-0xx "Day-4 cut" with an interview line

## 4. Day-6 freeze
No new features after Day 6 midday. Only fixes, rehearsal, recording.

## 5. Challenge pass
- [ ] Total MUST effort ≤ 80% of available hours (buffer for debugging)
- [ ] E3 resume scheduled no later than Day 4 (most fragile demo item)
- [ ] No COULD item before an unfinished MUST
- [ ] Every item has an anchor
