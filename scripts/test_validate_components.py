import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate_components  # noqa: E402

WARNING = "'metadata' must be a mapping (key: value pairs); got string. It is dropped at load time."


def fake_claude(path, strict):
    """What `claude plugin validate --json` (2.1.319) reports for a skill whose
    `metadata` is a string. With --strict the finding stays under "warnings" and
    only "success" turns false."""
    contents = [{"file": str(p), "type": "skill", "errors": [],
                 "warnings": [{"path": "metadata", "message": WARNING, "code": None}],
                 "notes": [], "gatingHooks": []}
                for p in sorted(Path(path).glob("skills/*/SKILL.md"))]
    return {"success": not (strict and contents), "strict": strict, "contents": contents}


ERROR = "Missing required field: description"


def fake_claude_with_an_error(path, strict):
    """The same skill, with an error next to the warning."""
    report = fake_claude(path, strict)
    for c in report["contents"]:
        c["errors"] = [{"path": "description", "message": ERROR, "code": None}]
    report["success"] = not report["contents"]
    return report


class StrictTest(unittest.TestCase):

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        base = Path(tmp.name) / "components"
        for t in ("agents", "commands", "hooks", "mcps"):
            (base / t).mkdir(parents=True)
        skill = base / "skills" / "development" / "demo"
        skill.mkdir(parents=True)
        (skill / "SKILL.md").write_text("---\nname: demo\ndescription: Demo skill\nmetadata: '{}'\n---\n")
        self.report = Path(tmp.name) / "report.json"
        stack = contextlib.ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(mock.patch.object(validate_components, "BASE", base))
        stack.enter_context(mock.patch.object(validate_components, "claude", fake_claude))
        stack.enter_context(mock.patch.object(validate_components.external_skills, "all_external_dirs", return_value=[]))
        stack.enter_context(mock.patch.object(validate_components.external_skills, "plugin_dirs", return_value=[]))

    def run_main(self, *flags):
        out = io.StringIO()
        argv = ["validate_components.py", "--report", str(self.report), *flags]
        with mock.patch.object(sys, "argv", argv), contextlib.redirect_stdout(out):
            code = validate_components.main()
        return code, out.getvalue()

    def test_a_warning_passes_without_strict(self):
        code, out = self.run_main()
        self.assertEqual(code, 0)
        self.assertIn(f"::warning file=cli-tool/components/skills/development/demo/SKILL.md::{WARNING}", out)

    def test_strict_fails_on_a_warning(self):
        code, out = self.run_main("--strict")
        self.assertEqual(code, 1)
        self.assertIn(f"::error file=cli-tool/components/skills/development/demo/SKILL.md::{WARNING}", out)
        self.assertEqual(json.loads(self.report.read_text())[0]["warnings"][0]["message"], WARNING)

    def test_a_warning_is_reported_next_to_an_error(self):
        where = "file=cli-tool/components/skills/development/demo/SKILL.md"
        with mock.patch.object(validate_components, "claude", fake_claude_with_an_error):
            for flags, level in (((), "warning"), (("--strict",), "error")):
                with self.subTest(flags=flags):
                    code, out = self.run_main(*flags)

                    self.assertEqual(code, 1)
                    self.assertIn(f"::error {where}::{ERROR}", out)
                    self.assertIn(f"::{level} {where}::{WARNING}", out)


if __name__ == "__main__":
    unittest.main()
