---
name: systematic-debugging
description: "You MUST use this whenever something is broken, before proposing or making any fix, including quick fixes and when the user is in a hurry: a bug, a failing or red test, a build or CI failure, a crash, a performance problem, unexpected behavior. Finds the root cause in four phases (investigate, compare, test one hypothesis, fix with a failing test first) instead of guessing, and stops after three failed fixes to question the design. Not for writing new features."
license: MIT
metadata:
  author: Jesse Vincent (obra/superpowers), adapted by claude-code-templates
  source: https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/systematic-debugging
  version: "2.0.0"
---

# Systematic Debugging

Guessing at fixes feels fast and is slow. Each guess that half-works hides
the real cause a little deeper, and the third patch usually breaks
something the first one touched. This skill makes you find out *why*
before you change anything.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you have not finished Phase 1, you cannot propose a fix. Not a "quick
one to try", not "while we investigate". Suggesting a fix in your reply
counts as proposing one.

The process scales. For a simple bug the four phases take a minute: read
the error, confirm the cause, write the failing check, fix it. You never
skip them, you just move through them quickly.

## When to use

Any technical problem: test failures, production bugs, unexpected
behavior, performance regressions, build or CI failures, integration
issues, flaky tests.

Use it **especially** when:
- There is time pressure (emergencies make guessing tempting)
- One quick fix looks obvious
- You or someone else already tried a fix that did not work
- You do not fully understand the issue

## Phase 1: Root cause investigation

Before attempting ANY fix:

1. **Read the error completely.** The whole message and stack trace, not
   the first line. Note file paths, line numbers and error codes. Errors
   often state the exact problem.

2. **Reproduce it.** Find the exact steps or command that trigger it, and
   check whether it happens every time. If you cannot reproduce it, gather
   more data (logs, instrumentation); do not guess.

3. **Check what changed.** `git diff`, recent commits, new dependencies,
   config and environment differences. If there is a known-good commit and
   a command that shows the bug, let git find the culprit:
   `git bisect start <bad> <good> && git bisect run <repro-command>`,
   then `git bisect reset` to return to your branch before you change
   anything.

4. **Gather evidence across component boundaries.** When the system has
   layers (CI → build → deploy, UI → API → database, CLI → config → child
   process), do not guess which layer breaks. Add temporary logging at each
   boundary, run once, and let the output show where good data turns bad:

   ```bash
   # Layer 1: CI job
   echo "API_TOKEN in job: $([ -n "${API_TOKEN:-}" ] && echo SET || echo UNSET)"
   # Layer 2: build script
   echo "config file: ${CONFIG_PATH:-<unset>}"; test -r "${CONFIG_PATH:-}" && echo readable
   # Layer 3: the service at startup
   node -e 'console.log("NODE_ENV=", process.env.NODE_ENV)'
   ```

   Log whether a secret is **set**, never its value. Then investigate the
   one layer the evidence points at.

5. **Trace the data backward.** When the error surfaces deep in a call
   stack, ask where the bad value came from, then what called *that*, and
   keep going until you reach the source. Fix at the source, not where it
   crashed. Full technique: `references/root-cause-tracing.md`.

**Done when** you can say what is wrong and why, backed by something you
observed, not something you assumed.

## Phase 2: Pattern analysis

1. **Find working code** in the same codebase that does something similar.
2. **Read the reference completely.** If you are following a pattern, a
   library's docs or an example, read every line before applying it.
   Skimming is how "I adapted it slightly" bugs are born.
3. **List every difference** between the working and the broken case,
   however small. Do not assume "that can't matter".
4. **Check dependencies:** the config, environment, versions and
   assumptions the broken code relies on.

## Phase 3: Hypothesis and testing

1. **State one hypothesis:** "X is the root cause because Y." Be specific.
2. **Test it with the smallest possible experiment:** a log line, a
   debugger check, or a temporary change. One variable at a time. Revert
   any code change once it has answered the question; the real fix comes
   in Phase 4, after the failing test.
3. **Check the result.** Confirmed: go to Phase 4. Not confirmed: form a
   new hypothesis from what you learned. Do not stack another change on top
   of a failed one; revert it first.
