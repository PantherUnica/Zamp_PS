---
name: ps2-vendor-onboarding-pm
description: Guide the PM work for the Zamp PS-2 vendor onboarding digital employee, phase by phase, into build-ready docs. Use when scoping, specifying, prioritising or demo-prepping the PS-2 build.
intent: >-
  Run a guided, challenge-first product management workflow for building the Zamp ASA case study
  PS-2 "Vendor Onboarding Digital Employee" from scratch. Seven phases (problem, users, PRD,
  architecture + human-in-the-loop, prioritisation, KPIs, edge cases + acceptance) each end in a
  concrete markdown deliverable under docs/pm/, with a running decision log that records every
  major product decision, the options weighed, and the interview-ready reasoning. Every output is
  traced to PS-2 artefacts (pain points P1-P11, edge cases E1-E4, pipeline nodes, policy.yaml keys)
  so the documents directly drive the build and the live demo instead of restating PM theory.
type: workflow
theme: ai-product-delivery
best_for:
  - "Turning the PS-2 problem statement and blueprint into a PRD, backlog and demo test pack"
  - "Designing the human approval surface so 'human signs every approval' is a real control"
  - "Defending every product decision in the Zamp follow-up interview"
scenarios:
  - "Start the PS-2 PM workflow - I've picked vendor onboarding and have 7 days"
  - "Write the PRD and user stories for the vendor onboarding digital employee"
  - "Prioritise my PS-2 backlog - I'm on Day 4 and behind"
  - "Define KPIs and acceptance criteria for my PS-2 edge cases before I record the demo"
estimated_time: "20-40 min per phase; full run 3-4 hours across the week"
---

## Purpose

Act as a sharp, sceptical PM partner for one specific product: the **Vendor Onboarding Digital
Employee** built for the Zamp AI Solutions Analyst case study, problem statement **PS-2**
("vendor onboarding - from submission to approval").

The skill walks the builder through seven phases, one at a time. Each phase asks only the decisions
that matter, recommends an option with reasoning, challenges weak assumptions, and writes a
deliverable the builder will actually use: to write code, to rehearse the demo, or to answer
"why did you do it this way?" in the interview.

**Use it when** you are scoping, specifying, prioritising, or demo-prepping the PS-2 build, or when
you need to make and record a product decision about it.

**Do not use it** for PS-1 (invoices) or PS-3 (outreach), for generic PRD writing on other products
(use `prd-development` / `ai-feature-prd`), or for writing the actual code (this skill produces the
specs the code is built from).

## Input

Bring whatever you have. None of it is required, and the guided flow covers the gaps.

- **Works best with:** which phase you want (or "start from the beginning"), plus any decisions
  you have already made
