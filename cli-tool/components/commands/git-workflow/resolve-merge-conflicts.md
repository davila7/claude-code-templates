# Resolve Merge Conflicts

Intelligently detect, analyze, and resolve Git merge and rebase conflicts across conflicting files without losing intended changes.

## Objective
Safely resolve Git merge conflicts by understanding the developer intent from both incoming (`HEAD`) and current branches, removing conflict markers, and verifying code integrity.

## Trigger
Use `/resolve-merge-conflicts` whenever a merge, rebase, or cherry-pick results in conflict markers.

## Instructions for Claude

When the user runs `/resolve-merge-conflicts`:

1. **Locate Conflicted Files**:
   - Run `git status --porcelain` to identify all files marked as unmerged (`UU`, `AA`, etc.).
   - Report the list of conflicted files to the user before editing.

2. **Analyze Conflict Markers**:
   - Scan each conflicted file for standard Git conflict markers:
     - `<<<<<<<` (Current change)
     - `=======` (Boundary)
     - `>>>>>>>` (Incoming change)
   - Read the surrounding context (functions, imports, variable scopes) to understand why the conflict occurred.

3. **Synthesize Resolution**:
   - **Both Additions**: If both branches added non-competing code (e.g., new functions or distinct imports), merge both cleanly.
   - **Competing Edits**: Retain the latest business logic while preserving necessary type definitions and bug fixes from both sides.
   - **Never Blindly Overwrite**: Do not discard one side entirely unless explicitly instructed by the user.

4. **Clean & Validate**:
   - Ensure all `<<<<<<<`, `=======`, and `>>>>>>>` markers are 100% removed.
   - Run linter/compiler checks (e.g., `npm run lint`, `tsc --noEmit`, or `cargo check`) to ensure the resolution didn't introduce syntax or typing errors.
   - Run relevant test suites to verify that existing behavior remains intact.

5. **Stage & Report**:
   - Stage the resolved files with `git add <file>`.
   - Provide a concise summary explaining what was merged from each branch.

## Safety Rules
- [x] Never delete files during conflict resolution without confirmation.
- [x] Run `git diff --check` to verify zero leftover conflict markers.
- [x] Prompt the user if a conflict represents a fundamental architectural collision.
