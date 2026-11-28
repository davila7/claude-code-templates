import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("generate_plugins_json.py")
SPEC = importlib.util.spec_from_file_location("generate_plugins_json", MODULE_PATH)
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)


class CohesivityPluginGenerationTest(unittest.TestCase):
    def test_root_file_backed_mcp_manifest_is_resolved(self):
        plugin_json = {"mcpServers": "./.mcp.json"}
        manifest = json.dumps(
            {
                "mcpServers": {
                    "remote": {"type": "http"},
                    "local": {"type": "stdio"},
                }
            }
        )

        with patch.object(
            generator,
            "gh_file_content",
            side_effect=lambda _repo, path: manifest if path == ".mcp.json" else None,
        ):
            counts = generator.extract_plugin_components(
                plugin_json, repo="example/root-plugin"
            )

        self.assertEqual(counts, {"mcps": 2})

    def test_file_backed_mcp_manifest_is_resolved(self):
        files = {
            "packages/claude/.claude-plugin/plugin.json": json.dumps(
                {"skills": "./skills/", "mcpServers": "./.mcp.json"}
            ),
            "packages/claude/.mcp.json": json.dumps(
                {
                    "mcpServers": {
                        "cohesivity": {"type": "http"},
                        "cohesivity-local": {"type": "stdio"},
                    }
                }
            ),
            "packages/claude/skills/cohesivity/SKILL.md": (
                "---\nname: cohesivity\ndescription: Cohesivity skill\n---\n"
            ),
        }
        listings = {
            "packages/claude": [{"name": "skills", "type": "dir"}],
            "packages/claude/skills": [{"name": "cohesivity", "type": "dir"}],
        }

        with (
            patch.object(generator, "gh_file_content", side_effect=lambda _repo, path: files.get(path)),
            patch.object(generator, "gh_dir_listing", side_effect=lambda _repo, path: listings.get(path, [])),
        ):
            counts, items = generator.scan_plugin_dir_components(
                "cohesivity-org/cohesivity-plugin", "packages/claude"
            )

        self.assertEqual(counts, {"skills": 1, "mcps": 2})
        self.assertEqual([item["name"] for item in items["skills"]], ["cohesivity"])
        self.assertEqual(
            [item["name"] for item in items["mcps"]],
            ["cohesivity", "cohesivity-local"],
        )

    def test_cohesivity_listing_uses_declared_install_names_and_components(self):
        marketplace = {
            "name": "cohesivity",
            "description": generator.DESCRIPTION_OVERRIDES["cohesivity-org/cohesivity-plugin"],
            "plugins": [
                {
                    "name": "cohesivity",
                    "source": "./packages/claude",
                    "description": generator.DESCRIPTION_OVERRIDES[
                        "cohesivity-org/cohesivity-plugin"
                    ],
                }
            ],
        }
        files = {
            ".claude-plugin/marketplace.json": json.dumps(marketplace),
            "packages/claude/.claude-plugin/plugin.json": json.dumps(
                {"skills": "./skills/", "mcpServers": "./.mcp.json"}
            ),
            "packages/claude/.mcp.json": json.dumps(
                {
                    "mcpServers": {
                        "cohesivity": {"type": "http"},
                        "cohesivity-local": {"type": "stdio"},
                    }
                }
            ),
            "packages/claude/skills/cohesivity/SKILL.md": (
                "---\nname: cohesivity\ndescription: Cohesivity skill\n---\n"
            ),
        }
        listings = {
            "packages/claude": [{"name": "skills", "type": "dir"}],
            "packages/claude/skills": [{"name": "cohesivity", "type": "dir"}],
        }
        repo_info = {
            "name": "cohesivity-plugin",
            "description": "GitHub repository description",
            "homepage": "https://cohesivity.ai",
            "stargazers_count": 10,
            "owner": {"login": "cohesivity-org"},
        }

        with (
            patch.object(generator, "gh_api", return_value=repo_info),
            patch.object(generator, "gh_file_content", side_effect=lambda _repo, path: files.get(path)),
            patch.object(generator, "gh_dir_listing", side_effect=lambda _repo, path: listings.get(path, [])),
        ):
            result = generator.process_repo(
                "cohesivity-org/cohesivity-plugin", "https://cohesivity.ai"
            )

        self.assertEqual(result["marketplace_name"], "cohesivity")
        self.assertEqual(result["plugin_name"], "cohesivity")
        self.assertEqual(result["description"], marketplace["description"])
        self.assertEqual(result["contains"], {"skills": 1, "mcps": 2})
        self.assertEqual(
            result["plugin_manifest"],
            {
                "skills": ["cohesivity"],
                "mcpServers": ["cohesivity", "cohesivity-local"],
            },
        )