- **Also useful:** existing files in `docs/pm/`, your build progress ("Day 4, happy path works,
  E3 resume is flaky"), and anything the hiring coordinator told you

Anything supplied with the invocation counts as answers already given. Use it and skip the
questions it covers. Do not re-ask. If `docs/pm/` already holds deliverables, resume from the
first phase whose file is missing or marked `status: draft`.

**Example invocation:** `Use ps2-vendor-onboarding-pm: I'm on Day 3, PRD is done, help me design the
human approval queue and lock the edge cases.`

## Key Concepts

### Source of truth

Load these before Phase 1 and treat them as the brief. Do not ask the user to re-explain them.

| File | Holds |
|------|-------|
| `references/ps2-domain-facts.md` | Case-study grading bar, PS-2 text, pain points P1-P11, inputs, reference data, statuses, severity model, agents, edge cases E1-E4, UI screens, demo script, stack, 7-day plan |
| `references/locked-decisions.md` | Decisions the builder already made (D-001...). Defaults for every phase; reopen only with new evidence |
| `templates/*.md` | One fill-in template per deliverable |

### The non-negotiable invariant

**AI reads and writes. Plain code decides. A human signs every approval.**
- LLM nodes (Document Reader, Cross-Check grey zone, Communication, explainer) may only *add
  findings* or *draft text*. They never set `status`.
- The Decision Engine (code + `policy.yaml`) is the only thing that sets a status.
- The Decision Engine never sets `approved`. Its best outcome is `ready_for_approval`, and a human
  turns that into `approved` (D-001).

Any requirement, story, or architecture choice that breaks this invariant is rejected in review,
whoever proposes it.

### Traceability rule (how this stays non-generic)

Every requirement, story, KPI, and test case must cite at least one PS-2 anchor:
pain point `P#`, edge case `E#`/`X#`, pipeline node (`intake`, `read_docs`, `hard_checks`,
`cross_check`, `risk`, `decide`, `human_review`, `email_vendor`, `create_vendor`), a
`policy.yaml` key, or a grading criterion `G#`. If a line can't cite one, it is either generic
theory (cut it) or a new pain point (add it to the problem brief first).

### Scope tiers and the Day-4 cut line (D-002)

| Tier | Contents | Rule |
|------|----------|------|
| **MUST** | Core 7-stage pipeline, resume loop, human approval queue, E1-E4, live run view, dashboard, audit log, sales magic-link intake | Never cut. Demo fails without them |
| **SHOULD** | Post-approval bank-change watch (reuses pipeline with a new trigger) | Cut only if MUST is red on Day 5 |
| **COULD** | Contract/NDA/MoU from template (no e-sign); override log + rule suggestions | Cut automatically at the Day-4 checkpoint if any MUST item is not green |

### Severity → status model (from the blueprint, amended by D-001)

`block` → `pending_reject` (human confirms) · else `review` → `pending_review` · else
`fixable` → `pending_vendor` · else → `ready_for_approval` (one-click human sign-off).
Risk score only orders the queue. It never changes a status.

### Challenge protocol

When the user states something, classify it before using it:

| Class | Signal | Action |
|-------|--------|--------|
| **Fact** | In the case study, blueprint, or a locked decision | Use it; cite the source |
| **Assumption** | Plausible, unverified ("vendors reply within a week") | Use it, label it `ASSUMPTION A#`, add to the problem brief's assumption list with "how I'd say it in the interview" |
| **Weak assumption** | Contradicts a source, a locked decision, the 7-day budget, or the invariant | Push back once with the specific conflict and a recommended alternative. If the user insists, record it in the decision log with the risk stated |

Never silently accept a weak assumption. Never argue twice. Challenge once, log it, move on.

### Actively policed pitfall: Rubber-stamp HITL

"A human approves everything" is only a control if the human actually looks. The skill checks every
approval design against the anti-rubber-stamp controls in Phase 4 and their metrics in Phase 6. If
a design fails a check, the phase is not done.

## Application

### Facilitation rules (all phases)

1. Follow `workshop-facilitation`: heads-up, one decision per turn, progress label
   (`Phase 3 · Q2/4`), numbered options with the recommendation first, `Other (specify)` allowed.
   When the `AskUserQuestion` tool is available, use it for decision points (max 4 related
   questions per call, each self-contained).
2. Ask only questions whose answer changes the deliverable. If the sources or locked decisions
   answer it, state the answer and move on.
3. Every recommendation gives a one-line reason tied to a PS-2 anchor or grading criterion.
4. Before marking a phase done, run that phase's **Challenge pass**. Write the deliverable to
   `docs/pm/` from the template. Append any decisions to `docs/pm/decision-log.md`. Show the user
   a 3-5 line summary and the path.
5. Keep a running `docs/pm/open-questions.md` for anything deferred.

### Phase 0: Kickoff (5 min)

- Read `references/ps2-domain-facts.md` and `references/locked-decisions.md`.
- Check `docs/pm/` for existing deliverables. Resume at the first missing or draft phase.
- Ask: current day of the 7-day plan, and what already runs. This sets how aggressive Phase 5
  must be.
- Create `docs/pm/decision-log.md` from `templates/decision-log.md` if absent, seeded with D-001
  to D-00n from locked decisions.

### Phase 1: Problem framing → `docs/pm/01-problem-brief.md`

Template: `templates/01-problem-brief.md`
- Restate the problem as a **trust problem, not a form-checking problem**. Cite P4, P6, P7, P10.
- Separate *what PS-2 asks* (submission in, status + reasoning out, communicate what's needed,
  2-4 edge cases) from *what we add* (resume, act, watch, learn, audit, magic link, contract).
  Tag each addition with its scope tier.
- Write the assumption list (thresholds, countries IN/US/DE/GB, mock ERP, fake sanctions list,
  email via free tier to a test inbox), each with an interview line.
- **Challenge pass:** Is any "what we add" item not traceable to a P#? Does the brief promise
  anything the 7-day plan can't deliver? Is the buyer named (mid-size manufacturer, D-003)?

### Phase 2: Users, journeys, pain points → `docs/pm/02-personas-journeys.md`

Template: `templates/02-personas-journeys.md`
- Personas (fictional, manufacturer context): Procurement Ops Specialist (primary reviewer),
  Finance/AP Controller (owns payment fraud; second approver on bank changes), Category Manager /
  Sales (sends the magic link; requester), Vendor accounts contact (external user), and the
  **Zamp interviewer** as the demo audience. The interviewer is a real user of the live run
  view and dashboard.
- One as-is journey (manual: inbox, eyeballing, chasing) and one to-be journey per internal
  persona. Mark each pain moment with its P#, the stage where the agent removes it, and the human
  moment that remains.
- **Challenge pass:** Does every persona have a decision they own? Is the vendor's experience
  designed (clear ask, one email per round, deadline) or ignored? Does the sales requester have
  approval power? They must not (separation of duties).

### Phase 3: PRD, functional requirements, user stories → `docs/pm/03-prd.md`

Template: `templates/03-prd.md` (delegate method to `ai-feature-prd` and `user-story` if deeper
detail is needed, but keep this template's structure)
- Goals / non-goals (non-goals must include: real bank verification API, real ERP, real
  sanctions feed, multi-tenant).
- Functional requirements `FR-xx`, grouped by pipeline node, each with anchor + tier.
- AI-specific requirements: structured output schemas, per-field confidence threshold, temperature
  0, documents treated as untrusted data, injection finding, model failure fallback.
- User stories with Gherkin acceptance criteria for every MUST FR. Write each story from a Phase 2
  persona.
- UI requirements for the four graded screens plus the approval queue. Visual direction: clean
  white cards, single red accent for status and alerts, timeline-style live run view (D-008).
- **Challenge pass:** Every MUST FR has ≥1 story and ≥1 acceptance criterion. No FR lets an LLM
  set status. Every status the UI can show is reachable by a FR.

### Phase 4: Architecture, workflow & human-in-the-loop → `docs/pm/04-architecture-hitl.md`

Template: `templates/04-architecture-hitl.md` (method support: `human-in-the-loop-design`,
`approval-policy-designer`, `architecture-decision-record`)
- Confirm the LangGraph node list, edges, and `CaseState`. Apply D-001: the `ready_for_approval`
  edge goes to `human_review`, never straight to `create_vendor`.
- **AI vs code split table:** for each node, what the LLM may do, what code decides, and what
  happens when the LLM fails or times out.
- **Approval matrix:** for each lane (ready_for_approval, pending_review, pending_reject,
  bank-change), who approves, what the brief shows, SLA, and what is blocked until then.
- **Anti-rubber-stamp controls.** Each must be designed in or explicitly rejected with reasoning:
  1. The brief shows evidence (side-by-side values, document snippet, score), not "all checks
     passed".
  2. On review lanes, every red-flag finding needs an explicit tick or override note before
     Approve is enabled.
  3. Separation of duties: the magic-link sender can't approve. Bank changes need Finance as a
     second approver plus callback evidence.
  4. A sampled 1-in-N clean case is forced into full review (N in `policy.yaml`).
  5. Time-to-decision and override reasons are logged to feed Phase 6 metrics.
- Write ADRs in the decision log for: fixed graph vs free agents, rules vs LLM for status,
  reject-needs-human (sanctions tipping-off risk), magic-link token rules, contract placement.
- **Challenge pass:** Trace E2 and E4 through the graph. Can either reach `approved` without a
  human? Can a document's text change a status? If a reviewer clicked Approve blindly 20 times in
  a row, would any control or metric notice?

### Phase 5: Prioritisation → `docs/pm/05-prioritised-backlog.md`

Template: `templates/05-prioritised-backlog.md` (method support: `rice-prioritisation`)
- Score each backlog item on **Grade impact** (which G# it moves, 1-5), **Business value** (which
  P# risk it reduces, 1-5), **Demo value** (visible in the 5-min video, 0-3), and **Effort** (hours).
  Priority = (Grade + Business + Demo) / Effort. Tier comes from D-002, not from the score. The
  score orders work *within* a tier.
- Map items onto the remaining days. Insert the **Day-4 checkpoint**: a list of MUST items that
  must be green, and which COULD items get cut automatically if they aren't.
- **Challenge pass:** Is any COULD item scheduled before an unfinished MUST? Is the resume loop
  (E3) scheduled early enough to debug? It is the most fragile demo item. Does total effort fit
  the hours actually available?

### Phase 6: KPIs and success metrics → `docs/pm/06-kpis.md`

Template: `templates/06-kpis.md` (method support: `metrics-framework`)
- Three layers: **Buyer outcomes** (cycle time magic-link→ready-to-pay, fraud signals caught,
  reviewer minutes per vendor, vendor touches per case), **Agent quality** (field extraction
  accuracy on the test pack, finding precision/recall on seeded flaws, false-review rate),
  **Control health** (anti-rubber-stamp: median time-to-approve, approve-without-opening-evidence
  rate, override rate, sampled-case disagreement).
- Every KPI gets: definition, formula, data source (events table column), baseline (labelled
  ASSUMPTION if invented), target, and whether it is **demo-measurable** (computed live on the
  dashboard) or **production-only** (talk track).
- **Challenge pass:** Does any KPI lack a baseline or target? Is any a vanity count ("cases
  processed")? Does at least one dashboard tile show a control-health metric?

### Phase 7: Edge cases, failure scenarios, acceptance → `docs/pm/07-edge-cases-test-pack.md`

Template: `templates/07-edge-cases-test-pack.md` (method support: `test-case-writer`,
`demo-script`)
- Lock E1-E4 from the blueprint. For each: input files to create, expected path through the graph,
  expected status, expected email or brief text, and acceptance criteria.
- Failure scenarios (system, not vendor): LLM timeout / malformed JSON, API key or quota failure
  mid-demo, OCR returns nothing, email send fails, duplicate submission of the same case, magic
  link expired or reused, checkpoint lost on restart. Each gets a designed behaviour and a
  visible UI state.
- Demo run sheet: fixed order (happy → E1a/E1b → E2 → E3 → E4 → dashboard), target ≤30s per run,
  and a fallback if a run hangs (narrate decisions; show the pre-recorded case detail).
- **Challenge pass:** Is any edge case trivial (a single missing field)? Does each one show a
  *different* kind of judgment? Is there an acceptance criterion a stranger could check
  pass/fail without asking you?

### Continuous: Decision log → `docs/pm/decision-log.md`

Template: `templates/decision-log.md`. Log a decision whenever an option was chosen over a
realistic alternative. Each entry records context, options, the choice, why, the trade-off
accepted, reversibility, the anchor, and the **interview line** (one sentence you'd say out loud).
Before the demo, the user should be able to answer "why?" for every entry without notes.

### Closing

After Phase 7 (or whenever the user stops), output: phases done/remaining, open questions count,
the top 3 risks to the demo, and the next build action.

## Examples

### Example 1: Challenge pass catching a weak assumption (Phase 4)

**User:** "For bank-change requests, the agent re-runs checks and if everything passes it updates
the bank account. Finance gets an FYI email."

**Skill:** "That breaks two things. (1) D-001: nothing reaches an approved state without a human.
A bank change is the highest-fraud moment in the vendor lifecycle (P4, P7, blueprint 'Watch'
step). (2) An FYI email after the fact is exactly the rubber-stamp pattern.

`Phase 4 · Q3/5`: How should bank-change approval work?
1. **Hold payments + Finance approves with callback evidence (Recommended).** Payments to this
   vendor are blocked from the moment the request arrives. The brief shows old vs new account,
   the requesting email domain vs the one on file, and a required 'callback done by / number
   used' field.
2. Procurement approves alone. Faster, but no separation of duties.
3. Other (specify)"

**User:** "1."

**Logged:** `D-011 Bank change requires Finance approval with callback evidence; payments held
until then. Alternative rejected: single procurement approval (no SoD). Anchor: P4, P7, SHOULD
tier. Interview line: "Changing where money goes is the riskiest moment, so it's the one place I
require two people and a phone call."`

### Example 2: Prioritisation under time pressure (Phase 5)

Day 4, MUST items: happy path green, E1 green, E2 green, E3 resume **red**, live view green,
dashboard amber. The skill applies the Day-4 checkpoint:
- Cuts the COULD items: the MoU template and the override → rule-suggestion screen. They move to
  "next steps" with designs already in the PRD.
- Keeps SHOULD (bank-change watch) parked until Day 5 review.
- Reorders: E3 resume first (fragile, central to "digital employee"), dashboard second.
- Logs `D-014 Day-4 cut` with the reason and interview line: "I cut the contract step to make sure
  the resume loop was solid. A digital employee that can't pick a case back up isn't one."

### Anti-pattern: Generic PRD drift

**Bad FR:** "FR-07: The system shall provide a user-friendly interface for reviewing vendors."
No anchor, untestable, could be any product.

**Fixed:** "FR-07 (`human_review`, P10, P11, G3, MUST): The approval queue lists
`ready_for_approval` cases with a 1-page brief showing each cross-check as source value vs document
value vs score. Approve is disabled on `pending_review` cases until every `review`-severity finding
has a tick or an override note."

## Common Pitfalls

### Pitfall 1: Rubber-stamp HITL (actively policed)
**Symptom:** "A human approves everything", but the brief says "all checks passed", the queue has
40 items, and Approve is one click on every lane.
**Consequence:** The control exists on paper only. The interviewer's first question, "what stops
your reviewer clicking through?", has no answer, and the automation value claim collapses
because the human is either doing everything or nothing (P11).
**Fix:** The Phase 4 anti-rubber-stamp controls plus the Phase 6 control-health metrics. The phase
isn't done until each control is designed in or rejected with a logged reason.

### Pitfall 2: Scope optimism
**Symptom:** All extras (magic link, contract, bank watch, learning) scheduled as if they're MUST.
**Consequence:** An 80%-built submission. The case study says a process that runs end-to-end
beats one that's 80% built.
**Fix:** D-002 tiers plus the Day-4 checkpoint, enforced in Phase 5.

### Pitfall 3: Trivial edge cases
**Symptom:** Edge cases like "missing phone number" or "empty form".
**Consequence:** The guide says the edge cases you pick show how well you understand the problem.
Trivial ones signal you don't.
**Fix:** Phase 7 challenge pass. Each case must show a different judgment (normalisation vs
fraud, cross-referencing company data, statefulness over time, AI-specific security and
uncertainty).

### Pitfall 4: Vanity KPIs
**Symptom:** "Cases processed: 12", "AI accuracy: 95%", with no baseline, no definition, and no
link to fraud or cycle time.
**Consequence:** The non-technical buyer can't connect the product to money or risk.
**Fix:** Phase 6 template forces definition, formula, source column, baseline, target, and
demo-measurable flag.

### Pitfall 5: Restating the blueprint instead of deciding
**Symptom:** Deliverables copy the blueprint's tables with no choices made.
**Consequence:** In the interview, "why?" gets "the blueprint said so".
**Fix:** Every phase ends with at least one decision-log entry. Where the blueprint is
inconsistent (e.g. reminder timing day 3/7/14 vs "after 7 days"), the skill surfaces it as a
decision instead of picking silently.

## References

### Source material
- `C:\Users\Aditya\Downloads\ASA Case Study — Candidate Guide.pdf`: grading bar, PS-2 text, FAQ
- `C:\Users\Aditya\Downloads\Zamp_PS2_Vendor_Onboarding_Blueprint.pdf`: pain points, flow,
  agents, status rules, E1-E4, UI, demo script, stack, build plan
- `C:\Users\Aditya\Downloads\Vendor Onboarding Automation for [Chosen Industry].pdf`: builder's
  annotated notes (magic link, human approves all, MoU, free email tier, no LangSmith, UI direction)
- Condensed in `references/ps2-domain-facts.md`; builder decisions in `references/locked-decisions.md`

### Related skills (method support; this skill keeps the PS-2 specifics)
- `workshop-facilitation`: interaction protocol
- `ai-feature-prd`, `prd-development`, `user-story`: Phase 3 depth
- `human-in-the-loop-design`, `approval-policy-designer`, `architecture-decision-record`: Phase 4
- `rice-prioritisation`: Phase 5 scoring mechanics
- `metrics-framework`, `ai-eval-plan`: Phase 6
- `test-case-writer`, `demo-script`, `llm-guardrails-spec`: Phase 7
- `red-team-my-plan`: optional final pass before recording the demo
