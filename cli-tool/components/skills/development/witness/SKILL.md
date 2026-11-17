---
name: witness
description: Proves that a coding task is actually complete instead of only claimed. Use at the start of a coding task to fix acceptance criteria with a human and capture a baseline, and before claiming the task is done to run deterministic checks. Also use when the user asks to verify an agent's work.
---

# Witness: evidence instead of "done"

## When to use

- **Before the work starts:** fix the acceptance criteria and capture a baseline, so the
  criteria cannot later be bent to fit the result.
- The agent finished a task and is about to say "done", "fixed", "passing".
- The user asks whether the feature really works.

## Hard rule

> Do not claim a task is complete until `witness run` exits 0 in the same message.
> Manual criteria (`skip`) do not count as proof.

If the check was not run, say "not verified", not "should work".

## Workflow

1. **Check the CLI.**
   ```bash
   witness --version
   ```
   If the command is missing, stop. Do not install anything and do not run a package
   manager: point the human to the install instructions in the project README and wait
   for them to confirm. Installing software is the human's decision, not the agent's.

2. **Initialise.**
   ```bash
   witness init
   ```
   If `.witness/` already exists, do not overwrite the settings.

3. **Acceptance criteria — with the human.**
   ```bash
   witness claim "<task>"
   ```
   Show the criteria and ask the human to approve them. **Do not use `--yes`** unless the
   human explicitly approved: the point of the product is that a human approves the criteria,
   not the model.

4. **Baseline before the work.**
   ```bash
   witness run --baseline
   ```
   The app must be running. For a non-default address use `--base-url http://127.0.0.1:<port>`.
   The baseline is what separates a real check from a tautology.

   **If the work already started or finished before this skill was loaded**, an honest
   baseline no longer exists. Say so explicitly, run the checks anyway, and report
   "no baseline: before/after comparison unavailable". Never run `--baseline` after the
   fact: that would present the finished app as the starting point and fake the differential.

5. **After the work.**
   ```bash
   witness run
   ```
   Read the `detail` of failed criteria and the `differential` block, not just the summary.

6. **Evidence.**
   ```bash
   witness report   # .witness/report.html
   witness badge    # .witness/badge.svg + badge.json
   ```

If the agent runs as a single command, use `witness wrap -- <command>`: it performs the work
and immediately runs the check. The agent's code matters more than the check's code.

## Forbidden

- Weakening criteria after a run, deleting checks, setting `required: false` just to get green.
- Running `--baseline` after the work to fabricate a before/after comparison.
- Treating `skip` (manual steps) as proof of completion.
- Checking a neighbouring route when the task names a different one.
- Summarising the agent's report instead of the `witness run` output.
- Saying "tests passed" when no run happened in that message.

## Response format

```
Verification: witness run → exit 0
Criteria: 4, machine-checked: 3, manual: 1
Passed: 3/3 machine checks
Tautologies: none
Report: .witness/report.html
```

If exit != 0:

```
Verification: witness run → exit 1
Failed:
- <criterion>: <detail>
Next step: <concrete action>
```

If the checks ran without a baseline, keep the same format and append
`(no baseline: before/after comparison unavailable)` to the verification line.

Reply in the language the user writes in.

## Boundaries

Witness checks only what the criteria say. It is not a code review, does not hunt for
vulnerabilities and does not judge code quality. A green badge means "the approved checks
passed", not "the product is good".
