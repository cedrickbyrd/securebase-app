# Customer Validation Interview Script
## Texas Money Transmitter License Holders — Fintech Pro Beta

**Purpose:** Validate demand for Texas DOB compliance automation before building.  
**Target:** 10 interviews — 5 current SecureBase customers (upgrade path) + 5 prospects  
**Duration:** 30 minutes per interview  
**Goal:** 6+ strong-interest responses at $5,000/month beta pricing = **GO decision**

---

## Pre-Interview Qualification Checklist

Before scheduling, confirm the prospect meets ALL criteria:

- [ ] Holds an active Texas Money Transmitter License (NMLS or TX DOB)
- [ ] Processes >$1M/month in transaction volume
- [ ] Has experienced at least one Texas DOB examination in the last 3 years
- [ ] Annual compliance budget > $150,000

**Sources for prospect lists:**
- NMLS Consumer Access (public MT licensee database)
- Texas DOB Licensed Entity Search: `https://www.dob.texas.gov`
- LinkedIn: search "Compliance Officer" + "money transmitter" + "Texas"
- Industry events: Texas FinTech Association, Dallas Fintech Summit

---

## Interview Guide

### 0. Introduction (2 minutes)

*"Hi [Name], thanks for taking the time. I'm [Your Name] from SecureBase. We're a compliance
automation platform and we're exploring a new product specifically for Texas money transmitters.
I'm doing customer research — I'm not here to sell you anything today. I want to understand your
experience with Texas DOB examinations. Is it okay if I take notes?"*

---

### 1. Warm-Up: Their Compliance World (5 minutes)

1. "Tell me about your role — how much of your time is spent on regulatory compliance?"
2. "How many people on your team work on compliance full-time?"
3. "Which regulators do you interact with most frequently?" *(Probe: Texas DOB, FinCEN, CFPB)*
4. "When was your last Texas DOB examination?"

**Listen for:** Size of compliance team, frequency of exams, tone (stressed vs. routine).

---

### 2. Pain Discovery: Exam Preparation (10 minutes)

5. "Walk me through what happens when the DOB notifies you of an upcoming exam. What's the first
   thing you do?"

6. "What takes the most time to prepare?"
   *(Probe: transaction records, CTR/SAR evidence, CIP files, digital asset records)*

7. "How do you currently pull together transaction records for the examiner?
   Do you export from your core banking system? How long does that take?"

8. **Key question:** "If I asked you to show me 5 years of transaction records for all transactions
   over $3,000 right now — how long would that take, and who does it?"

9. "Have you ever had a DOB examiner issue an MRA (Matter Requiring Attention) related to
   recordkeeping or AML evidence? What happened?"

10. "What's the most stressful part of a DOB exam?"

**Listen for:** Pain quotes. Note exact words — "we pulled all-nighters", "two weeks of chaos",
"our compliance person quit after the last exam". These are gold.

**Red flags (disqualify):** Prospect has an in-house compliance system that automates all of this.

---

### 3. Current Solutions (5 minutes)

11. "What tools do you currently use to manage compliance? Any software?"
    *(Probe: Vanta, Drata, manual spreadsheets, law firms, outsourced)*

12. "How much do you spend per year on compliance tools and outside counsel?"

13. "Does your current setup produce audit-ready evidence automatically, or do you compile it manually?"

14. "Have you ever wished there was a system that automatically collected and organized your
    DOB exam evidence throughout the year, not just when the exam is coming?"

---

### 4. Solution Validation (5 minutes)

