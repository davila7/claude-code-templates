---
description: "Load project context from README and tracked files"
allowed-tools: Read, Bash, Bash(git:*)
---

Read README.md, THEN run `git ls-files | grep -v -f (sed 's|^|^|; s|$|/|' .cursorignore | psub)` to understand the context of the project
