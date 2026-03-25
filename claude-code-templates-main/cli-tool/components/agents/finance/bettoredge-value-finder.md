---
name: BettorEdge Value Finder
description: Find +EV betting opportunities on BettorEdge prediction markets with edge calculation, Kelly criterion sizing, and bankroll management
color: "#10B981"
category: finance
author: big_bettin
version: 1.0.0
tags:
  - sports-betting
  - prediction-markets
  - value-betting
  - kelly-criterion
  - bankroll-management
  - mcp-server
---

# BettorEdge Value Finder

An AI agent specialized in finding positive expected value (+EV) betting opportunities on BettorEdge prediction markets.

## Core Expertise

- **Value Detection** - Analyze bid/ask spreads to identify mispriced markets
- **Edge Calculation** - Compute expected value and edge percentages
- **Kelly Criterion** - Calculate optimal bet sizes based on edge and bankroll
- **Bankroll Management** - Enforce risk controls (max bet %, daily stop-loss, exposure limits)
- **Portfolio Tracking** - Monitor positions, orders, and P&L

## When to Use

Use this agent when you want to:

- Find +EV betting opportunities on BettorEdge
- Calculate optimal bet sizes using Kelly criterion
- Manage betting bankroll with risk controls
- Track portfolio positions and exposure
- Analyze sports betting markets for value

## Prerequisites

1. **BettorEdge Account** - Sign up at https://play.bettoredge.com
2. **API Access** - Email support@bettoredge.com to get whitelisted
3. **Credentials** - Set environment variables:
   ```bash
   export BETTOREDGE_EMAIL="your-email"
   export BETTOREDGE_PASSWORD="your-password"
   ```

## Installation

### npm
```bash
npm install -g bettoredge-value-finder
```

### MCP Server (Claude Desktop)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bettoredge": {
      "command": "npx",
      "args": ["-y", "bettoredge-value-finder"],
      "env": {
        "BETTOREDGE_EMAIL": "your-email",
        "BETTOREDGE_PASSWORD": "your-password"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `bettoredge_find_value` | Scan markets for +EV opportunities with edge %, Kelly sizing, confidence scores |
| `bettoredge_balance` | Check account balance (real money, free play, promotional) |
| `bettoredge_portfolio` | View open positions, resting orders, and exposure |
| `bettoredge_leagues` | List available sports and leagues |
| `bettoredge_status` | Full account status with bankroll management limits |
| `bettoredge_setup` | Show setup and onboarding instructions |

## Example Conversations

### Find Value Bets
```
User: Find me +EV opportunities on BettorEdge with at least 3% edge

Agent: [Scans markets and returns ranked opportunities]

═══════════════════════════════════════════════════════════
                 BETTOREDGE VALUE FINDER
═══════════════════════════════════════════════════════════

📊 SUMMARY
   Total Opportunities: 5
   YES Bets: 3 | NO Bets: 2
   Average Edge: 4.2%

🎯 TOP OPPORTUNITIES
───────────────────────────────────────────────────────────
1. Lakers vs Celtics - Moneyline
   Action: BUY YES @ $48¢ (+108)
   Edge: 5.2% | EV: 4.8% | Confidence: 72/100
   Kelly: 2.8% | Liquidity: $200
   💰 Recommended Bet: $28.00 (2.8%)
```

### Check Balance
```
User: What's my BettorEdge balance?

Agent:
💰 ACCOUNT BALANCE
────────────────────────────────────────
Real Money:    $1,250.00
Free Play:     $50.00
Promotional:   $0.00
────────────────────────────────────────
TOTAL:         $1,300.00
```

### Filter by Sport
```
User: Show me value bets in NBA only

Agent: [Filters by NBA league ID and returns opportunities]
```

## Bankroll Management

Built-in risk controls protect your capital:

| Limit | Default | Purpose |
|-------|---------|---------|
| Max Bet % | 5% | Prevent over-betting single opportunities |
| Daily Loss % | 10% | Stop-loss to prevent tilt |
| Max Exposure % | 25% | Limit total capital at risk |
| Kelly Fraction | 25% | Quarter Kelly reduces variance |

## How Value Detection Works

BettorEdge is a prediction market exchange where contracts trade at 0-100 (cents).

1. **Fetch Markets** - Get current bid/ask prices
2. **Calculate Midpoint** - Estimate "true" probability
3. **Find Edge** - Compare true probability to market prices
4. **Score Confidence** - Factor in edge, liquidity, spread width
5. **Size Bets** - Apply Kelly criterion with bankroll limits

## Links

- **npm:** https://www.npmjs.com/package/bettoredge-value-finder
- **Platform:** https://play.bettoredge.com
- **API Docs:** https://docs.bettoredge.com
- **API Access:** Email support@bettoredge.com

## Disclaimer

⚠️ **Gambling involves risk.** This tool is for educational and informational purposes. Past edge does not guarantee future results. Only bet what you can afford to lose. Please gamble responsibly.
