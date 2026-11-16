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


class PreviousComponentTest(unittest.TestCase):
    """An external skill whose repo cannot be fetched keeps its last catalog entry."""

    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.catalog = self.tmp / "components.json"
        self.content = self.tmp / "component-content"
        self.catalog.write_text(json.dumps({"skills": [
            {"name": "x", "path": "git/x", "category": "git", "downloads": 3, "source": {"repo": "a/b"}},
            {"name": "y", "path": "git/y", "category": "git"},
        ]}))
        (self.content / "skills" / "git").mkdir(parents=True)
        (self.content / "skills" / "git" / "x.json").write_text(json.dumps(
            {"content": "# x", "files": {"SKILL.md": "# x"}, "meta": {"files": []}}))

    def find(self, path):
        return generator.previous_component("skills", path, str(self.catalog), str(self.content), _cache={})

    def test_entry_and_content_are_rebuilt(self):
        kept = self.find("git/x")
        self.assertEqual(kept["source"], {"repo": "a/b"})
        self.assertEqual(kept["content"], "# x")
        self.assertEqual(kept["files"], {"SKILL.md": "# x"})
        self.assertNotIn("meta", kept)

    def test_missing_entry_or_content_file_gives_none(self):
        self.assertIsNone(self.find("git/new"))
        self.assertIsNone(self.find("git/y"))


class SkillSpectorKeepsResultTest(unittest.TestCase):
    """A component whose files cannot be read this run keeps its last SkillSpector result."""

    def test_unreadable_component_keeps_previous_result(self):
        import skillspector_catalog
        prev = {"score": 10, "hash": "abc", "version": "2.12.0"}
        data = {"skills": [{"name": "x", "path": "git/x"}, {"name": "new", "path": "git/new"}]}
        with patch.object(skillspector_catalog, "previous_results", return_value={"skills/git/x": prev}), \
             patch.object(skillspector_catalog, "source_files", side_effect=ValueError("repo gone")):
            skillspector_catalog.attach_skillspector(data, scan_enabled=False)
        self.assertEqual(data["skills"][0]["skillspector"], prev)
        self.assertNotIn("skillspector", data["skills"][1])


if __name__ == "__main__":
    unittest.main()
