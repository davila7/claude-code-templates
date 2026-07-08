---
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: <invoice details or subcommand>
description: Issue, cancel, and fetch Hungarian invoices via the szamlazz.hu Agent API — with NAV taxpayer lookup and automatic partner cache
---

# /szamlazz — Hungarian Invoicing via szamlazz.hu

Issue, cancel (storno), and download Hungarian invoices from Claude Code using the [szamlazz.hu](https://www.szamlazz.hu/) Agent API: $ARGUMENTS

Part of the [socialpro-szamlazz](https://github.com/socialproKGCMG/socialpro-szamlazz) plugin by [SocialPro](https://www.socialpro.hu) — a Hungarian AI automation and digital marketing agency.

## Purpose

Hungarian invoicing (számlázás) via szamlazz.hu is one of the most common SaaS-driven time sinks for Hungarian SMEs. Their Agent API is XML-only and undocumented in English. This command turns invoicing into a single natural-language prompt:

> "állíts ki egy 150 000 Ft-os számlát Példa Kft.-nek webfejlesztésről"

## Features

- **Invoice types**: regular, proforma (díjbekérő), and storno (cancellation)
- **NAV taxpayer lookup**: type a Hungarian tax number, get company name and address from the National Tax Authority
- **Partner cache**: customers remembered by tax ID for instant reuse
- **Hungarian VAT**: 27% / 18% / 5% / 0% / AAM, with KATA (kisadózó) support
- **Cross-platform**: macOS, Linux, Windows — Python 3.9+ and PyYAML only
- **Interactive setup**: first-run configures itself in 30 seconds via 3 questions
- **Secure**: API key stored in OS credential store

## Usage

```bash
# Install the plugin
/plugin marketplace add socialproKGCMG/socialpro-plugins
/plugin install szamlazz@socialpro-plugins

# Issue an invoice
/szamlazz állíts ki egy számlát Példa Kft.-nek 150 000 Ft-ról webfejlesztésről

# Cancel an invoice
/szamlazz sztornózd a SOC-2026-0042 számlát

# Proforma / díjbekérő
/szamlazz díjbekérő Acme Ltd-nek 500 EUR-ról konzultációért

# Download PDF
/szamlazz töltsd le a SOC-2026-0042 PDF-jét

# NAV taxpayer lookup
/szamlazz ki ez a cég: 12345678-2-42
```

## Implementation

The command activates on Hungarian AND English trigger words (számla, invoice, sztornó, storno, díjbekérő, proforma, etc.). On first run it detects missing config and walks through an interactive setup:

1. **Agent API key** — from szamlazz.hu settings
2. **Seller tax number** — auto-fetches company data from NAV
3. **Bank account** — auto-detects bank name from giro prefix

After setup, invoices follow a strict flow:
1. Load seller config from `seller.yaml`
2. Resolve customer (partner cache → NAV lookup → manual input)
3. Collect line items with VAT rate
4. Show confirmation summary (mandatory — invoices are legal documents)
5. Fire XML to szamlazz.hu Agent API
6. Save PDF locally, update partner cache

All amounts use `Decimal` with `ROUND_HALF_UP` to 2 decimals — the szamlazz.hu API rejects calculation mismatches.

## Error Handling

The 7 most common szamlazz.hu error codes are translated into Hungarian with actionable recovery:

| Code | Meaning | Recovery |
|---:|---|---|
| 3 | Auth failed | Regenerate Agent key |
| 54, 55 | e-Számla cert | Retry with eszamla=false |
| 57, 259-264 | Calc mismatch | Recalculate with Decimal |
| 136 | Unpaid balance | Pay szamlazz.hu subscription |

## Requirements

- Python 3.9+
- PyYAML (`pip install pyyaml`)
- szamlazz.hu account with Agent API key

## Links

- **Plugin repo**: [github.com/socialproKGCMG/socialpro-szamlazz](https://github.com/socialproKGCMG/socialpro-szamlazz)
- **Plugin homepage**: [socialpro.hu/claude-code-plugins/szamlazz](https://www.socialpro.hu/claude-code-plugins/szamlazz)
- **szamlazz.hu API docs**: [szamlazz.hu](https://www.szamlazz.hu/)
- **Author**: [SocialPro — Hungarian AI automation agency](https://www.socialpro.hu)
