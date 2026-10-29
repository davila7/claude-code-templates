---
name: update
description: Update the clawd-actor mod (Clawd acting above the prompt) to its latest release. Use when the user runs /clawd-actor:update or asks to update, upgrade or refresh clawd-actor, Clawd's animations or "the Clawd mod".
user-invocable: true
allowed-tools:
  - Bash(claude plugin list*)
  - Bash(claude plugin marketplace update clawd-actor*)
  - Bash(claude plugin update clawd-actor@clawd-actor*)
  - WebFetch(domain:api.github.com)
---

# Update clawd-actor

Claude Code's own plugin manager does the update; nothing is downloaded by hand.

1. Note the installed version and scope: `claude plugin list`, the `clawd-actor@clawd-actor` entry.
   If there is none, clawd-actor was not installed from its marketplace; say so and stop here:
   - `clawd-actor@skills-dir` is a copy in a `skills` folder (claude-code-templates installs it
     there) and does not update itself: to get the latest, delete that folder and install from the
     marketplace with `/plugin marketplace add BrianHuang813/clawd-actor` then
     `/plugin install clawd-actor@clawd-actor`.
   - Loaded with `--plugin-dir` from a clone: `git pull` in that folder updates it.
2. Refresh the catalog: `claude plugin marketplace update clawd-actor`.
3. Update: `claude plugin update clawd-actor@clawd-actor`, adding `--scope <scope>` when step 1
   showed a scope other than `user`.
4. Report in one or two lines: the version before and after, or that it was already the latest.
   After an update, tell the user to run `/reload-plugins` (or restart Claude Code) to load it.
5. After an update, say what is new: fetch
   `https://api.github.com/repos/BrianHuang813/clawd-actor/releases?per_page=20` and sum up, in a few
   short bullets, the releases past the old version up to the new one (their `name` and `body`),
   ending with https://github.com/BrianHuang813/clawd-actor/releases. If the fetch fails, give just
   that link.

If a command fails, show its error as is and stop; do not retry with other flags.
