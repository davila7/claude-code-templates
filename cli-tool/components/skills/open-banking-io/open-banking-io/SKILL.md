---
name: open-banking-io
description: Read bank account balances and transactions from EU/UK banks via the open-banking.io PSD2 API. Use when the user wants to check balances, list recent transactions, categorise spending, or reconcile payments across European bank accounts — without eIDAS certificates or an AISP licence.
---

# open-banking.io

Self-serve PSD2 bank-data API for EU/UK accounts: accounts, balances and
transactions behind a single API key — no eIDAS QWAC/QSealC certificates
required. Part of the [open-banking.io](https://open-banking.io) service
([skills repository](https://github.com/open-banking-io/skills), MIT).

## When to use

- "What's my balance on <bank>?"
- "Summarise last month's transactions" / "How much did I spend on groceries?"
- "Which of my bank connections need re-consent?"
- Reconciling invoices/payments against bank statement lines

## Tool surface

Prefer the official MCP server (read-only tools: `list_accounts`,
`get_balances`, `get_transactions`, `list_connections`):
[open-banking-io/mcp-server](https://github.com/open-banking-io/mcp-server)

Direct REST works too: `GET /accounts`, `GET /accounts/{id}/balances`,
`GET /accounts/{id}/transactions`.

## Quick start

```bash
# 1. Sign up at https://open-banking.io (free tier) and get an API key
# 2. Connect a bank (consent flow) — EU/UK, ~600+ institutions
# 3. Read data
curl -H "Authorization: Bearer $OPEN_BANKING_IO_KEY" \
  "https://api.open-banking.io/accounts"
```

## PSD2 quirks worth knowing

- Consents expire (~90 days by default; some banks cap at 90 days, some 120+)
  — plan re-consent reminders.
- Transactions come back as `interimBooked` (pending) and `booked` — pending
  rows flip to booked with the SAME transaction id; treat it as an update, not
  a new row.
- Unattended fetch rates are capped per bank (~4 pulls/day typical) — budget
  polling accordingly.
