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


class DefaultDirectoryPluginGenerationTest(unittest.TestCase):
    def generate(self, source, declared_skills=None, root_name="consulting"):
        marketplace = {
            "name": "example-consulting-marketplace",
            "plugins": [{"name": "consulting", "source": source}],
        }
        plugin = {"name": root_name}
        if declared_skills is not None:
            plugin["skills"] = declared_skills
        files = {
            ".claude-plugin/marketplace.json": json.dumps(marketplace),
            ".claude-plugin/plugin.json": json.dumps(plugin),
            "skills/due-diligence/SKILL.md": (
                "---\nname: due-diligence\ndescription: Review evidence\n---\n"
            ),
        }
        listings = {
            "": [{"name": "skills", "type": "dir"}],
            "skills": [
                {"name": "due-diligence", "type": "dir"},
                {"name": "engagement-pricing", "type": "dir"},
            ],
        }
        repo_info = {
            "name": "consulting-plugin",
            "owner": {"login": "example"},
            "description": "Consulting workflows",
        }
        with (
            patch.object(generator, "gh_api", return_value=repo_info),
            patch.object(generator, "gh_file_content", side_effect=lambda _repo, path: files.get(path)),
            patch.object(generator, "gh_dir_listing", side_effect=lambda _repo, path: listings.get(path, [])) as listing,
        ):
            result = generator.process_repo("example/consulting-plugin")
        return result, listing

    def test_default_skills_keep_pack_and_install_names(self):
        for source in (
            "./",
            {"source": "github", "repo": "example/consulting-plugin"},
            {"source": "url", "url": "https://github.com/example/consulting-plugin.git"},
        ):
            with self.subTest(source=source):
                result, _ = self.generate(source)
                self.assertEqual(result["type"], "plugin")
                self.assertEqual(result["contains"], {"skills": 2})
                self.assertEqual(result["tags"], ["skills"])
                self.assertEqual(result["marketplace_name"], "example-consulting-marketplace")
                self.assertEqual(result["plugin_name"], "consulting")
                self.assertEqual(result["plugin_manifest"], {
                    "skills": ["due-diligence", "engagement-pricing"],
                })

    def test_explicit_components_are_preserved_without_root_scan(self):
        result, listing = self.generate(
            {"source": "url", "url": "https://github.com/example/consulting-plugin.git"},
            declared_skills=["./custom-skills/review"],
        )
        self.assertEqual(result["contains"], {"skills": 1})
        self.assertEqual(result["plugin_manifest"], {"skills": ["./custom-skills/review"]})
        listing.assert_not_called()

    def test_same_name_external_or_subdirectory_plugin_is_not_scanned(self):
        for source in (
            {"source": "url", "url": "https://github.com/example/elsewhere.git"},
            {"source": "github", "repo": "example/elsewhere"},
            {"source": "github", "repo": "example/consulting-plugin", "path": "nested"},
        ):
            with self.subTest(source=source):
                result, listing = self.generate(source)
                self.assertEqual(result["contains"], {})
                listing.assert_not_called()

    def test_unrelated_root_plugin_is_not_scanned(self):
        result, listing = self.generate(
            {"source": "url", "url": "https://github.com/example/elsewhere.git"},
            root_name="other-plugin",
        )
        self.assertEqual(result["contains"], {})
        listing.assert_not_called()

    def test_root_scan_reads_descriptions_without_leading_slash(self):
        files = {
            "skills/review/SKILL.md": "---\ndescription: Review evidence\n---\n",
            ".claude-plugin/plugin.json": json.dumps({"name": "review"}),
        }
        listings = {
            "": [{"name": "skills", "type": "dir"}],
            "skills": [{"name": "review", "type": "dir"}],
        }
        with (
            patch.object(generator, "gh_file_content", side_effect=lambda _repo, path: files.get(path)),
            patch.object(generator, "gh_dir_listing", side_effect=lambda _repo, path: listings.get(path, [])),
        ):
            counts, items = generator.scan_plugin_dir_components("example/review", "")
        self.assertEqual(counts, {"skills": 1})
        self.assertEqual(items["skills"], [{"name": "review", "description": "Review evidence"}])


if __name__ == "__main__":
    unittest.main()
