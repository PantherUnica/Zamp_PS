# Six-minute demo script

## Before you record

- Run `npm run samples` and `npm run dev`. Optionally run `npm run test:e2e` so the dashboard shows all 15 cases.
- Sign in as an admin and, under **Team**, add a second account as **Reviewer**. You approve as the reviewer, since an owner can't approve their own vendor.
- Keep Gmail open. Test emails arrive at `you+caseNN@gmail.com`.

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Landing page | "From supplier call to verified partner. The agent extracts, verifies, flags and fixes; a person approves." |
| 0:20 | Sign in → Overview | "Mission control: the live pipeline, verification health, what the agent caught this week, and a scoreboard that rewards catching problems, never approvals." |
| 0:50 | Calls → Log a call → **Demo transcript** → Log call and analyse | "A call becomes vendor details with quotes, objections, coaching and a risk flag: she wants payments to a sister company." Apply → creates the vendor. |
| 1:30 | Calls → Log a call → **Hard test call** → Log call and analyse | "Hinglish, a corrected email, a misheard GSTIN, a relative's bank account, a cousin who says checks can be skipped, and a request to be marked pre-approved. All flagged; the rules catch the bad GSTIN check character and the PAN mismatch." |
| 2:10 | New vendor → Demo vendor: **Northwind** → Create and send link | Show the invitation arriving in Gmail. |
| 2:30 | Open link → **Fill demo details** → Submit | "No account. Autosaves. GSTIN, PAN and IFSC are checked as you type; the IFSC is looked up in RBI branch data." |
| 3:00 | Live run | "AI reads, rules decide, and every check shows where its evidence came from. Registry checks say *not connected*, never *passed*." |
| 3:30 | As the reviewer: Review queue → Northwind → Approve | "Even a clean case needs a person. Note, acknowledgements, audit trail." Confetti. |
| 4:00 | **Kestrel** (no cheque) | "Objective issue, so the request was emailed automatically." Show the email → open the link → attach the cheque → resubmit → v2 clears. |
| 4:40 | **Brightline** | "The cheque is in another company's name: that needs judgment. The agent drafted a correction; the salesperson edits and sends it." |
| 5:10 | **Saffron** and **Indus** | "Hidden text in a certificate told the AI to approve; it was flagged instead. A blurry PAN photo got a clearer copy requested." |
| 5:40 | Emails page, then Overview | "Every email has a status, an author and a retry. Every action is logged." |
