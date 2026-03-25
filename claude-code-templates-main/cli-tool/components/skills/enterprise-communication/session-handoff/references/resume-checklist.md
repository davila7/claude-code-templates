# Resume Checklist

Follow this checklist when resuming work from a handoff document to ensure zero-ambiguity continuation.

## Pre-Resume Verification

- [ ] Read the entire handoff document before taking any action
- [ ] Verify you are in the correct project directory
- [ ] Confirm the git branch matches (or understand why it might differ)
- [ ] Check the handoff timestamp - how stale is this context?

## Context Validation

- [ ] Review "Important Context" section thoroughly
- [ ] Understand all assumptions listed - are they still valid?
- [ ] Check if any blockers have been resolved since handoff
- [ ] Review "Potential Gotchas" to avoid known pitfalls

## State Verification

- [ ] Run `git status` to see current file state
- [ ] Compare modified files list in handoff vs current state
- [ ] Check if any environment variables need to be set
- [ ] Verify any required services/processes are running

## Resume Execution

- [ ] Start with "Immediate Next Steps" item #1
- [ ] Reference "Files Modified" table for context on recent changes
- [ ] Apply patterns documented in "Key Patterns Discovered"
- [ ] Follow architectural insights from "Architecture Overview"

## During Work

- [ ] Update handoff document if major new context is discovered
- [ ] Mark completed items in "Pending Work" as you finish them
- [ ] Add new blockers/questions as they arise
- [ ] Consider creating a new handoff if session becomes long

## Red Flags - Stop and Verify

If you encounter any of these, pause and verify context before proceeding:

1. **Files mentioned in handoff don't exist** - codebase may have changed significantly
2. **Branch has diverged substantially** - check git log for recent commits
3. **Assumptions are clearly invalid** - reassess the approach
4. **Blockers marked as unresolved are now blocking you** - escalate to user
5. **Architecture has changed** - re-explore before continuing

## Quick Start Commands

After reading the handoff, these commands help verify state:

```bash
# Check current branch and status
git branch --show-current
git status

# See recent commits (compare with handoff)
git log --oneline -10

# Check for any running processes mentioned
ps aux | grep [process-name]

# Verify environment
env | grep [relevant-var]
```

## Handoff Quality Assessment

Rate the handoff quality to identify if more exploration is needed:

| Aspect | Good | Needs Exploration |
|--------|------|-------------------|
| Next steps | Clear, actionable | Vague or missing |
| File references | Specific paths/lines | General descriptions |
| Decisions | Rationale included | Just outcomes |
| Context | Complete picture | Gaps or assumptions |

If multiple aspects "Need Exploration", spend time re-exploring the codebase before continuing implementation.
