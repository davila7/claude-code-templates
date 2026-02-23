---
name: Manifest
description: Install and configure the Manifest observability plugin for your agents. Use when setting up telemetry, configuring API keys or endpoints, troubleshooting plugin connection issues, or verifying the observability pipeline is running.
---

# Manifest Setup

Set up real-time observability for your AI agents with the Manifest plugin. Monitors costs, tokens, messages, and performance via OTLP telemetry.

## When to Use This Skill

Use this skill when:
- Setting up observability or telemetry for an AI agent
- Connecting an agent to Manifest for cost and performance monitoring
- Configuring a Manifest API key or custom endpoint
- Troubleshooting Manifest plugin connection issues
- Verifying the Manifest observability pipeline is running

## Setup Instructions

Follow these steps **in order**. Do not skip ahead.

### Step 1 — Stop the Gateway

Stop the gateway first to avoid hot-reload issues during configuration.

```bash
claude gateway stop
```

### Step 2 — Install the Plugin

```bash
claude plugins install manifest
```

If it fails, check that the CLI is installed and available in the PATH.

### Step 3 — Get an API Key

Ask the user:

> To connect your agent, you need a Manifest API key:
>
> 1. Go to **https://app.manifest.build** and create an account (or sign in)
> 2. Click **"Connect Agent"** to create a new agent
> 3. Copy the API key that starts with `mnfst_`
> 4. Paste it here

Wait for a key starting with `mnfst_`. If the key doesn't match, tell the user the format looks incorrect and ask them to try again.

### Step 4 — Configure the Plugin

```bash
claude config set plugins.entries.manifest.config.apiKey "USER_API_KEY"
```

Replace `USER_API_KEY` with the actual key the user provided.

If the user has a custom endpoint (self-hosted):

```bash
claude config set plugins.entries.manifest.config.endpoint "USER_ENDPOINT"
```

The default endpoint (`https://app.manifest.build/api/v1/otlp`) is used automatically if none is specified.

### Step 5 — Start the Gateway

```bash
claude gateway install
```

### Step 6 — Verify

Wait 3 seconds for the gateway to fully start, then check the logs:

```bash
grep "manifest" ~/.claude/logs/gateway.log | tail -5
```

Look for:

```
[manifest] Observability pipeline active
```

If it appears, tell the user setup is complete. If not, check the error messages and troubleshoot.

## Troubleshooting

| Error | Fix |
|-------|-----|
| Missing apiKey | Re-run Step 4 with the correct key |
| Invalid apiKey format | Key must start with `mnfst_` |
| Connection refused | Endpoint is unreachable — check the URL or ask if self-hosting |
| Duplicate OTel registration | Disable the conflicting built-in plugin: `claude plugins disable diagnostics-otel` |

## Best Practices

- Always stop the gateway before making configuration changes
- The default endpoint works for most users — only change it if self-hosting
- API keys always start with `mnfst_` — any other format is invalid
- Never log or echo the API key in plain text after configuration
- Check gateway logs first when debugging any plugin issue
