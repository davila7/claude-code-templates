---
name: footballbin-predictions
description: Get AI-powered match predictions for Premier League and Champions League including scores, next goal, and corners.
metadata: {"clawdbot":{"emoji":"⚽","requires":{"bins":["curl","jq"]},"files":["scripts/*"]}}
---

# FootballBin Match Predictions

Get AI-powered predictions for Premier League and Champions League matches via the FootballBin MCP API.

## Usage

Run `scripts/footballbin.sh` with the following commands:

### Get current matchweek predictions
```
scripts/footballbin.sh predictions premier_league
scripts/footballbin.sh predictions champions_league
```

### Get specific matchweek
```
scripts/footballbin.sh predictions premier_league 27
```

### Filter by team
```
scripts/footballbin.sh predictions premier_league --home arsenal
scripts/footballbin.sh predictions premier_league --away liverpool
scripts/footballbin.sh predictions premier_league --home chelsea --away wolves
```

### List available tools
```
scripts/footballbin.sh tools
```

## Supported Leagues

| Input | League |
|-------|--------|
| `premier_league`, `epl`, `pl`, `prem` | Premier League |
| `champions_league`, `ucl`, `cl` | Champions League |

## Supported Team Aliases

Common aliases work: `united` (Man Utd), `city` (Man City), `spurs` (Tottenham), `wolves` (Wolverhampton), `gunners` (Arsenal), `reds` (Liverpool), `blues` (Chelsea), `villa` (Aston Villa), `forest` (Nottingham Forest), `palace` (Crystal Palace), `barca` (Barcelona), `real` (Real Madrid), `bayern` (Bayern Munich), `psg` (PSG), `juve` (Juventus), `inter` (Inter Milan), `bvb` (Dortmund), `atleti` (Atletico Madrid).

## Response Data

Each match prediction includes:
- **Half-time score** (e.g., "1:0")
- **Full-time score** (e.g., "2:1")
- **Next goal scorer** (e.g., "Home,Salah")
- **Corner count** (e.g., "7:4")
- **Key players** with form-based reasoning

## External Endpoints

- Host: `ru7m5svay1.execute-api.eu-central-1.amazonaws.com`
- Path: `/prod/mcp`
- Method: `POST` (JSON-RPC)
- Data sent: league, optional matchweek, optional team filters

## Security & Privacy

- This skill does not install software.
- This skill does not execute downloaded scripts.
- No API key required (public endpoint, rate-limited)
- No user data collected or stored
- Read-only: only fetches prediction data
- No secrets or environment variables needed

## Links
iOS App: https://apps.apple.com/app/footballbin/id6757111871
Android App: https://play.google.com/store/apps/details?id=com.achan.footballbinandroid
