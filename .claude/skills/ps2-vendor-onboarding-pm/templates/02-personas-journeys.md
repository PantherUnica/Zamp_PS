---
deliverable: 02-personas-journeys
status: draft
updated: YYYY-MM-DD
---

# Personas, Journeys and Pain Points

All people are fictional. Context: mid-size manufacturer (D-003).

## 1. Personas

| Persona | Role in PS-2 | Owns which decision | Top pain (P#) | What they need from the product | Must NOT be able to |
|---------|--------------|---------------------|---------------|----------------------------------|---------------------|
| Procurement Ops Specialist | Primary reviewer, runs the approval queue | Approve / reject / ask vendor on normal lanes | P1, P8, P11 | A brief they can trust in 30s; only real problems escalated | Approve a case they requested |
| Finance / AP Controller | Owns payment fraud risk | Second approval on bank changes and shared-account cases (O-7) | P4, P7 | Payments held until verified; callback evidence | Be bypassed on a bank change |
| Category Manager / Sales | Requester; sends the magic link (D-006) | Which vendor gets invited | P1 | Know where their vendor is stuck | Approve their own vendor (SoD) |
| Vendor accounts contact | External submitter | What to upload and fix | P1, P2, P8 | One clear ask per round, a deadline, no re-asking for done items | See internal risk reasoning |
| Compliance Officer (optional) | Sanctions / high-risk countries | Confirm `pending_reject` on sanctions hits (O-1) | P10 | Evidence of the match, and no tip-off to the vendor (O-2) | |
| **Zamp interviewer** | Demo audience; uses the live view + dashboard | Whether the build moves forward | G1-G6 | See each stage run; understand every "why" | Be shown a mockup |

## 2. As-is journey (manual)

| Stage | Who | What happens | Time / effort (ASSUMPTION) | Pain (P#) | Emotion |
|-------|-----|--------------|----------------------------|-----------|---------|
| Request | Sales | Emails procurement "please onboard X" | | P9 | |
| Collect | Procurement | Sends form, waits | | P1, P8 | |
| Check | Procurement | Opens each PDF, eyeballs names/numbers | | P2-P6 | |
| Chase | Procurement | Emails vendor about gaps, waits, re-checks everything | | P8 | |
| Risk | Procurement/Finance | Maybe checks duplicates in a spreadsheet | | P7 | |
| Create | Procurement | Types vendor into ERP | | P9 | |

## 3. To-be journey (with the digital employee)

| Stage | Agent does (node) | Human moment that remains | Pain removed | Visible in UI (screen) |
|-------|-------------------|---------------------------|--------------|------------------------|
| Invite | Magic link generated, fields pre-filled | Sales clicks "Invite" | P1 | New case |
| Submit + read | `intake`, `read_docs` | none | P1, P2, P3 | Live run view |
| Verify | `hard_checks`, `cross_check`, `risk` | none | P4-P7, P10 | Live run view |
| Decide | `decide` (code) | none | P9 | Case detail |
| Ask vendor | `email_vendor`, wait/resume | Vendor fixes the item | P8 | Case detail, dashboard aging |
| Approve | `human_review` (D-001) | Reviewer signs (1-click or full review) | P11 | Approval queue |
| Create | `create_vendor` | none | P9 | Case detail |

## 4. Pain-point heat map
P# × persona grid. Mark H/M/L, and mark the stage that resolves each one.

## 5. Challenge pass
- [ ] Every persona owns a decision or is explicitly an observer
- [ ] Vendor experience designed: one consolidated ask per round, deadline, no re-asking fixed items (E3)
- [ ] Separation of duties stated: requester ≠ approver; bank change = 2 people
- [ ] Every remaining human moment justified (why a human, not code)
