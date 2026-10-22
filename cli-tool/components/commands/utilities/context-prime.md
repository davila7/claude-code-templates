---
description: "Read README.md, THEN run git ls-files | grep -v -f (sed 's|^|^|; s|$|/|' .cursorignore | psub) to understand the context of the project"
allowed-tools: Read, Bash, Bash(git:*)

---

Read README.md, THEN run `git ls-files | grep -v -f (sed 's|^|^|; s|$|/|' .cursorignore | psub)` to understand the context of the project
