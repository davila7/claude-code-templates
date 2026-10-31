---
description: "Load project context by reading README.md and listing the tracked files"
allowed-tools: Read, Bash, Bash(git:*)
---

Read README.md, THEN run `git ls-files | grep -v -f (sed 's|^|^|; s|$|/|' .cursorignore | psub)` to understand the context of the project
