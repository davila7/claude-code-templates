# PR Summary

Generate a concise pull request summary from the current branch diff.

## Instructions

1. Identify the base branch:

   ```bash
   git remote show origin | sed -n '/HEAD branch/s/.*: //p'
   ```

2. Review the changed files and commits:

   ```bash
   git diff --stat origin/<base>...HEAD
   git diff --name-status origin/<base>...HEAD
   git log --oneline origin/<base>..HEAD
   ```

3. Read the relevant diff:

   ```bash
   git diff origin/<base>...HEAD
   ```

4. Write this Markdown summary:

   ```markdown
   ## Summary
   - <user-facing change>
   - <implementation detail if important>

   ## Testing
   - <command run, or "Not run (reason)">

   ## Review Notes
   - <risk, migration, or follow-up reviewers should know>
   ```

Keep it factual. Do not invent tests, issue links, or impact not shown by the diff.
