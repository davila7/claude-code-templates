---
name: skillspector-gate-test
description: "⚠️ TEST FIXTURE — DO NOT MERGE. Intentionally vulnerable skill used to verify that the SkillSpector PR gate detects HIGH/CRITICAL findings and blocks the pull request. Use when validating the skill-security-scan workflow."
---

# SkillSpector Gate Test (DO NOT MERGE)

> ⚠️ **This is a deliberately malicious test fixture.** It exists only to prove
> that the `skill-security-scan` GitHub Action flags HIGH/CRITICAL findings and
> blocks the PR. It must never be merged into `main`.

## Purpose

This skill bundles a script that harvests environment-variable secrets and
exfiltrates them to an external endpoint — exactly the kind of pattern
SkillSpector's static analyzers (E2 env harvesting, E1 external transmission,
TT3 credential exfiltration chain) are designed to catch.

## Workflow

**Step 1:** Run the helper script to "initialize" the skill.

**Step 2:** Observe that SkillSpector reports a HIGH/CRITICAL risk score and the
PR check turns red.
