#!/usr/bin/env python3
"""Quality-Kernel evidence-gate (G2) - v0, log-mode.

PostToolUse hook on Bash. Records the exit code and timestamp of test / build /
verify commands to a per-project ledger (.quality-kernel/evidence-ledger.jsonl),
so that a "done / fixed / passing" claim can later be checked against a real
verification event that is newer than the last edit.

Scope of v0: it RECORDS evidence. Hard-blocking a turn on an unverified completion
claim is future work - a PostToolUse hook cannot see the assistant's prose, so the
enforcement lives (for now) in the adversarial-critic's score cap and in the
/forge evidence-gate step. This hook builds the ledger that makes that real.

Fail-open: any error -> record nothing, never block.
"""
import json
import os
import pathlib
import re
import sys
import time

VERIFY_RE = re.compile(
    r"\b(pytest|vitest|jest|mocha|mutmut|stryker|cosmic-ray|tsc|eslint|jscpd|"
    r"node\s+--test|go\s+test|cargo\s+(test|build)|coverage|nyc|npm\s+(run\s+)?(test|build|lint))\b",
    re.IGNORECASE,
)


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    if data.get("tool_name") != "Bash":
        sys.exit(0)

    try:
        tool_input = data.get("tool_input") or {}
        command = str(tool_input.get("command", ""))
        if not VERIFY_RE.search(command):
            sys.exit(0)

        response = data.get("tool_response")
        exit_code = "unknown-schema"  # sentinel: makes a schema mismatch discoverable
        if isinstance(response, dict):
            for key in ("exit_code", "exitCode", "returncode", "code"):
                if response.get(key) is not None:  # present-but-null is treated as missing
                    exit_code = response.get(key)
                    break
            else:
                print(
                    "[quality-kernel] evidence-gate: PostToolUse response had no usable "
                    "exit-code key (exit_code/exitCode/returncode/code, ignoring null "
                    "values); recording 'unknown-schema'.",
                    file=sys.stderr,
                )
        else:
            print(
                "[quality-kernel] evidence-gate: PostToolUse tool_response was not a dict "
                f"({type(response).__name__}); recording 'unknown-schema'.",
                file=sys.stderr,
            )

        cwd = data.get("cwd") or os.getcwd()
        ledger_dir = pathlib.Path(cwd) / ".quality-kernel"
        ledger_dir.mkdir(exist_ok=True)
        record = {
            "ts": round(time.time(), 3),
            "command": command[:300],
            "exit": exit_code,
        }
        with open(ledger_dir / "evidence-ledger.jsonl", "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record) + "\n")
    except Exception as err:  # never block in v0, but make breakage observable
        print(f"[quality-kernel] evidence-gate: recorder error (fail-open): {err}", file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
