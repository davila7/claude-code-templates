---
title: "Download Tracking Privacy"
summary: "Download tracking privacy is the CLI contract that install analytics are anonymous, opt-out, timed, and non-blocking."
topics: [concepts]
sources:
  - id: tracking-doc
    type: file
    path: cli-tool/docs_to_claude/DOWNLOAD_TRACKING.md
  - id: tracking-service
    type: file
    path: cli-tool/src/tracking-service.js
  - id: download-api
    type: file
    path: api/track-download-supabase.js
  - id: command-api
    type: file
    path: api/track-command-usage.js
  - id: claude-api-notes
    type: file
    path: CLAUDE.md
---

# Download Tracking Privacy

Download tracking privacy is the rule that component and CLI usage analytics must not block installs, must respect opt-out flags, and should collect only operational metadata needed for public usage statistics. The CLI implements tracking as fire-and-forget requests with a five-second timeout, and disables it when `CCT_NO_TRACKING=true`, `CCT_NO_ANALYTICS=true`, or `CI=true` [@tracking-service]. This matters because every install path in the [Component System](component-system) can call analytics, but telemetry failure must not change whether a component installs.

## What The CLI Sends

The download tracking service builds a payload with event type, component type, component name, timestamp, generated session id, Node version, platform, CPU architecture, CLI version, and caller-supplied metadata [@tracking-service]. Before sending to the download endpoint, it narrows that payload to `type`, `name`, `path`, `category`, and `cliVersion` [@tracking-service]. The documentation describes the intended data as anonymous component type, component name, category, timestamp, platform, CLI version, and country code [@tracking-doc].

The documentation also states what the system should not collect: personal identifying information, usernames, full file paths, project contents, tokens, or credentials [@tracking-doc]. The implementation reflects part of that boundary by sending a relative target directory when component installers include `target_directory`, rather than reading project contents [@tracking-service].

## Opt-Out And Failure Behavior

Tracking is enabled by default, but the service checks opt-out environment variables before sending anything [@tracking-service]. It also disables tracking in CI by checking `CI=true` [@tracking-service]. When tracking is enabled, requests are sent asynchronously and errors are swallowed unless `CCT_DEBUG=true` is set [@tracking-service]. The service uses `AbortController` with a five-second timeout for download, command, and installation-outcome tracking requests [@tracking-service].

That behavior is the privacy and reliability contract: tracking may help maintainers understand usage, but it is not part of the install's correctness. A network error, timeout, or endpoint failure should not break a user's component installation [@tracking-service].

## Backend Surfaces

The repository guidance marks `/api/track-download-supabase` as a critical API endpoint used by the CLI on every installation, with Supabase as the `component_downloads` database backend [@claude-api-notes]. The API accepts only `POST` requests, validates that `type` and `name` are present, limits valid component types to agents, commands, settings, hooks, MCPs, skills, and templates, and rejects names longer than 255 characters [@download-api]. It stores component type, name, path, category, user agent, IP address, country, CLI version, and timestamps in Supabase, then attempts to upsert aggregate download stats [@download-api].

Command usage tracking is separate. The CLI sends command execution payloads to `/api/track-command-usage`, and that endpoint validates command names against an allowlist such as `chats`, `analytics`, `health-check`, `plugins`, `sandbox`, `agents`, stats commands, and `skills-manager` [@tracking-service] [@command-api]. The command endpoint writes command name, CLI version, Node version, platform, architecture, session id, and metadata to Neon [@command-api].

## Important Tension

The tracking documentation says the system does not collect personal identifying information, while the download API stores IP address and user agent alongside country and component metadata [@tracking-doc] [@download-api]. Treat the code as the source of truth for current behavior. The privacy concept in this repo is therefore best understood as an opt-out, non-blocking telemetry contract with a documented goal of anonymity, plus backend fields that should be considered when changing retention, disclosure, or API behavior [@tracking-service] [@download-api].
