---
name: internet-court
description: "The trust layer for agent-to-agent commerce — natural-language mandates, delegated permissions (ERC-7710), x402 payments, escrow, and dispute resolution as one open, catch-all skill. Use for agent mandates, delegated permissions, GenLayer supervision, revocation, x402 payments, escrow, verification, dispute resolution, and agent-to-agent commerce."
license: MIT
author: Internet Court Consortium
repo: https://github.com/internet-court/internet-court-skill
tags: [agent-payments, x402, erc-7710, erc-8004, escrow, genlayer, dispute-resolution, a2a, agentic-commerce]
---

# Internet Court

The trust layer for agent-to-agent commerce. It turns "I want my agent to
transact, but I don't trust it with money" into an enforceable workflow: a
natural-language mandate becomes bounded authority, payments, escrow, signed
evidence, independent review, and revocation or dispute resolution when
something goes wrong.

This is a condensed entry point. The full package — a master router plus ~70
vendored protocol and connector skills — lives at
**https://github.com/internet-court/internet-court-skill** (homepage:
https://internetcourt.org). Install the whole package for the sub-skills, or
let this router fetch them on demand from the repo.

## When to use

Trigger whenever an agent needs to transact with another agent or a paid
service, or a user mentions: agent payments, paid APIs (HTTP 402 / x402),
wallet custody or trust, spending mandates, delegated permissions (ERC-7710 /
7715), escrow, agent identity or reputation (ERC-8004), negotiation between
agents (A2A), machine payments (MPP), supervision, revocation, verification, or
dispute resolution (GenLayer, Kleros) — even if they never say "Internet Court".

## The stack it routes to

| Layer | Concern | Examples in the full package |
|---|---|---|
| 1 | Identity & reputation | ERC-8004 registries, Starknet identity |
| 2 | Negotiation | A2A protocol |
| 3 | Contracts & obligations | Arkhai/Alkahest escrow, ERC-7710 delegations |
| 4 | Payment & escrow | x402, MPP, ERC-7710/7715 delegated wallets |
| 5 | Execution | compute, data & value rails |
| 6 | Verification & disputes | GenLayer, Kleros, Intelligent Oracle |

## How to use

1. Install or clone the full package from the repo above for the vendored and
   connector sub-skills.
2. Form bounded authority from a natural-language mandate — never unlimited
   approvals or unbounded agent spend; keep demos testnet-first.
3. Route the task to the right layer above; load the specific sub-skill's
   `SKILL.md` from the package (on disk, or from the repo's raw URL) before
   relying on its mechanics — never invent a protocol's behavior.
4. Produce checkable evidence (tx hashes, signed receipts); on disputes, route
   to the verification layer and disclose the decision-vs-enforcement boundary.

MIT licensed. See the canonical repository for full routing, connectors, and
`skills-lock.json`.