4. **When you don't know, say so.** "I don't understand X yet" is a valid
   status. Research more or ask the user instead of pretending.

## Phase 4: Implementation

1. **Write a failing test first.** The smallest reproduction you can
   automate: a unit test, or a one-off script if the project has no test
   framework. Run it and watch it fail for the reason you expect. If a
   `test-driven-development` skill is installed, follow it here.
2. **Make one fix** that addresses the root cause. No "while I'm here"
   improvements, no bundled refactors.
3. **Verify.** The new test passes, the existing tests still pass, and the
   original symptom is gone when you rerun the reproduction from Phase 1.
   If a `verification-before-completion` skill is installed, follow it
   before you claim success.
4. **Clean up** the temporary logging and scripts from Phase 1. Keep any
   check that would catch this bug earlier next time
   (`references/defense-in-depth.md` covers where to put them).
5. **If the fix did not work:** stop and count the attempts.
   - Fewer than 3: return to Phase 1 with what you just learned.
   - **3 or more: stop fixing.** Go to the next section.

### After three failed fixes: question the design

Signs the problem is the design, not a bug:
- Each fix reveals new shared state or coupling somewhere else
- Each fix needs a large refactor to work
- Each fix creates new symptoms in a different place

Do not attempt fix number four. Tell the user what you tried, what each
attempt revealed, and why you think the pattern itself is unsound, and
decide together whether to refactor or keep patching.

## Red flags: stop and return to Phase 1

If you catch yourself thinking or writing any of these:

- "Quick fix for now, investigate later"
- "Let me just try changing X and see"
- "I'll make a few changes and run the tests"
- "It's probably X, let me fix that"
- "I don't fully understand it, but this might work"
- "Here are the likely problems:" followed by fixes, with no investigation
- "One more attempt" after two have failed

And if the user says things like "Is that actually happening?", "Stop
guessing", "Will that show us anything?" or "Are we stuck?", you skipped
the evidence. Go back to Phase 1.

## Common rationalizations

| Excuse | Reality |
|--------|---------|
| "It's simple, I don't need the process" | Simple bugs have root causes too, and the process is fast for them. |
| "It's an emergency, no time" | Systematic debugging is faster than guess-and-check thrashing. |
| "I'll try this first, then investigate" | The first guess sets the pattern for every attempt after it. |
| "I'll add the test after the fix works" | A fix you never saw fail proves nothing. |
| "Several fixes at once saves time" | Then you cannot tell which one worked or which one broke something. |
| "I can see the problem" | Seeing the symptom is not understanding the cause. |

## When there is no root cause in the code

If the investigation shows the issue really is environmental, timing
dependent or external (a flaky network, a third-party outage):

1. Write down what you investigated and ruled out.
2. Add proper handling: retry with backoff, a timeout, a clear error message.
3. Add logging so the next occurrence leaves evidence.

Be suspicious of this conclusion: before accepting it, ask what you have
not checked yet, because an investigation that stopped early looks the
same from the inside. For flaky tests, check for race conditions first;
see `references/condition-based-waiting.md`.

## Reporting back

When you finish, tell the user in a few lines:
- **Root cause:** what was wrong and why, and the evidence that showed it
- **Fix:** what you changed and where
- **Proof:** the test that failed before and passes now, plus the suite result
- **Ruled out:** hypotheses you tested and discarded, if any

## Supporting files

- `references/root-cause-tracing.md`: trace a bad value backward through
  the call stack to the place it was created.
- `references/defense-in-depth.md`: add validation at several layers once
  the cause is fixed, so the same bug cannot come back silently.
- `references/condition-based-waiting.md` and
  `references/condition-based-waiting-example.ts`: replace arbitrary
  sleeps in tests with polling for the real condition.
- `scripts/find-polluter.sh`: run test files one by one to find which
  test creates an unwanted file or state. Run it from the project root
  with the path to this skill's copy, for example
  `bash .claude/skills/systematic-debugging/scripts/find-polluter.sh packages/core/.git 'src/**/*.test.ts'`
  (`TEST_CMD` sets the runner; default `npm test`).
