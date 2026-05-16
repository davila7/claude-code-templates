---
name: offer-comparison-analyzer
description: Compare multiple job offers side-by-side with total compensation analysis. Use when the user has multiple offers and wants to compare salary, equity, benefits, or total comp.
---

# Offer Comparison Analyzer

## When to Use This Skill

Use this skill when the user:
- Has multiple job offers to compare
- Needs to evaluate total compensation
- Wants to make a data-driven job decision
- Is weighing different opportunities
- Mentions: "compare offers", "multiple offers", "which job", "offer comparison", "deciding between jobs"

## Core Capabilities

- Compare total compensation across offers
- Evaluate non-monetary factors
- Create weighted decision frameworks
- Calculate true offer value
- Identify hidden costs and benefits
- Guide the decision-making process

## The Comparison Challenge

**The Problem:** 
Comparing offers is hard because:
- Different compensation structures
- Non-monetary factors matter
- Hidden benefits and costs
- Emotional factors cloud judgment
- Information asymmetry

**The Solution:**
Systematic comparison framework that considers:
- Total compensation (not just salary)
- Career growth potential
- Work-life factors
- Risk assessment
- Personal values alignment

## Total Compensation Calculator

### Components to Include

**Cash Compensation:**
- Base salary
- Signing bonus (one-time)
- Annual bonus (target %)
- Commission (for sales roles)
- Relocation assistance

**Equity Compensation:**
- Stock options (value = current price - strike price)
- RSUs (value = current price × shares)
- Vesting schedule
- Refresh grant expectations

**Benefits Value:**
- Health insurance (employer contribution)
- 401(k) match
- HSA/FSA contributions
- Life/disability insurance
- Other insurance benefits

**Perks Value:**
- Vacation days (can assign $ value)
- Remote work (saves commute costs)
- Professional development budget
- Equipment/office stipend
- Meals, gym, etc.

### Calculation Template

```
OFFER A - TOTAL COMPENSATION

CASH
Base Salary:                    $150,000
Signing Bonus (year 1 only):     $25,000
Target Bonus (15%):              $22,500
--------------------------------
Cash Compensation:              $197,500 (year 1)
                               $172,500 (ongoing)

EQUITY
RSU Grant: $200,000 over 4 years
Annual Value:                    $50,000
--------------------------------
Equity Compensation:             $50,000/year

BENEFITS
401(k) Match (4%):               $6,000
Health Insurance:                $15,000 (employer portion)
HSA Contribution:                 $1,000
--------------------------------
Benefits Value:                  $22,000/year

PERKS
Vacation: 20 days (vs 10 standard)
  Extra 10 days × ~$575/day:      $5,750 value
Remote Work Savings:              $3,000 (commute, lunch)
Professional Dev:                 $2,000 budget
--------------------------------
Perks Value:                     $10,750/year

TOTAL YEAR 1:        $280,250
TOTAL ONGOING:       $255,250/year
```

## Side-by-Side Comparison Template

```markdown
# OFFER COMPARISON

|                          | Company A | Company B | Notes |
|--------------------------|-----------|-----------|-------|
| **CASH**                 |           |           |       |
| Base Salary              | $150,000  | $160,000  | B +$10K |
| Signing Bonus            | $25,000   | $10,000   | A +$15K |
| Target Bonus             | 15%       | 10%       | A +$6.5K |
| **Cash Total (Yr 1)**    | $197,500  | $186,000  | A +$11.5K |
|                          |           |           |       |
| **EQUITY**               |           |           |       |
| Grant Value (4yr)        | $200,000  | $300,000  | B +$100K |
| Annual Equity            | $50,000   | $75,000   | B +$25K |
|                          |           |           |       |
| **BENEFITS**             |           |           |       |
| 401(k) Match             | 4%        | 6%        | B +$3.2K |
| Health Insurance         | Good      | Premium   | B better |
| PTO                      | 20 days   | Unlimited | Varies |
|                          |           |           |       |
| **TOTAL COMP (Yr 1)**    | $280,250  | $285,000  | B +$4.7K |
| **TOTAL COMP (Ongoing)** | $255,250  | $275,000  | B +$19.7K |
```

## Non-Monetary Factor Framework

### Career Growth (Weight: High)

**Questions to Consider:**
- Which role offers more learning?
- Which company/brand helps future job search?
- Which has better promotion track?
- Which offers more scope/responsibility?
- Which manager will develop you more?

**Scoring:**
```
Company A: Growth Score
- Learning opportunity: 8/10
- Brand/resume value: 7/10
- Promotion potential: 6/10
- Scope: 8/10
Average: 7.25/10

Company B: Growth Score
- Learning opportunity: 7/10
- Brand/resume value: 9/10
- Promotion potential: 8/10
- Scope: 7/10
Average: 7.75/10
```

### Work-Life Balance (Weight: Personal)

