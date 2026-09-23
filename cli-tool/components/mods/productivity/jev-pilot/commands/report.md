---
description: Show what jev-pilot decided on recent turns and what happened (raised efforts, timeouts, tokens), with suggested setting changes; "reset" clears the record
argument-hint: "[reset]"
disable-model-invocation: true
allowed-tools: Read, Edit
---
Mode: $ARGUMENTS

If this text is all you can see, the jev-pilot plugin is not loaded: it rewrites this command at run time with the report. Tell the user to start Claude Code with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` and `--plugin-dir ~/Documents/GitHub/jev-pilot`, then run this command again. Do not edit any settings file.
