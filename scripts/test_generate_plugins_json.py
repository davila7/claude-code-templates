import importlib.util
import json
from pathlib import Path
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


if __name__ == "__main__":
    unittest.main()