**Factors:**
- Expected hours
- Remote/hybrid flexibility
- Vacation usage culture
- On-call requirements
- Travel requirements
- Commute time

### Team & Culture (Weight: High)

**Factors:**
- Manager quality (crucial!)
- Team health/dynamics
- Company culture fit
- DEI considerations
- Company stability/growth
- Values alignment

### Risk Assessment (Weight: Medium)

**Startup vs. Established:**
- Funding runway
- Market position
- Company trajectory
- Equity risk (could be worth $0)

**Questions:**
- What happens if company struggles?
- How stable is this role?
- What's the severance policy?

## Weighted Decision Matrix

### Step 1: Define Your Priorities

```
Factor                  Weight
------------------------------------
Total Compensation       25%
Career Growth            25%
Work-Life Balance        20%
Team & Culture           20%
Location/Commute         10%
------------------------------------
Total:                   100%
```

### Step 2: Score Each Factor

```
                    Company A   Company B
Factor              Score (1-10)
------------------------------------
Compensation        7           8
Career Growth       7           8
Work-Life           8           6
Team & Culture      9           7
Location            8           5
```

### Step 3: Calculate Weighted Score

```
Company A:
(7 × 0.25) + (7 × 0.25) + (8 × 0.20) + (9 × 0.20) + (8 × 0.10)
= 1.75 + 1.75 + 1.60 + 1.80 + 0.80
= 7.70

Company B:
(8 × 0.25) + (8 × 0.25) + (6 × 0.20) + (7 × 0.20) + (5 × 0.10)
= 2.00 + 2.00 + 1.20 + 1.40 + 0.50
= 7.10

Result: Company A scores higher (7.70 vs 7.10)
```

## Red Flags to Watch

### In the Offer

- ❌ Vague bonus language ("up to 20%")
- ❌ Equity with no liquidity path
- ❌ High base but no equity (at startup)
- ❌ Cliff longer than 1 year
- ❌ Vesting acceleration absent
- ❌ Non-compete restrictions
- ❌ Verbal promises not in writing

### About the Company

- ❌ High turnover (check LinkedIn)
- ❌ Recent layoffs or reorgs
- ❌ Manager seems checked out
- ❌ Glassdoor patterns in bad reviews
- ❌ Funding concerns
- ❌ Unclear path to profitability

### About the Role

- ❌ Vague responsibilities
- ❌ Role seems to change during interviews
- ❌ Red flags in why position is open
- ❌ No growth path discussed
- ❌ Unrealistic expectations set

## Questions to Ask Yourself

### The Gut Check
- Which offer excites me more?
- Which would I regret not taking?
- Which aligns with my 5-year goals?
- Which would I brag about to friends?

### The Monday Morning Test
- Which job do I want to wake up for?
- Which team do I want to work with?
- Which problems do I want to solve?

### The Learning Test
- Where will I grow more?
- Which skills will I develop?
- Which looks better on my resume in 3 years?

### The Risk Test
- What's the downside of each?
- Which failure would I regret more?
- What's my backup plan for each?

## Output Format

When comparing offers:

```markdown
# JOB OFFER COMPARISON

## Offers Being Compared
- **Offer A:** [Role] at [Company]
- **Offer B:** [Role] at [Company]

## Total Compensation Comparison

| Component | Offer A | Offer B | Difference |
|-----------|---------|---------|------------|
| Base | $X | $X | |
| Bonus | $X | $X | |
| Equity (annual) | $X | $X | |
| Benefits | $X | $X | |
| **Year 1 Total** | $X | $X | |
| **Ongoing Total** | $X | $X | |

## Non-Monetary Comparison

| Factor | Offer A | Offer B | Notes |
|--------|---------|---------|-------|
| Career Growth | X/10 | X/10 | |
| Work-Life | X/10 | X/10 | |
| Team/Culture | X/10 | X/10 | |
| Risk Level | X/10 | X/10 | |

## Weighted Analysis

Using your priorities:
- Offer A Score: X.XX
- Offer B Score: X.XX

## Key Differences
1. [Key difference 1]
2. [Key difference 2]
3. [Key difference 3]

## Recommendation

Based on your stated priorities of [X, Y, Z], **Offer [A/B]** appears to be the stronger choice because:
- [Reason 1]
- [Reason 2]
- [Reason 3]

## Things to Clarify Before Deciding
- [ ] [Question for Company A]
- [ ] [Question for Company B]

## Negotiation Opportunities
- [Opportunity 1]
- [Opportunity 2]
```

## Comparison Checklist

- ✅ Calculated total comp (not just base)
- ✅ Included equity with realistic valuation
- ✅ Factored in benefits value
- ✅ Considered tax implications
- ✅ Weighted non-monetary factors
- ✅ Assessed career growth potential
- ✅ Evaluated team and manager quality
- ✅ Checked company stability/risk
- ✅ Aligned with personal priorities
- ✅ Gut-checked the decision
