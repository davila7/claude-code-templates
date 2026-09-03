#!/usr/bin/env python3
"""Tests for the quality-kernel hooks (epistemic-guard, evidence-gate).

Run: python3 -m unittest discover -s plugins/quality-kernel/hooks -p 'test_*.py'
  or: python3 plugins/quality-kernel/hooks/test_hooks.py
"""
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
GUARD = HERE / "epistemic-guard.py"
GATE = HERE / "evidence-gate.py"
MARKER = "[EPISTEMIC-DISCIPLINE v1]"


def run(script, payload, env=None, cwd=None):
    proc = subprocess.run(
        [sys.executable, str(script)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        env={**os.environ, **(env or {})},
        cwd=cwd,
    )
    return proc.returncode, proc.stderr


class EpistemicGuard(unittest.TestCase):
    def test_non_agent_tool_passes(self):
        code, _ = run(GUARD, {"tool_name": "Bash", "tool_input": {"command": "ls"}})
        self.assertEqual(code, 0)

    def test_marker_present_passes(self):
        code, _ = run(GUARD, {"tool_name": "Task", "tool_input": {"prompt": f"{MARKER} do x"}})
        self.assertEqual(code, 0)

    def test_exempt_present_passes(self):
        code, _ = run(GUARD, {"tool_name": "Agent", "tool_input": {"prompt": "[EPISTEMIC-EXEMPT: quick fetch] go"}})
        self.assertEqual(code, 0)

    def test_missing_marker_log_mode_warns_but_passes(self):
        code, err = run(GUARD, {"tool_name": "Task", "tool_input": {"prompt": "no marker here"}})
        self.assertEqual(code, 0)
        self.assertIn("epistemic guard", err)

    def test_missing_marker_block_mode_blocks(self):
        code, _ = run(
            GUARD,
            {"tool_name": "Task", "tool_input": {"prompt": "no marker"}},
            env={"QK_EPISTEMIC_MODE": "block"},
        )
        self.assertEqual(code, 2)

    def test_agent_tool_name_is_covered(self):
        # regression for the pre-push HIGH finding: the guard must fire for "Agent" too
        code, _ = run(
            GUARD,
            {"tool_name": "Agent", "tool_input": {"prompt": "no marker"}},
            env={"QK_EPISTEMIC_MODE": "block"},
        )
        self.assertEqual(code, 2)

    def test_malformed_stdin_fails_open(self):
        proc = subprocess.run([sys.executable, str(GUARD)], input="{bad json", text=True, capture_output=True)
        self.assertEqual(proc.returncode, 0)


class EvidenceGate(unittest.TestCase):
    def _ledger(self, cwd):
        p = pathlib.Path(cwd) / ".quality-kernel" / "evidence-ledger.jsonl"
        return p.read_text().strip().splitlines() if p.exists() else []

    def test_non_bash_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            code, _ = run(GATE, {"tool_name": "Read", "tool_input": {}}, cwd=d)
            self.assertEqual(code, 0)
            self.assertEqual(self._ledger(d), [])

    def test_non_verify_command_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            code, _ = run(GATE, {"tool_name": "Bash", "tool_input": {"command": "ls -la"}}, cwd=d)
            self.assertEqual(code, 0)
            self.assertEqual(self._ledger(d), [])

    def test_verify_command_records_exit_code(self):
        with tempfile.TemporaryDirectory() as d:
            code, _ = run(
                GATE,
                {"tool_name": "Bash", "tool_input": {"command": "pytest -q"}, "tool_response": {"exit_code": 0}, "cwd": d},
                cwd=d,
            )
            self.assertEqual(code, 0)
            lines = self._ledger(d)
            self.assertEqual(len(lines), 1)
            rec = json.loads(lines[0])
            self.assertEqual(rec["exit"], 0)

    def test_node_test_runner_is_recorded(self):
        # regression: Node's built-in `node --test` runner must count as a verify command
        with tempfile.TemporaryDirectory() as d:
            code, _ = run(
                GATE,
                {"tool_name": "Bash", "tool_input": {"command": "node --test --experimental-test-coverage"}, "tool_response": {"exit_code": 0}, "cwd": d},
                cwd=d,
            )
            self.assertEqual(code, 0)
            lines = self._ledger(d)
            self.assertEqual(len(lines), 1)
            self.assertEqual(json.loads(lines[0])["exit"], 0)

    def test_unknown_schema_sentinel(self):
        with tempfile.TemporaryDirectory() as d:
            code, err = run(
                GATE,
                {"tool_name": "Bash", "tool_input": {"command": "npm run build"}, "tool_response": {"weird": 1}, "cwd": d},
                cwd=d,
            )
            self.assertEqual(code, 0)
            rec = json.loads(self._ledger(d)[0])
            self.assertEqual(rec["exit"], "unknown-schema")
            self.assertIn("unknown-schema", err)

    def test_present_but_null_exit_code_is_sentinel(self):
        with tempfile.TemporaryDirectory() as d:
            code, err = run(
                GATE,
                {"tool_name": "Bash", "tool_input": {"command": "pytest -q"}, "tool_response": {"exit_code": None}, "cwd": d},
                cwd=d,
            )
            self.assertEqual(code, 0)
            rec = json.loads(self._ledger(d)[0])
            self.assertEqual(rec["exit"], "unknown-schema")
            self.assertIn("unknown-schema", err)

    def test_non_dict_response_warns(self):
        with tempfile.TemporaryDirectory() as d:
            code, err = run(
                GATE,
                {"tool_name": "Bash", "tool_input": {"command": "pytest -q"}, "tool_response": "weird string", "cwd": d},
                cwd=d,
            )
            self.assertEqual(code, 0)
            rec = json.loads(self._ledger(d)[0])
            self.assertEqual(rec["exit"], "unknown-schema")
            self.assertIn("not a dict", err)

    def test_recorder_error_is_fail_open(self):
        # Point cwd at a *file* so mkdir('.quality-kernel') raises inside the try block.
        with tempfile.TemporaryDirectory() as d:
            not_a_dir = pathlib.Path(d) / "not-a-dir"
            not_a_dir.write_text("x")
            code, err = run(
                GATE,
                {"tool_name": "Bash", "tool_input": {"command": "pytest -q"}, "tool_response": {"exit_code": 0}, "cwd": str(not_a_dir)},
            )
            self.assertEqual(code, 0)
            self.assertIn("recorder error (fail-open)", err)


if __name__ == "__main__":
    unittest.main(verbosity=2)