*[Only if they've confirmed significant pain]*

*"I want to describe a concept and get your reaction. We're building a system that:*
- *Connects to your transaction database (read-only) and automatically organizes 5 years of records*
- *Pulls your CTR and SAR filings from your AML system (Unit21, Sardine, etc.)*
- *Tracks your CIP/KYC records and flags gaps before the examiner does*
- *Generates a secure, signed evidence package in minutes that you can hand to the examiner*

*The whole point is: instead of spending 200 hours preparing for each exam, you just click a button."*

15. "How does that sound? Does that describe something you wish you had?"

16. "What's missing from what I described? What would make it more valuable?"

17. "If this existed today, who in your organization would champion it?"

18. **Pricing validation:** "For a product like this — if it saved you 200 hours of exam prep and
    reduced your outside counsel spend on compliance — what would be a fair monthly subscription?
    *(Pause — let them answer first)*
    We're thinking around $5,000/month for an early access program. What's your reaction?"

**Listen for:**
- "That's reasonable" / "That's a no-brainer" = Strong signal
- "That's expensive but I can see the ROI" = Moderate signal
- "We'd never pay that" = Disqualify or probe budget

---

### 5. Wrap-Up (3 minutes)

19. "We're doing a private beta with 3 design partners starting in 8 weeks. Design partners get
    the product at $5,000/month (locked for 12 months) and direct input into features. Is that
    something you'd want to be considered for?"

20. "Is there anyone else you know in the Texas MT space who deals with these DOB exam headaches?
    Could you introduce me?"

---

## Scoring Rubric

Rate each interview on a scale of 1–3 for each dimension:

| Dimension | 1 (Weak) | 2 (Moderate) | 3 (Strong) |
|---|---|---|---|
| Pain severity | "It's a bit annoying" | "It takes a week" | "It's a nightmare / all-nighters" |
| Current spend | <$50K/year | $50K–$150K/year | >$150K/year |
| Pricing reaction | "Too expensive" | "Might work with ROI" | "That's reasonable / obvious yes" |
| Beta interest | "Maybe later" | "Interested, need to check budget" | "Yes, send me the agreement" |
| Referral offer | Declined | "I'll think about it" | Named 2+ contacts immediately |

**Score 10–15:** Strong signal — add to beta shortlist  
**Score 6–9:** Moderate signal — re-interview after product demo  
**Score <6:** Disqualify  

---

## Decision Framework

After 10 interviews, tally:

| Metric | Target | Proceed to Build? |
|---|---|---|
| Interviews with score ≥10 | ≥ 6 | ✅ GO |
| Average current compliance spend | > $150K/year | ✅ GO |
| Strong "transaction evidence" pain | ≥ 6 mentions | ✅ GO |
| Beta commitments at $5K/mo | ≥ 3 | ✅ GO |

If ALL 4 met → Start 8-week MVP build immediately.  
If 2–3 met → Refine positioning and conduct 5 more interviews.  
If 0–1 met → Pivot away from Texas MT focus; stay SOC2.

---

## Outreach Templates

### Email — Current SecureBase Customer

> Subject: Quick question about your Texas DOB exams
>
> Hi [Name],
>
> We're exploring a new compliance feature specifically for Texas money transmitters, and I'd love
> to get your perspective.
>
> Could you spare 30 minutes this week to answer a few questions about how you currently prepare
> for Texas DOB examinations? Your insights would directly shape what we build.
>
> Happy to buy you a coffee or send a $100 Amazon gift card for your time.
>
> [Calendar link]

### Email — NMLS Prospect

> Subject: Texas DOB exam prep — quick research call?
>
> Hi [Name],
>
> I'm [Name] from SecureBase. I found your company on the Texas DOB licensed entity list.
>
> We're building compliance automation specifically for Texas money transmitters, and I'm doing
> research with 10 licensed MTs this week. 30-minute call, no sales pitch.
>
> We'll send a $100 Amazon gift card for your time regardless of outcome.
>
> Interested? [Calendar link]

---

## Interview Log Template

```
Interview #: ___
Date: ___
Company: ___
Contact Name / Title: ___
Texas MT License #: ___
Transaction Volume (est.): ___
Annual Compliance Spend (est.): ___

PAIN QUOTES (verbatim):
1.
2.
3.

Current Solutions: ___

Pricing Reaction ($5K/mo): ___

Beta Interest (Y/N): ___
Beta Contact Follow-up: ___

Score (1–15): ___
Classification: [ ] Strong  [ ] Moderate  [ ] Disqualify

Notes:
```
