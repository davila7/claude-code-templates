#!/usr/bin/env python3
"""Quality-Kernel epistemic guard (G1).

PreToolUse hook on Task/Agent spawns. Requires the epistemic-discipline marker in
the subagent prompt so every spawned agent inherits OBSERVED/INFERRED labeling,
probe-first behavior, and residual-risk-first reporting. Turns the discipline from
prose into a forcing function.

Modes (env QK_EPISTEMIC_MODE):
  "log"   (default) - warn on stderr, do NOT block. Use this to measure the
          [EXEMPT] rate before tightening (see quality-kernel README, phase F0).
  "block"           - block the spawn with exit 2 until the marker is present.

Fail-open: any internal error -> allow (exit 0). The guard must never block work
because of its own bug.
"""
import json
import os
import sys

MARKER = "[EPISTEMIC-DISCIPLINE v1]"
EXEMPT = "[EPISTEMIC-EXEMPT"


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # fail-open

    if data.get("tool_name") not in ("Task", "Agent"):
        sys.exit(0)

    tool_input = data.get("tool_input") or {}
    prompt = ""
    if isinstance(tool_input, dict):
        prompt = f"{tool_input.get('prompt', '')}{tool_input.get('description', '')}"

    if MARKER in prompt or EXEMPT in prompt:
        sys.exit(0)

    msg = (
        "[quality-kernel] epistemic guard: this agent spawn is missing the "
        f"'{MARKER}' marker. Prepend the epistemic-discipline preamble to the "
        "subagent prompt (label claims OBSERVED/INFERRED, probe-first when a live "
        "check costs <15 min, residual risk first), or add "
        f"'{EXEMPT}: <reason>]' for a trivial search/fetch spawn."
    )

    mode = os.environ.get("QK_EPISTEMIC_MODE", "log").lower()
    print(msg, file=sys.stderr)
    sys.exit(2 if mode == "block" else 0)


if __name__ == "__main__":
    main()
