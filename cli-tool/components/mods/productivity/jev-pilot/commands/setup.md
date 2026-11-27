---
description: Hand skill selection to jev-pilot — hide every skill from the model's listing (user-invocable-only) so /context counts them at 0; "restore" undoes it
argument-hint: "[restore]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash(rm ~/.claude/jev-pilot.skill-overrides.backup.json)
---
Mode: $ARGUMENTS

If this text is all you can see, the jev-pilot plugin is not loaded: it rewrites this command at run time with the real list of skills and the exact settings change. Tell the user that jev-pilot needs Claude Code 2.1.278 or newer started with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` (the `claude-jev` launcher sets it), and, when it was installed into a project's `.claude/skills/`, a trusted project. Or it can be loaded explicitly with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir <path to the jev-pilot folder>`. Then run this command again. Do not edit any settings file.
