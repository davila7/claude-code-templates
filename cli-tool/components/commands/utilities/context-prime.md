---
description: "Initialize a session by reading the README and the full file listing to load the project's context."
---

Read README.md, THEN run `git ls-files | grep -v -f (sed 's|^|^|; s|$|/|' .cursorignore | psub)` to understand the context of the project
