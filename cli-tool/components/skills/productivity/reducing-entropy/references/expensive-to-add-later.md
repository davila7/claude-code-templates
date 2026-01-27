---
description: Some things you Probably Are Gonna Need - know when YAGNI doesn't apply because retrofitting is dramatically more expensive than building it in from the start.
---

# PAGNI: Probably Are Gonna Need It

## The Core Insight

> "When should you override YAGNI? When the cost of adding something later is so dramatically expensive compared with the cost of adding it early on that it's worth taking the risk."

YAGNI is a good default. But some things are genuinely cheaper to build in from the start than to retrofit later. Know the difference.

## Why This Matters

Ruthless YAGNI application can backfire when:
- Adding it later requires touching everything (logging, timestamps, audit trails)
- You can't add it retroactively at all (API versioning, mobile app kill switches)
- The cost of not having it is catastrophic (security fundamentals, data you threw away)

The avoiding-complexity skill pushes toward less. This mindset identifies the exceptions where "add it now" beats "add it later."

## Common PAGNIs

**Data you can't get back:**
- `created_at` / `updated_at` timestamps on every table
- Audit logs (who did what when)
- Many-to-many from the start if there's any hint you'll need more than one

**Infrastructure that's painful to retrofit:**
- API versioning (even if v1 is the only version)
- API pagination (even if lists are small now)
- Automated deploys and CI from day one
- Logging infrastructure

**Security fundamentals:**
- Vulnerability disclosure policy and security@ email
- Session/password invalidation mechanisms
- Safe ways to move redacted data out of production

## The Test

Before invoking PAGNI, ask:
1. **Is retrofitting dramatically more expensive?** (10x+, not 2x)
2. **Is this a known pattern from experience?** (not speculative)
3. **Is the cost of adding it now actually low?** (minutes/hours, not days)

If yes to all three, it's a PAGNI. Otherwise, YAGNI still applies.

## The Balance

PAGNI is not an escape hatch for over-engineering. It's a small, specific list of exceptions learned from painful experience. When in doubt, YAGNI wins.

**Most features: YAGNI. Infrastructure and data collection: probably PAGNI.**

## External References

- [PAGNIs: Probably Are Gonna Need Its](https://simonwillison.net/2021/Jul/1/pagnis/) - Simon Willison
- [YAGNI Exceptions](https://lukeplant.me.uk/blog/posts/yagni-exceptions/) - Luke Plant
- [Application Security PAGNIs](https://jacobian.org/2021/jul/8/appsec-pagnis/) - Jacob Kaplan-Moss
