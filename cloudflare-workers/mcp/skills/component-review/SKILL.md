---
name: component-review
description: Review a Claude Code component (agent, command, skill, hook, MCP server config or setting) before sharing it or sending it to aitmpl.com. Use when the user asks to check, review or validate a component file or folder.
---

# Review a Claude Code component

Review the component the user points to. If they name none, ask which file or folder.

1. Identify the type from the path and format:
   - `agents/*.md` or `commands/*.md`: Markdown with YAML frontmatter
   - a folder with `SKILL.md`: a skill
   - JSON with `hooks`: a hook; JSON with `mcpServers`: an MCP server config; other JSON: a setting
2. Read every file of the component. For a skill, read the supporting files too.
3. Go through `references/checklist.md` in order. Each item is a pass, a fail or not applicable.
4. Report:
   - one line with the verdict: ready, ready after fixes, or not ready
   - the failed items, most serious first, each with the file, the line and the fix
   - what the component runs on the user's machine, if anything (commands, scripts, packages)

Do not edit the files unless the user asks for the fixes.
