#!/bin/bash
# dos-verify-gate.sh — Gate "I'm done" on ground truth, not the agent's word.
# Source: dos-kernel (https://github.com/anthony-chaudhary/dos-kernel)
# License: MIT
#
# Runs on Stop. Audits the latest commit's SUBJECT against its actual DIFF using
# the DOS kernel (`dos commit-audit`). A commit message is forgeable (whoever
# wrote it authored it); the files it touched are not (git did). So a `fix:` that
# only touched a README, or a "tests pass" that deleted the assertions, is caught
# here — before the agent declares the work done.
#
# `dos commit-audit` reports the verdict as its EXIT CODE (its documented
# contract): 0 = clean, 1 = an unwitnessed claim found, 2 = unreadable ref.
#
# DOS is deterministic: no API key, no LLM, no network. Install once with
#   pip install dos-kernel
#
# Advisory by default (exit 0 with a warning) so it never wedges a session. To
# make it BLOCK the stop on an unwitnessed claim, set DOS_VERIFY_GATE_BLOCK=1.

INPUT=$(cat)

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

# No DOS CLI installed → cannot adjudicate. Stay out of the way (advisory).
if ! command -v dos >/dev/null 2>&1; then
  exit 0
fi

# No commits yet → nothing to audit.
if ! git -C "$PROJECT_ROOT" rev-parse HEAD >/dev/null 2>&1; then
  exit 0
fi

# Ask the kernel: does HEAD's subject match what its diff actually did?
# The exit code is the verdict, so branch on it directly.
dos commit-audit --workspace "$PROJECT_ROOT" HEAD >/dev/null 2>&1
RC=$?

if [ "$RC" = "0" ]; then
  # Clean: the subject's claim is witnessed by its own diff. Stay silent.
  exit 0
fi

if [ "$RC" = "1" ]; then
  echo "⚠️  dos-verify-gate: HEAD's commit subject is NOT backed by its diff (CLAIM_UNWITNESSED)." >&2
  echo "    The 'done' claim is unproven — review the commit before treating the work as complete." >&2
  echo "    Inspect it with: dos commit-audit --workspace \"$PROJECT_ROOT\" HEAD" >&2
  if [ "${DOS_VERIFY_GATE_BLOCK:-0}" = "1" ]; then
    # Exit 2 asks the host to refuse the stop and surface the message to the agent.
    exit 2
  fi
  exit 0
fi

# RC=2 (unreadable ref) or any other nonzero: the audit could NOT run, so the
# claim is UNVERIFIED — not proven clean. Silently passing here would let a
# could-not-verify masquerade as a clean pass, which is exactly the failure this
# hook exists to catch. Surface it (always to stderr) but stay advisory: a
# can't-adjudicate is not an unwitnessed claim, so it never blocks the stop.
echo "⚠️  dos-verify-gate: could NOT audit HEAD (dos commit-audit exited $RC) — the 'done' claim is UNVERIFIED, not proven clean." >&2
echo "    Re-run to see why: dos commit-audit --workspace \"$PROJECT_ROOT\" HEAD" >&2
exit 0
