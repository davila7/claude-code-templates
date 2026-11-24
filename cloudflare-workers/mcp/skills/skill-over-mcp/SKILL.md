---
name: skill-over-mcp
description: Build an MCP server that serves skills (Skills over MCP, extension io.modelcontextprotocol/skills) with the official TypeScript SDK. Use when the user wants their MCP server to ship skills to Claude Code.
---

# Serve skills from an MCP server

Skills over MCP lets a server deliver skills next to its tools. Claude Code 2.1.331 or later lists them as `<server>:<skill>`, and the user runs one by asking Claude or by typing `/<server>:<skill>`.

## Steps

1. Put each skill in its own folder: `skills/<name>/SKILL.md`, plus any supporting files. The frontmatter needs `name` (equal to the folder name) and `description`.
2. Add `@modelcontextprotocol/server`, pinned to 2.4.0 or later. It ships the extension in `@modelcontextprotocol/server/ext/skills`; import it as in `references/server.md`.
3. Load the skills once with `SkillsExtension.load(...)` and call `attach(server)` on every server you create, before it connects. See `references/server.md`.
4. Serve protocol revision 2026-07-28: `serveStdio` for stdio, or `createMcpHandler` for Streamable HTTP. Older clients still connect; they see no skills.
5. Test with the official client pinned to `2026-07-28`: `skills/list` returns each skill with a sha256 digest per file, and `resources/read` returns `SKILL.md`.
6. Test in an interactive `claude` from a normal terminal: `/mcp` shows `Protocol: 2026-07-28` and `N skills`, and `/skills` lists them. `claude -p`, the Agent SDK and cloud sessions do not load MCP skills.

## Rules from Claude Code

- Up to 100 skills per server.
- In an MCP skill, Claude Code ignores `allowed-tools`, `hooks`, `model`, `effort`, `context`, `agent`, `paths`, `!` commands, `@` references and `${CLAUDE_PROJECT_DIR}`.
- Users can block or gate a server's skills with permission rules such as `Skill(mcp__<server>__*)`.
- A server can change its skills at any time, so users should add only servers they trust. Keep each version reviewable.
