# Claude Code Environment Variables Reference

Source: [code.claude.com/docs/en/env-vars](https://code.claude.com/docs/en/env-vars)
Last synced: 2026-05-05

This guide lists every environment variable Claude Code recognizes, grouped by category, and flags which ones are **new** (not yet referenced anywhere in this repository's components, settings, or code).

A variable is marked **NEW** when no file under `cli-tool/`, `dashboard/`, `docs/`, `api/`, or `scripts/` mentions it.

## Summary

- **Total documented variables**: ~138
- **Already known to this repo** (referenced somewhere): 24
- **New / not yet covered**: 110+

The repo currently exposes only a small subset through its `cli-tool/components/settings/environment/` settings (bash timeouts, telemetry, terminal title, nonessential traffic). The vast majority of Claude Code's surface — plugin caches, OAuth tokens, IDE integration, file checkpointing, agent teams, Foundry/Azure auth, mTLS, fast mode, 1M context, adaptive thinking, etc. — is undocumented here.

---

## Already referenced in this repo (24)

```
ANTHROPIC_API_KEY                          ANTHROPIC_AUTH_TOKEN
ANTHROPIC_BASE_URL                         ANTHROPIC_CUSTOM_HEADERS
ANTHROPIC_DEFAULT_HAIKU_MODEL              ANTHROPIC_DEFAULT_OPUS_MODEL
ANTHROPIC_DEFAULT_SONNET_MODEL             ANTHROPIC_MODEL
ANTHROPIC_SMALL_FAST_MODEL  [DEPRECATED]   ANTHROPIC_VERTEX_PROJECT_ID
AWS_BEARER_TOKEN_BEDROCK                   BASH_DEFAULT_TIMEOUT_MS
BASH_MAX_OUTPUT_LENGTH                     BASH_MAX_TIMEOUT_MS
CLAUDECODE                                 CLAUDE_CODE_API_KEY_HELPER_TTL_MS
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC   CLAUDE_CODE_DISABLE_TERMINAL_TITLE
CLAUDE_CODE_ENABLE_TELEMETRY               CLAUDE_CODE_MAX_OUTPUT_TOKENS
CLAUDE_CODE_REMOTE                         CLAUDE_CODE_USE_BEDROCK   [legacy]
CLAUDE_CODE_USE_VERTEX  [legacy]           MAX_MCP_OUTPUT_TOKENS
```

### Inconsistency to fix

`cli-tool/components/skills/development/claude-api/php/claude-api.md:48` calls `getenv('ANTHROPIC_FOUNDRY_AUTH_TOKEN')`, but that name is not in the official docs. The correct official variable is **`ANTHROPIC_FOUNDRY_API_KEY`**.

---

## NEW variables not yet covered by this repo

### API & Authentication (1)
| Variable | Description |
|---|---|
| `ANTHROPIC_BETAS` | Comma-separated `anthropic-beta` header values. |

### Bedrock / AWS (5)
| Variable | Description |
|---|---|
| `ANTHROPIC_BEDROCK_BASE_URL` | Override Bedrock endpoint. |
| `ANTHROPIC_BEDROCK_MANTLE_BASE_URL` | Override Bedrock Mantle endpoint. |
| `ANTHROPIC_BEDROCK_SERVICE_TIER` | `default` / `flex` / `priority`. |
| `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION` | Region override for the Haiku-class background model. |
| `CLAUDE_CODE_SKIP_BEDROCK_AUTH` | Skip AWS auth (proxy/gateway scenarios). |

### Vertex AI / Google (2)
| Variable | Description |
|---|---|
| `ANTHROPIC_VERTEX_BASE_URL` | Override Vertex AI endpoint. |
| `CLAUDE_CODE_SKIP_VERTEX_AUTH` | Skip Google auth. |

### Microsoft Foundry / Azure (4) — **brand new provider**
| Variable | Description |
|---|---|
| `ANTHROPIC_FOUNDRY_API_KEY` | API key for Microsoft Foundry. |
| `ANTHROPIC_FOUNDRY_BASE_URL` | Full base URL for the Foundry resource. |
| `ANTHROPIC_FOUNDRY_RESOURCE` | Foundry resource name. |
| `CLAUDE_CODE_SKIP_FOUNDRY_AUTH` | Skip Azure auth. |

### Model picker customization (13) — **new in 4.6/4.7**
| Variable | Description |
|---|---|
| `ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME` / `_DESCRIPTION` / `_SUPPORTED_CAPABILITIES` | Override Haiku entry in the model picker. |
| `ANTHROPIC_DEFAULT_SONNET_MODEL_NAME` / `_DESCRIPTION` / `_SUPPORTED_CAPABILITIES` | Override Sonnet entry. |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` / `_DESCRIPTION` / `_SUPPORTED_CAPABILITIES` | Override Opus entry. |
| `ANTHROPIC_CUSTOM_MODEL_OPTION` | Add a custom model ID to the picker. |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_NAME` / `_DESCRIPTION` / `_SUPPORTED_CAPABILITIES` | Display metadata for the custom option. |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Pin the subagent model. |

### Bash & shell (3)
| Variable | Description |
|---|---|
| `CLAUDE_CODE_SHELL` | Override automatic shell detection. |
| `CLAUDE_CODE_SHELL_PREFIX` | Wrapper command for every shell invocation. |
| `CLAUDE_CODE_GIT_BASH_PATH` | Windows-only path to Git Bash `bash.exe`. |

### Timeouts & performance (8)
| Variable | Description |
|---|---|
| `API_TIMEOUT_MS` | API request timeout (default 600000). |
| `CLAUDE_CODE_MAX_RETRIES` | Retries on failed API requests (default 10). |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | Parallel read-only tools/subagents (default 10). |
| `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` | Token limit per file read. |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | Override assumed context window. |
| `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` | Git timeout for plugin operations. |
| `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` | Time budget for SessionEnd hooks. |
| `CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS` | Synchronous plugin install timeout. |

### Context & compaction (2)
| Variable | Description |
|---|---|
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | Auto-compaction trigger percent (1-100, default ~95). |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | Override context size used in compaction math. |

### OAuth & credentials (3) — **new auth flow**
| Variable | Description |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude.ai OAuth access token. |
| `CLAUDE_CODE_OAUTH_REFRESH_TOKEN` | Claude.ai OAuth refresh token. |
| `CLAUDE_CODE_OAUTH_SCOPES` | Space-separated OAuth scopes. |

### Thinking & reasoning (4) — **new for 4.6/4.7**
| Variable | Description |
|---|---|
| `CLAUDE_CODE_DISABLE_THINKING` | Force-disable extended thinking. |
| `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` | Disable adaptive reasoning on Opus/Sonnet 4.6. |
| `MAX_THINKING_TOKENS` | Fixed thinking budget (`0` to disable). |
| `CLAUDE_CODE_EFFORT_LEVEL` | `low` / `medium` / `high` / `xhigh` / `max` / `auto`. |

### Feature toggles — DISABLE_* / ENABLE_* (24)
| Variable | Description |
|---|---|
| `CLAUDE_CODE_DISABLE_ATTACHMENTS` | Disable attachment processing. |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | Disable auto memory. |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | Disable background tasks. |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | Don't load `CLAUDE.md` files. |
| `CLAUDE_CODE_DISABLE_CRON` | Disable scheduled tasks. |
| `CLAUDE_CODE_DISABLE_FAST_MODE` | **NEW** — disable Opus 4.6 fast mode. |
| `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` | Skip session quality surveys. |
| `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING` | Disable rewind/file checkpointing. |
| `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` | Strip built-in git workflow instructions. |
| `CLAUDE_CODE_DISABLE_LEGACY_MODEL_REMAP` | Don't remap retired Opus 4.0/4.1. |
| `CLAUDE_CODE_DISABLE_MOUSE` | Disable mouse tracking in fullscreen. |
| `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK` | Don't fall back to non-streaming on errors. |
| `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL` | Skip official plugin marketplace. |
| `CLAUDE_CODE_DISABLE_POLICY_SKILLS` | Skip system-managed skills. |
| `CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL` | Disable virtual scroll in fullscreen. |
| `CLAUDE_CODE_DISABLE_1M_CONTEXT` | **NEW** — opt out of 1M-token context window. |
| `CLAUDE_CODE_ENABLE_BACKGROUND_PLUGIN_REFRESH` | Refresh plugin state after background install. |
| `CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING` | Force fine-grained tool input streaming. |
| `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION` | Toggle prompt suggestions. |
| `CLAUDE_CODE_ENABLE_TASKS` | Task tracking in non-interactive mode. |
| `CLAUDE_CODE_ENABLE_AWAY_SUMMARY` | Show one-line recap on return. |
| `CLAUDE_CODE_ENABLE_EXPERIMENTAL_BETAS` | Strip beta headers from API requests. |

### Plugins, memory & files (6)
| Variable | Description |
|---|---|
| `CLAUDE_CODE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` | Load `CLAUDE.md` from `--add-dir` paths. |
| `CLAUDE_CODE_PLUGIN_CACHE_DIR` | Override plugins root (`~/.claude/plugins`). |
| `CLAUDE_CODE_PLUGIN_SEED_DIR` | Read-only plugin seed dirs (`:` / `;` separated). |
| `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` | Keep marketplace cache when git pull fails. |
| `CLAUDE_CODE_TMPDIR` | Override temp dir for internal files. |
| `CLAUDE_CODE_SKIP_PROMPT_HISTORY` | Disable transcript writes. |

### UI & display (6)
| Variable | Description |
|---|---|
| `CLAUDE_CODE_NO_FLICKER` | Fullscreen rendering (research preview). |
| `CLAUDE_CODE_HIDE_CWD` | Hide cwd in startup logo. |
| `CLAUDE_CODE_CODE_ACCESSIBILITY` | Keep native cursor, no inverted cursor. |
| `CLAUDE_CODE_SCROLL_SPEED` | Mouse wheel multiplier (1-20). |
| `CLAUDE_CODE_SYNTAX_HIGHLIGHT` | Disable syntax highlighting in diffs. |
| `CLAUDE_CODE_TMUX_TRUECOLOR` | 24-bit truecolor in tmux. |

### IDE integration (4)
| Variable | Description |
|---|---|
| `CLAUDE_CODE_AUTO_CONNECT_IDE` | Override automatic IDE connection. |
| `CLAUDE_CODE_IDE_HOST_OVERRIDE` | Override IDE host address. |
| `CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL` | Skip IDE extension auto-install. |
| `CLAUDE_CODE_IDE_SKIP_VALID_CHECK` | Skip IDE lockfile validation. |

### File operations & glob (5)
| Variable | Description |
|---|---|
| `CLAUDE_CODE_GLOB_HIDDEN` | Include dotfiles in Glob (`false` to exclude). |
| `CLAUDE_CODE_GLOB_NO_IGNORE` | Respect `.gitignore` (`false` to respect). |
| `CLAUDE_CODE_GLOB_TIMEOUT_SECONDS` | Glob timeout (default 20s, 60s on WSL). |
| `CLAUDE_CODE_PERFORCE_MODE` | Perforce-aware write protection. |
| `CLAUDE_CODE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | Return to project cwd after each command. |

### Streaming & headers (2)
| Variable | Description |
|---|---|
| `CLAUDE_CODE_EXTRA_BODY` | JSON merged into every API request body. |
| `CLAUDE_CODE_ATTRIBUTION_HEADER` | Toggle attribution block in system prompt. |

### TLS / mTLS / proxy (5)
| Variable | Description |
|---|---|
| `CLAUDE_CODE_CERT_STORE` | `bundled`, `system`, or both. |
| `CLAUDE_CODE_CLIENT_CERT` | mTLS client certificate path. |
| `CLAUDE_CODE_CLIENT_KEY` | mTLS client key path. |
| `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE` | mTLS client key passphrase. |
| `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` | Let proxy do DNS resolution. |

### Debug & telemetry (5)
| Variable | Description |
|---|---|
| `CLAUDE_CODE_DEBUG_LOGS_DIR` | Debug log file path (yes, despite the name). |
| `CLAUDE_CODE_DEBUG_LOG_LEVEL` | `verbose` / `debug` / `info` / `warn` / `error`. |
| `CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS` | Timeout for flushing OTel spans (default 5000). |
| `CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS` | Refresh interval for dynamic OTel headers (~29 min). |
| `CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS` | OTel exporter shutdown timeout (default 2000). |

### Cloud & remote sessions (2)
| Variable | Description |
|---|---|
| `CLAUDE_CODE_REMOTE_SESSION_ID` | Cloud session ID (set automatically). |
| `CCR_FORCE_BUNDLE` | Force bundling local repo even with GitHub access. |

### Subagents & teams (4) — **experimental**
| Variable | Description |
|---|---|
| `CLAUDE_CODE_FORK_SUBAGENT` | Forked subagents inherit conversation context. |
| `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS` | Disable built-in subagent types (SDK, `-p` only). |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | **NEW** — enable agent teams. |
| `CLAUDE_CODE_TEAM_NAME` | **NEW** — team name for the current teammate. |

### MCP (2)
| Variable | Description |
|---|---|
| `CLAUDE_AGENT_SDK_MCP_NO_PREFIX` | Drop `mcp__<server>__` prefix on tool names. |
| `CLAUDE_CODE_MCP_ALLOWLIST_ENV` | Spawn stdio MCP servers with safe baseline env. |

### Session & execution (8)
| Variable | Description |
|---|---|
| `CLAUDE_CODE_SIMPLE` | Minimal system prompt + basic tools. |
| `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` | Shorter system prompt on Opus 4.7. |
| `CLAUDE_CODE_RESUME_INTERRUPTED_TURN` | Auto-resume sessions interrupted mid-turn. |
| `CLAUDE_CODE_EXIT_AFTER_STOP_DELAY` | Idle wait (ms) before auto-exit. |
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` | Strip credentials from subprocess envs. |
| `CLAUDE_CODE_SCRIPT_CAPS` | JSON limiting script invocations per session. |
| `CLAUDE_CODE_NEW_INIT` | Make `/init` use the new interactive flow. |
| `CLAUDE_CODE_TASK_LIST_ID` | Share a task list across sessions. |

### Background & provider (2)
| Variable | Description |
|---|---|
| `CLAUDE_AUTO_BACKGROUND_TASKS` | Force-enable background-task auto promotion. |
| `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` | Set by hosts managing provider routing. |

---

## Standard OpenTelemetry passthrough

Claude Code also passes through the standard OpenTelemetry env vars:
`OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER`, `OTEL_EXPORTER_OTLP_ENDPOINT`,
`OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_EXPORTER_OTLP_HEADERS`,
`OTEL_METRIC_EXPORT_INTERVAL`, `OTEL_RESOURCE_ATTRIBUTES`, plus signal-specific variants.

## Highlight: variables tied to recent (2025-2026) features

These are the most strategic additions:

- **Microsoft Foundry / Azure** provider: `ANTHROPIC_FOUNDRY_*`, `CLAUDE_CODE_SKIP_FOUNDRY_AUTH`
- **Fast mode** (Opus 4.6): `CLAUDE_CODE_DISABLE_FAST_MODE`
- **1M context**: `CLAUDE_CODE_DISABLE_1M_CONTEXT`
- **Adaptive thinking / effort tiers** (Opus/Sonnet 4.6, Opus 4.7): `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`, `CLAUDE_CODE_EFFORT_LEVEL`, `CLAUDE_CODE_DISABLE_THINKING`, `MAX_THINKING_TOKENS`
- **Agent teams (experimental)**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, `CLAUDE_CODE_TEAM_NAME`
- **Custom model picker**: `ANTHROPIC_DEFAULT_*_NAME/_DESCRIPTION/_SUPPORTED_CAPABILITIES`, `ANTHROPIC_CUSTOM_MODEL_OPTION*`, `CLAUDE_CODE_SUBAGENT_MODEL`
- **Plugin system**: `CLAUDE_CODE_PLUGIN_CACHE_DIR`, `CLAUDE_CODE_PLUGIN_SEED_DIR`, `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, `CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS`, `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL`, `CLAUDE_CODE_ENABLE_BACKGROUND_PLUGIN_REFRESH`
- **OAuth via Claude.ai**: `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_OAUTH_REFRESH_TOKEN`, `CLAUDE_CODE_OAUTH_SCOPES`
- **mTLS / cert store**: `CLAUDE_CODE_CERT_STORE`, `CLAUDE_CODE_CLIENT_CERT`, `CLAUDE_CODE_CLIENT_KEY`, `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE`
- **File checkpointing**: `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING`
- **Cloud sessions**: `CLAUDE_CODE_REMOTE_SESSION_ID`, `CCR_FORCE_BUNDLE`

---

## Suggested follow-ups for this repo

1. Update `cli-tool/components/settings/environment/*` with new presets covering the most-requested toggles (fast mode, 1M context, OAuth, plugin cache, mTLS, agent teams).
2. Mark `ANTHROPIC_SMALL_FAST_MODEL` references as **deprecated** in favor of `ANTHROPIC_DEFAULT_HAIKU_MODEL` + `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION`.
3. Fix `cli-tool/components/skills/development/claude-api/php/claude-api.md:48` — replace `ANTHROPIC_FOUNDRY_AUTH_TOKEN` with the official `ANTHROPIC_FOUNDRY_API_KEY`.
