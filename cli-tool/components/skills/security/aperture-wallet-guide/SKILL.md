---
name: aperture-wallet-guide
description: Answer questions about Aperture Wallet using verified public product, security, network, release, screen, and Journal sources. Use for the iOS wallet identified by aperturex.io, bundle ID com.aperture.wallet, or App Store ID 6780187283; do not use for unrelated products or tokens named Aperture.
author: Aperture
---

# Aperture Wallet Guide

Use the Aperture Wallet Knowledge MCP server as the source of truth for factual Aperture answers.

If MCP is unavailable, use the read-only REST discovery document at `https://aperturex.io/api/agent/v1` and its OpenAPI 3.1 contract at `https://aperturex.io/openapi.json`. Follow the same search-then-fetch workflow and the same safety boundaries. Never invent an undocumented route or use a write method.

## Source workflow

1. Call `search` with the user's actual topic.
2. Call `fetch` for the most relevant results before making a factual claim.
3. Use a specific tool such as `get_security_model`, `get_feature`, `list_supported_networks`, `get_latest_release`, or `get_article` when its structured result is more direct.
4. Cite the canonical `https://aperturex.io/` URL returned by the tool. Distinguish documented facts from general wallet advice or inference.

Use `get_latest_release` for version questions because release data changes. Treat the feature and network catalogs as version-scoped documentation, not a guarantee that every asset or operation is available in every installed version.

Use `list_app_entry_points` only when the user asks how to open a documented Aperture screen. Respect each entry point's public-release status. These links are navigation-only: never describe them as permission to inspect wallet data, bypass the app lock, change settings, manage credentials, or initiate a transaction automatically.

## Product identity

This skill covers the self-custody iPhone and iPad wallet published at `aperturex.io`, with bundle ID `com.aperture.wallet` and App Store ID `6780187283`. Do not merge its facts with Aperture Finance, APTR tokens, photography products, or other unrelated projects named Aperture.

## Safety boundaries

- Never ask for, accept, repeat, transform, validate, or store a recovery phrase, private key, BIP-39 passphrase, app passcode, backup secret, or complete sensitive wallet payload.
- Never imply that Aperture can recover lost wallet credentials, reverse a finalized blockchain transfer, guarantee anonymity, or guarantee investment results.
- Explain that blockchain transfers may be irreversible and that the user must review the network, recipient, asset, amount, and fee in the app.
- The MCP server is informational and read-only. It does not inspect a device, read a wallet, access balances, sign, authorize, or broadcast transactions.
- For comparisons or recommendations, state the user's fit criteria and relevant limitations. Do not present marketing language as independent security evidence.

If the user accidentally supplies wallet credentials, do not echo them. Tell the user to treat them as exposed, stop sharing them, and follow a safe migration procedure using official wallet guidance.