class GitHubFailureHandlingTest(unittest.TestCase):
    def setUp(self):
        self.output = contextlib.redirect_stdout(io.StringIO())
        self.output.__enter__()
        self.addCleanup(self.output.__exit__, None, None, None)

    def test_genuine_missing_resource_is_not_retried(self):
        response = subprocess.CompletedProcess([], 1, stdout="", stderr="HTTP 404 Not Found")
        with patch.object(generator.subprocess, "run", return_value=response) as request:
            self.assertIsNone(generator.gh_api("repos/example/missing"))
        request.assert_called_once()

    def test_exhausted_api_failure_is_not_a_missing_resource(self):
        response = subprocess.CompletedProcess([], 1, stdout="", stderr="HTTP 503 Service Unavailable")
        with (
            patch.object(generator.subprocess, "run", return_value=response),
            patch.object(generator.time, "sleep"),
        ):
            with self.assertRaises(RuntimeError):
                generator.gh_api("repos/example/plugin")

    def test_file_fetch_recovers_after_rate_limit(self):
        attempts = 0

        def request(command, **kwargs):
            nonlocal attempts
            if "rate_limit" in command:
                return subprocess.CompletedProcess(command, 0, stdout="0", stderr="")
            attempts += 1
            if attempts == 1:
                return subprocess.CompletedProcess(command, 1, stdout="", stderr="API rate limit exceeded")
            return subprocess.CompletedProcess(
                command, 0, stdout=base64.b64encode(b"manifest contents").decode(), stderr=""
            )

        with (
            patch.object(generator.subprocess, "run", side_effect=request),
            patch.object(generator.time, "sleep"),
        ):
            self.assertEqual(generator.gh_file_content("example/plugin", "plugin.json"), "manifest contents")

    def test_exhausted_file_failure_is_not_a_missing_file(self):
        response = subprocess.CompletedProcess([], 1, stdout="", stderr="API rate limit exceeded")
        with (
            patch.object(generator.subprocess, "run", return_value=response),
            patch.object(generator.time, "sleep"),
        ):
            with self.assertRaises(RuntimeError):
                generator.gh_file_content("example/plugin", "plugin.json")

    def test_failed_generation_keeps_existing_output(self):
        def process(repo, website):
            if repo == "example/unavailable":
                raise RuntimeError("GitHub unavailable")
            return {"name": repo, "stars": 2, "type": "plugin"}

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "plugins.json"
            original = b'[ { "last": "complete catalog" } ]\n'
            output.write_bytes(original)
            with (
                patch.object(generator, "REPOS", [("example/available", None), ("example/unavailable", None)]),
                patch.object(generator, "OUTPUT_PATH", str(output)),
                patch.object(generator, "process_repo", side_effect=process),
                patch.object(generator.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout="5000", stderr="")),
            ):
                with self.assertRaises(SystemExit) as stopped:
                    generator.main()
                self.assertEqual(stopped.exception.code, 1)
            self.assertEqual(output.read_bytes(), original)

    def test_retry_publishes_both_repositories_after_recovery(self):
        attempts = {}

        def process(repo, website):
            attempts[repo] = attempts.get(repo, 0) + 1
            if repo == "example/recovered" and attempts[repo] == 1:
                raise RuntimeError("GitHub unavailable")
            return {"name": repo, "stars": 2 if repo.endswith("available") else 1, "type": "plugin"}

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "plugins.json"
            with (
                patch.object(generator, "REPOS", [("example/available", None), ("example/recovered", None)]),
                patch.object(generator, "OUTPUT_PATH", str(output)),
                patch.object(generator, "process_repo", side_effect=process),
                patch.object(generator.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout="5000", stderr="")),
            ):
                generator.main()
            self.assertEqual([item["name"] for item in json.loads(output.read_text())], ["example/available", "example/recovered"])


if __name__ == "__main__":
    unittest.main()
