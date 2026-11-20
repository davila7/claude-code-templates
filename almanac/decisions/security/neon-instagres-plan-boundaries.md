---
title: "Neon Instagres Plan Boundaries"
summary: "The Neon Instagres integration is a product plan whose implementation must respect the repo's no-hardcoded-ID rule and current Cloudflare runtime."
topics: [decisions, security, catalog]
sources:
  - id: neon-plan
    type: file
    path: NEON_INTEGRATION_PLAN.md
  - id: repo-guidance
    type: file
    path: CLAUDE.md
  - id: featured-page
    type: file
    path: docs/featured/neon-instagres/index.html
---

# Neon Instagres Plan Boundaries

The Neon Instagres plan describes a sponsored integration built around an auto-activating Neon skill, existing Neon agents, a Neon MCP, statusline settings, a featured page, and marketing content [@neon-plan]. The boundary decision is that this plan is not implementation authority where it conflicts with repository security or deployment rules: hardcoded referral identifiers need explicit review, and stale Vercel deployment steps must yield to the repo's Cloudflare Pages and Workers runtime [@repo-guidance].

## Status

Planned with unresolved boundaries. The plan marks version 2.0 as ready for implementation and lists a 30-day partnership deliverable set, but the repository's current operational guidance still forbids hardcoded infrastructure identifiers and manual Vercel deployment [@neon-plan] [@repo-guidance].

## Context

The plan's core product idea is a "Complete Neon Template" with one new `neon-instagres` skill, five existing Neon agents, one existing Neon MCP, and two existing Neon settings [@neon-plan]. The skill is intended to run `npx get-db --yes --ref 4eCjZDz`, create `DATABASE_URL`, `DATABASE_URL_DIRECT`, and `PUBLIC_INSTAGRES_CLAIM_URL`, then delegate follow-up work to specialized Neon agents [@neon-plan].

The generated featured page presents the integration as a complete Postgres infrastructure template and keeps the same referral URL in the external "Try Neon Free" call to action [@featured-page]. It also describes a broader architecture with a provisioning layer, a `using-neon` skill, five agent roles, and Neon MCP management operations [@featured-page].

## Decision

Treat the Neon plan as a product and catalog plan, not as permission to bypass security policy. The referral code in `https://get.neon.com/4eCjZDz` and the `--ref 4eCjZDz` command are business identifiers, so they must be reviewed under [No Hardcoded Secrets or IDs](no-hardcoded-secrets-or-ids) before becoming code, component instructions, or generated docs [@neon-plan] [@repo-guidance].

Treat Cloudflare as the deployment source of truth. The plan still includes `vercel --prod`, Vercel logs, and a Vercel production checklist item, while the repository guidance says dashboard/API deploys use `wrangler pages deploy`, Workers replace old Vercel cron jobs, and the docs directory is no longer deployed to `www` [@neon-plan] [@repo-guidance].

## Consequences

Implementation should separate three things: the installable Neon component set, the featured catalog/storytelling surface, and any partner/referral tracking [@neon-plan] [@featured-page]. The component and catalog work can build on [Dual Persistence Model](../../concepts/persistence/dual-persistence-model) and [Catalog Generation Pipeline](../../architecture/catalog/catalog-generation-pipeline), while referral and deployment decisions need explicit review instead of being copied from the plan verbatim [@repo-guidance].

The plan and featured page also disagree on component count: the plan describes nine components, while the featured page says the template consists of ten components after adding `using-neon` [@neon-plan] [@featured-page]. Future edits should resolve that product contract before contributors regenerate catalog or marketing artifacts.
