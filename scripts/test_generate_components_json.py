import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("generate_components_json.py")
SPEC = importlib.util.spec_from_file_location("generate_components_json", MODULE_PATH)
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)


class FakeResponse:
    """Minimal stand-in for requests.Response as fetch_download_stats uses it."""

    def __init__(self, payload, headers=None):
        self.status_code = 200
        self._payload = payload
        self.headers = headers or {}

    def json(self):
        return self._payload


def row(component_type, name):
    return {"component_type": component_type, "component_name": name}


def markdown(*frontmatter_lines):
    """A component file whose frontmatter is the given lines."""
    return "---\n" + "\n".join(frontmatter_lines) + "\n---\n\nBody.\n"


class DownloadStatsTestCase(unittest.TestCase):
    def fetch(self, downloads=None, stats=None):
        """Run fetch_download_stats against fake Supabase responses.

        `downloads` is one page of component_downloads rows (the primary path).
        Leaving it empty makes the function fall through to the download_stats
        table, which `stats` then answers.
        """
        pages = [list(downloads or [])]

        def fake_get(url, headers=None, params=None, timeout=None):
            if "download_stats" in url:
                return FakeResponse(list(stats or []))
            return FakeResponse(pages.pop(0) if pages else [])

        env = {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_API_KEY": "key"}
        with patch.object(generator.os, "getenv", side_effect=env.get), \
             patch.object(generator.requests, "get", side_effect=fake_get):
            return generator.fetch_download_stats()


class DownloadStatsTypeMappingTest(DownloadStatsTestCase):

    def test_legacy_function_hook_downloads_land_on_the_mod(self):
        counts = self.fetch([row("function-hook", "security/secret-redactor")] * 11
                            + [row("mod", "security/secret-redactor")] * 3)

        # Pre-#910 rows used to be dropped under a 'function-hooks/...' key.
        self.assertNotIn("function-hooks/security/secret-redactor", counts)
        self.assertEqual(counts["mods/security/secret-redactor"], 14)

    def test_mod_and_loop_map_to_their_directories(self):
        counts = self.fetch([row("mod", "games/pacman"),
                             row("loop", "engineering/docs-sweep-loop")])

        self.assertEqual(counts["mods/games/pacman"], 1)
        self.assertEqual(counts["loops/engineering/docs-sweep-loop"], 1)

    def test_other_types_are_unaffected(self):
        counts = self.fetch([row("agent", "development-team/react-expert"),
                             row("mcp", "database/postgres")])

        self.assertEqual(counts["agents/development-team/react-expert"], 1)
        self.assertEqual(counts["mcps/database/postgres"], 1)


class DownloadStatsFallbackTableTest(DownloadStatsTestCase):
    """The download_stats table path, used when component_downloads returns nothing."""

    def stat(self, component_type, name, total):
        return {
            "component_type": component_type,
            "component_name": name,
            "total_downloads": total,
        }

    def test_legacy_and_current_totals_are_summed(self):
        counts = self.fetch(
            downloads=[],
            stats=[self.stat("function-hook", "security/secret-redactor", 11),
                   self.stat("mod", "security/secret-redactor", 3)],
        )

        # Before accumulating, the second row overwrote the first instead of adding.
        self.assertNotIn("function-hooks/security/secret-redactor", counts)
        self.assertEqual(counts["mods/security/secret-redactor"], 14)

    def test_unrelated_types_keep_their_own_totals(self):
        counts = self.fetch(
            downloads=[],
            stats=[self.stat("agent", "development-team/react-expert", 7),
                   self.stat("mod", "games/pacman", 5)],
        )

        self.assertEqual(counts["agents/development-team/react-expert"], 7)
        self.assertEqual(counts["mods/games/pacman"], 5)


class FrontmatterMetaTest(unittest.TestCase):
    """parse_frontmatter_meta, which fills the catalog's description, author,
    repo, version, license and keywords for markdown components."""

    BLOCK_LINES = ("  Reviews a pull request.", "  Use it before merging.")
    BLOCK_SCALARS = (
        ("|", "Reviews a pull request.\nUse it before merging."),
        ("|-", "Reviews a pull request.\nUse it before merging."),
        (">", "Reviews a pull request. Use it before merging."),
        (">-", "Reviews a pull request. Use it before merging."),
    )

    def parse(self, *lines):
        return generator.parse_frontmatter_meta(markdown(*lines))

    def test_block_scalar_description(self):
        for indicator, expected in self.BLOCK_SCALARS:
            with self.subTest(indicator=indicator):
                meta = self.parse("name: reviewer", f"description: {indicator}", *self.BLOCK_LINES)

                # The line parser this replaced returned the bare indicator (#1046).
                self.assertEqual(meta["description"], expected)

    def test_quotes_are_not_part_of_the_value(self):
        meta = self.parse('description: "Reviews: one pull request at a time"',
                          "author: 'Jane Doe'")

        self.assertEqual(meta["description"], "Reviews: one pull request at a time")
        self.assertEqual(meta["author"], "Jane Doe")

    def test_plain_values_are_read_as_written(self):
        meta = self.parse("description: Reviews a pull request",
                          "author: Jane Doe",
                          "repo: https://github.com/example/reviewer",
                          "license: MIT")

        self.assertEqual(meta["description"], "Reviews a pull request")
        self.assertEqual(meta["author"], "Jane Doe")
        self.assertEqual(meta["repo"], "https://github.com/example/reviewer")
        self.assertEqual(meta["license"], "MIT")

    def test_scalars_stay_strings(self):
        meta = self.parse("description: true", "version: 1.10")

        # A typed loader such as yaml.safe_load would give "True" and "1.1".
        self.assertEqual(meta["description"], "true")
        self.assertEqual(meta["version"], "1.10")

    def test_metadata_fills_keys_missing_at_the_top_level(self):
        meta = self.parse("description: Reviews a pull request",
                          "metadata:",
                          "  author: Jane Doe",
                          "  version: 1.10")

        # Agent Skills frontmatter keeps author and version under metadata.
        self.assertEqual(meta["author"], "Jane Doe")
        self.assertEqual(meta["version"], "1.10")

    def test_top_level_keys_win_over_metadata(self):
        meta = self.parse("description: Reviews a pull request",
                          "author: Jane Doe",
                          "metadata:",
                          "  author: Someone Else")

        self.assertEqual(meta["author"], "Jane Doe")

    def test_tag_lists_become_keywords(self):
        for tags in (["tags: [git, review]"], ["tags:", "  - git", "  - review"]):
            with self.subTest(tags=tags):
                meta = self.parse("description: Reviews a pull request", *tags)

                self.assertEqual(meta["keywords"], ["git", "review"])

    def test_invalid_yaml_falls_back_to_line_parsing(self):
        # Claude Code accepts an unquoted ": " in a value; YAML does not.
        meta = self.parse("description: Use when: the user asks for a review",
                          "version: 1.10",
                          "tags: [git, review]")

        self.assertEqual(meta["description"], "Use when: the user asks for a review")
        self.assertEqual(meta["version"], "1.10")
        self.assertEqual(meta["keywords"], ["git", "review"])

    def test_invalid_yaml_still_reads_a_block_scalar_description(self):
        for indicator, expected in self.BLOCK_SCALARS:
            with self.subTest(indicator=indicator):
                # The unquoted ": " in the hint sends the whole frontmatter to the fallback.
                meta = self.parse("name: reviewer", f"description: {indicator}", *self.BLOCK_LINES,
                                  "argument-hint: usage: /review <pr>")

                self.assertEqual(meta["description"], expected)


if __name__ == "__main__":
    unittest.main()
