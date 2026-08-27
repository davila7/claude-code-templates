---
name: ophis-swap
description: Gasless, MEV-protected, keyless onchain token swaps for AI agents across 11 EVM chains via Ophis, an intent-based DEX built on CoW Protocol.
license: MIT
---

# ophis-swap

## Overview
ophis-swap teaches an AI agent the safe order of operations for executing an onchain token swap through Ophis, an intent-based DEX that is a deployment of CoW Protocol. Swaps settle through a solver competition, so they are MEV-protected, gasless for the trader (no native coin needed for gas), keyless (the MCP is public, no API key), non-custodial (the server builds an unsigned order, the agent signs it with its own wallet, and the receiver is pinned to the signer), best-execution routed, and rebate-eligible through a tiered referrer program.

Ophis runs on 11 EVM chains: Ethereum (1), Optimism (10), BNB Chain (56), Gnosis (100), Polygon (137), Base (8453), Arbitrum (42161), Avalanche (43114), Plasma (9745), Ink (57073), and Linea (59144).

## When to Use
- When an AI agent needs to swap one token for another onchain without holding native gas.
- When you want MEV-protected, best-execution settlement instead of a raw AMM router call.
- When the agent should sign its own orders and keep custody of funds (non-custodial).
- When you want a keyless, public MCP with no API key to provision or rotate.

## Installation
Add the Ophis plugin from the Claude Code marketplace (this bundles the MCP server and the skill):

```bash
/plugin marketplace add ophis-fi/skills
/plugin install ophis@ophis-fi
```

Or connect the remote MCP server directly (public, no API key):

```
https://mcp.ophis.fi/mcp
```

## Step-by-Step Guide
The skill enforces this order so a trade is always resolved and quoted before anything is signed:
1. parse_intent: turn the natural-language request into a structured intent (sell token, buy token, amount, chain).
2. list_chains and resolve_token: map each symbol to its canonical token address. resolve_token fails closed, so an unrecognized or spoofed symbol stops the flow instead of resolving to the wrong contract.
3. get_quote and expected_surplus: fetch a best-execution quote and the expected surplus before committing.
4. get_balances and get_gas: optional sanity checks on the signer holdings and current gas context.
5. build_order: the server returns an unsigned order with the receiver pinned to the signer. Nothing is broadcast yet.
6. The agent signs the order with its own wallet. Custody never leaves the signer.
7. submit_order: the only state-changing tool. It submits the signed order into the solver competition for settlement.
8. lookup_tier, get_portfolio, and get_token_chart: check the rebate tier and review balances or price history for context.

## Examples
- "Swap 100 USDC for ETH on Base": parse_intent resolves the pair and chain, resolve_token pins the canonical addresses, get_quote returns a quote, build_order returns an unsigned order, the agent signs, and submit_order settles it gaslessly.
- "What is my rebate tier?": lookup_tier returns the current volume-based tier in the referrer program.

## Best Practices
- Always resolve tokens with resolve_token before building an order, and stop if it fails closed.
- Review get_quote and expected_surplus before signing; treat submit_order as the single point of no return.
- Keep signing inside the agent wallet. The server never takes custody, and the receiver stays pinned to the signer.

## Disambiguation
This is Ophis the intent-based DEX (ophis.fi). It is not njayp/ophis, an unrelated Go library that generates MCP servers from Cobra CLIs. The two share a name only.

## Troubleshooting
- A token will not resolve: resolve_token fails closed by design. Confirm the symbol and chain, or pass a canonical address.
- No quote returned: verify the chain is one of the 11 supported networks and that both tokens exist on that chain.
- More help: ophis.fi, app at swap.ophis.fi, contact contact@ophis.fi. MCP source at github.com/ophis-fi/ophis (subfolder apps/mcp-server).

## Related Skills
- agirails-agent-payments, stripe-integration
