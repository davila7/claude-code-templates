# Figma MCP config reference

Use this snippet to register the Figma MCP server in `~/.codex/config.toml` as a streamable HTTP server with bearer auth pulled from your env.

```toml
[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_OAUTH_TOKEN"
http_headers = { "X-Figma-Region" = "us-east-1" }
```

## Notes and options
- The bearer token must be available as `FIGMA_OAUTH_TOKEN` in the environment that launches Codex.
- Keep the region header aligned with your Figma region. If your org uses another region, update `X-Figma-Region` consistently.
- OAuth on streamable HTTP requires the RMCP client: set `[features].rmcp_client = true` (or `experimental_use_rmcp_client = true` on older builds) at the top level of `config.toml`.
- Optional per-server timeouts: `startup_timeout_sec` (default 10) and `tool_timeout_sec` (default 60) can be set inside `[mcp_servers.figma]` if needed.

## Env var setup (if missing)
- One-time set for current shell: `export FIGMA_OAUTH_TOKEN="<token>"`
- Persist for future sessions: add the export line to your shell profile (e.g., `~/.zshrc` or `~/.bashrc`), then restart the shell or your IDE.
- Verify before launching Codex: `echo $FIGMA_OAUTH_TOKEN` should print a non-empty token.

## Setup + verification checklist
- Add the snippet above to `~/.codex/config.toml` under `[mcp_servers.figma]`, and enable `[features].rmcp_client = true` (or `experimental_use_rmcp_client = true` on older releases).
- Restart Codex (CLI/IDE) after updating config and env vars.
- Ask Codex to list Figma tools or run a simple call to confirm the server is reachable.

## Troubleshooting
- Token not picked up: Export `FIGMA_OAUTH_TOKEN` in the same shell that launches Codex, or add it to your shell profile and restart.
- OAuth errors: Verify `rmcp_client` is enabled and the bearer token is valid. Tokens copied from Figma should not include surrounding quotes.
- Network/headers: Keep the `X-Figma-Region` header; if your org uses another region, update the header consistently across config and requests.

## Usage reminders
- The server is link-based: copy the Figma frame or layer link, then ask the MCP client to implement that URL. The client will extract the node ID from the link (it does not browse the page).
- If output feels generic, restate the project-specific rules from the main skill and ensure you follow the required flow (get_design_context → get_metadata if needed → get_screenshot).
