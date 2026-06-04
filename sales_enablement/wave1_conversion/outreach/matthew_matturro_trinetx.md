# Matthew Matturro / TriNetX — Conversion Call Prep

**Date:** June 8, 2026  
**Trial ends:** June 13, 2026  
**Tier target:** Healthcare ($15,000/mo → $7,500/mo pilot)  
**Context:** Matthew got blocked by invite token bug for 20 days. Now active. First login imminent.

---

## Pre-Call Checklist

- [ ] Check CloudWatch: confirm Matthew logged in at least once before June 8
  ```bash
  aws logs filter-log-events \
    --log-group-name /aws/lambda/securebase-production-auth-v2 \
    --start-time $(python3 -c "import time; print(int((time.time()-172800)*1000))") \
    --filter-pattern 'matthew.matturro' \
    --region us-east-1
  ```
- [ ] If no login by June 6: send LinkedIn follow-up (template below)
- [ ] Pull Matthew's Evidence Vault activity from DynamoDB before call
- [ ] Know the TriNetX story: they're a healthcare data network, HIPAA obligations, likely SOC 2 pressure from customers

---

## If No Login by June 6 — LinkedIn Message

> Hi Matthew — wanted to make sure you're all set. Your SecureBase access is live at portal.securebase.tximhotep.com and I wanted to confirm you're seeing everything clearly before our call on the 8th. Let me know if anything's off — happy to jump on a quick 10-min call before then.

---

## Call Agenda (30 min)

**Minutes 0–5: Opening**  
"Before anything else — I want to apologize for the delay getting you in. That's on us. But I also want to make sure the last few days in the platform have been worth the wait. What have you had a chance to look at?"

**Minutes 5–15: Discovery**
- What's TriNetX's current compliance posture? (SOC 2? HITRUST? HIPAA-only?)
- Who's asking for evidence today — customers? Auditors? Board?
- What does your current process look like for pulling audit evidence?
- What would "this is working" look like for your team?

**Minutes 15–22: Value narrative (Healthcare Tier)**
- HIPAA governance controls live — not aspirational
- 7-year evidence retention already configured
- BAA included at no cost
- PHI access governance visible today
- Monthly + quarterly reporting cadence

**Minutes 22–27: Commercial**
- Pilot pricing: $7,500/mo for 6 months (50% off $15K)
- No long-term contract — 30-day cancellation
- If they convert: June 13 trial → June 13 paid subscription day 1

**Minutes 27–30: Close**
"Based on what you've seen — does $7,500/month feel like a fair starting point to keep this going? I can get you an order form today."

---

## Objection Handling

**"We need to evaluate more before committing"**  
"Totally fair. What specifically are you looking to validate? I want to make sure those questions are answered before the 13th. We could extend the trial if there's a specific thing you need to see — but I want to understand what 'yes' looks like for you."

**"The price is too high"**  
"The $7,500 is the pilot rate — half of what this runs at full price. If budget's the constraint, I want to understand the context. Is this a CFO conversation, or is this about value? Because if it's value, let's talk about what you'd need to see to make this a no-brainer."

**"We already have [tool X]"**  
"Walk me through what [tool X] is doing for you today. I want to make sure I understand the gap we're filling versus where you're already covered."

**"I need to get internal buy-in"**  
"Who else needs to be in the room for this decision? I'm happy to do a 20-minute overview call with your team this week — whatever helps you move forward."

---

## Follow-up After Call

Send same day:
> Hi Matthew — appreciate the time today. Per our conversation, I'm sending over [the order form / a one-pager / next steps]. [Specific action item from call]. Let me know if you have any questions — I want to get you set before the 13th.
