# Direction v2: "Quiet instrument, warm signal"

Stage 1 of the UI design pipeline. Handled by the `frontend-design` skill. Direction and references chosen by the user.

**Audience.** Salespeople bringing vendors in; procurement reviewers deciding who gets paid; Indian SME vendors filling a KYC-style form on a phone between other work; a Zamp interviewer watching it run.
**Purpose.** One product that carries a vendor from first call to approved, where every claim ("verified", "matches", "sent") is backed by visible evidence.
**Feeling.** Calm and expensive. Paper-white surfaces, warm greys, and a single orange that only appears where something needs a human.

## References → where each one lives
| Reference | What we take | Applied to |
|---|---|---|
| Zamp.ai | Editorial restraint, Geist, near-monochrome, confident whitespace | Landing page, global identity |
| Mercury | Trust-first forms: generous fields, quiet progress, reassurance copy | Vendor portal (magic-link form) |
| Attio | Record pages, crisp tables, activity timelines, property lists | Salesperson dashboard, vendor records, calls |
| Ramp | Status-dense queues, evidence rows, policy-style reasons | Verification report, review queue, emails |

**Own identity, not a collage:** one type system (Geist with Geist Mono for machine values, plus Instrument Serif used *only* for the landing headline and the vendor welcome) and one accent with one meaning: **orange = needs a human**. Success is a quiet green dot, never orange.

## Rejected
- **All-orange brand:** orange on every button stops meaning "attention" and fights the error red.
- **Dark dashboard:** it looks good in demos but tires reviewers who read evidence for hours, and it drifts from Zamp's paper feel.

## Four carrying choices
1. **Type.** Geist 400/500/600. Mono for GSTIN, PAN, IFSC, account numbers, refs, scores and timestamps. The serif appears twice in the product.
2. **Colour.** Warm neutrals (stone) do 95% of the work. Orange `#C2410C` only for: the primary action per screen, "needs a human" statuses, the live/attention indicator, and the email CTA. Green `#166534` for approved/passed dots. Red for rejected/failed.
3. **Density.** Two registers with a deliberate seam. The staff side is compact (Attio/Ramp rows at 44px). The vendor portal is roomy (Mercury fields at 40px, one section at a time).
4. **Shape.** 6px controls, 10px panels, 1px warm hairlines, no shadows except overlays, no gradients.
