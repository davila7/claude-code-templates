---
description: Hand skill selection to jev-skill-suggestion — hide every skill from the model's listing (user-invocable-only) so /context counts them at 0; "restore" undoes it
argument-hint: "[restore]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash(rm ~/.claude/jev-skill-suggestion.skill-overrides.backup.json)
---
Mode: $ARGUMENTS

If this text is all you can see, the jev-skill-suggestion mod is not loaded: it rewrites this command at run time with the real list of skills and the exact settings change. Tell the user to start Claude Code with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` (Claude Code 2.1.278 or newer) in a trusted project, or with `--plugin-dir .claude/skills/jev-skill-suggestion`, and to run this command again. Do not edit any settings file.
