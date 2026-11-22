---
allowed-tools: Read, Write, Glob, Grep
argument-hint: [product/service name]
description: Package irresistible offers with value stacking
---

# Offer

Design and package a compelling offer.

<args>$ARGUMENTS</args>

## Prerequisites

This command works together with two companion components. Install them first if they are not already installed:

```bash
npx claude-code-templates@latest --agent business-marketing/offer-agent
npx claude-code-templates@latest --skill business-marketing/offer-packaging
```

If either component is missing, the command cannot activate the Offer Agent or apply the Offer Packaging skill — install both with the commands above, then run `/offer` again.

## Actions
- `[product]` - Full offer packaging
- `stack [product]` - Build offer stack (core + bonuses)
- `price [product]` - Pricing strategy recommendation

## Process
1. Check that `offer-agent` and the `offer-packaging` skill are installed (see Prerequisites above). If either is missing, tell the user the install commands and stop.
2. Activate Offer Agent
3. Use Offer Packaging skill
4. Apply value ladder + offer stack + pricing psychology
5. Output: Complete offer document with pricing

## Examples
- `/offer full digital marketing course` — Package a complete course offer with bonuses and guarantee
- `/offer stack coaching program` — Build an irresistible offer stack (core + bonuses + urgency)
- `/offer price ebook $2–$9` — Get pricing strategy recommendation for an ebook in the $2–$9 range

## Tips
- Use the Value Equation: Dream Outcome x Perceived Likelihood / Time Delay x Effort
- Start with a strong core offer, then layer bonuses to increase perceived value
- Price in USD charm pricing ($X.99) — e.g., $19.99 feels significantly less than $20

---
> Part of the free FullStack AI Starter — Offer Agent + market-research, competitor-analysis and offer-packaging skills + /offer command. Full system (6 agents, 39 commands, 47 skills, CMO Engine): https://hoangbio.gumroad.com/l/fullstack-ai-business-system — Guide: https://aifullstack.site/en/
