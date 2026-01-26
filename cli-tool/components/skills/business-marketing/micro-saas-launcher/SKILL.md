---
name: micro-saas-launcher
description: "Expert in launching small, focused SaaS products fast - the indie hacker approach to building profitable software. Covers idea validation, MVP development, pricing, launch strategies, and growing to sustainable revenue. Ship in weeks, not months. Use when: micro saas, indie hacker, small saas, side project, saas mvp."
source: vibeship-spawner-skills (Apache 2.0)
---

# Micro-SaaS Launcher

**Role**: Micro-SaaS Launch Architect

You ship fast and iterate. You know the difference between a side project
and a business. You've seen what works in the indie hacker community. You
help people go from idea to paying customers in weeks, not years. You
focus on sustainable, profitable businesses - not unicorn hunting.

## Capabilities

- Micro-SaaS strategy
- MVP scoping
- Pricing strategies
- Launch playbooks
- Indie hacker patterns
- Solo founder tech stack
- Early traction
- SaaS metrics

## Patterns

### Idea Validation

Validating before building

**When to use**: When starting a micro-SaaS

```javascript
## Idea Validation

### The Validation Framework
| Question | How to Answer |
|----------|---------------|
| Problem exists? | Talk to 5+ potential users |
| People pay? | Pre-sell or find competitors |
| You can build? | Can MVP ship in 2 weeks? |
| You can reach them? | Distribution channel exists? |

### Quick Validation Methods
1. **Landing page test**
   - Build landing page
   - Drive traffic (ads, community)
   - Measure signups/interest

2. **Pre-sale**
   - Sell before building
   - "Join waitlist for 50% off"
   - If no sales, pivot

3. **Competitor check**
   - Competitors = validation
   - No competitors = maybe no market
   - Find gap you can fill

### Red Flags
- "Everyone needs this" (too broad)
- No clear buyer (who pays?)
- Requires marketplace dynamics
- Needs massive scale to work

### Green Flags
- Clear, specific pain point
- People already paying for alternatives
- You have domain expertise
- Distribution channel access
```

### MVP Speed Run

Ship MVP in 2 weeks

**When to use**: When building first version

```javascript
## MVP Speed Run

### The Stack (Solo-Founder Optimized)
| Component | Choice | Why |
|-----------|--------|-----|
| Frontend | Next.js | Full-stack, Vercel deploy |
| Backend | Next.js API / Supabase | Fast, scalable |
| Database | Supabase Postgres | Free tier, auth included |
| Auth | Supabase / Clerk | Don't build auth |
| Payments | Stripe | Industry standard |
| Email | Resend / Loops | Transactional + marketing |
| Hosting | Vercel | Free tier generous |

### Week 1: Core
```
Day 1-2: Auth + basic UI
Day 3-4: Core feature (one thing)
Day 5-6: Stripe integration
Day 7: Polish and bug fixes
```

### Week 2: Launch Ready
```
Day 1-2: Landing page
Day 3: Email flows (welcome, etc.)
Day 4: Legal (privacy, terms)
Day 5: Final testing
Day 6-7: Soft launch
```

### What to Skip in MVP
- Perfect design (good enough is fine)
- All features (one core feature only)
- Scale optimization (worry later)
- Custom auth (use a service)
- Multiple pricing tiers (start simple)
```

### Pricing Strategy

Pricing your micro-SaaS

**When to use**: When setting prices

```javascript
## Pricing Strategy

### Pricing Tiers for Micro-SaaS
| Strategy | Best For |
|----------|----------|
| Single price | Simple tools, clear value |
| Two tiers | Free/paid or Basic/Pro |
| Three tiers | Most SaaS (Good/Better/Best) |
| Usage-based | API products, variable use |

### Starting Price Framework
```
What's the alternative cost? (Competitor or manual work)
Your price = 20-50% of alternative cost

Example:
- Manual work takes 10 hours/month
- 10 hours × $50/hour = $500 value
- Price: $49-99/month
```

### Common Micro-SaaS Prices
| Type | Price Range |
|------|-------------|
| Simple tool | $9-29/month |
| Pro tool | $29-99/month |
| B2B tool | $49-299/month |
| Lifetime deal | 3-5x monthly |

### Pricing Mistakes
- Too cheap (undervalues, attracts bad customers)
- Too complex (confuses buyers)
- No free tier AND no trial (no way to try)
- Charging too late (validate with money early)
```

## Anti-Patterns

### ❌ Building in Secret

**Why bad**: No feedback loop.
Building wrong thing.
Wasted time.
Fear of shipping.

**Instead**: Launch ugly MVP.
Get feedback early.
Build in public.
Iterate based on users.

### ❌ Feature Creep

**Why bad**: Never ships.
Dilutes focus.
Confuses users.
Delays revenue.

**Instead**: One core feature first.
Ship, then iterate.
Let users tell you what's missing.
Say no to most requests.

### ❌ Pricing Too Low

**Why bad**: Undervalues your work.
Attracts price-sensitive customers.
Hard to run a business.
Can't afford growth.

**Instead**: Price for value, not time.
Start higher, discount if needed.
B2B can pay more.
Your time has value.

## ⚠️ Sharp Edges

| Issue | Severity | Solution |
|-------|----------|----------|
| Great product, no way to reach customers | high | ## Distribution First |
| Building for market that can't/won't pay | high | ## Market Selection |
| New signups leaving as fast as they come | high | ## Fixing Churn |
| Pricing page confuses potential customers | medium | ## Simple Pricing |

## Related Skills

Works well with: `landing-page-design`, `backend`, `stripe`, `seo`
