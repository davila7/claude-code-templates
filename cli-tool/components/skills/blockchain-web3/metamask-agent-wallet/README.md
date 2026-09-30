# MetaMask Agent Wallet

Official skill for the [MetaMask Agent Wallet CLI](https://www.npmjs.com/package/@metamask/agent-wallet) (`mm`). It lets an agent authenticate, manage wallets, check balances, transfer and sign, swap and bridge tokens, trade perpetual futures and prediction markets, supply to DeFi earn vaults, decode EVM calldata, and pay x402 requests.

`SKILL.md` routes each request to a topic reference in `references/` and to multistep templates in `workflows/`. The two helper scripts are `scripts/amount_to_hex.py`, which converts token amounts to hex for calldata, and `scripts/x402_pay.py`, which pays an x402 challenge with the active wallet.

## Requirements

The skill drives the `mm` CLI, which is installed separately. The skill tells the agent to ask the user before installing it:

```bash
npm install -g @metamask/agent-wallet@7.0.0
mm login
mm init
```

Transfers, swaps, trades, and x402 payments move real funds. Review each command the agent proposes before approving it.

## Source and license

Vendored as-is from [MetaMask/agent-skills](https://github.com/MetaMask/agent-skills) (skill version 7.7.1, targeting CLI 7.0.0). MIT licensed, see `LICENSE`. The upstream repo also ships this skill as a Claude Code plugin with a session-start readiness check.
