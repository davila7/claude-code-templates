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


class DownloadStatsTypeMappingTest(unittest.TestCase):
    def fetch(self, rows):
        """Run fetch_download_stats against one page of fake Supabase rows."""
        pages = [rows, []]

        def fake_get(url, headers=None, params=None, timeout=None):
            return FakeResponse(pages.pop(0) if pages else [])

        env = {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_API_KEY": "key"}
        with patch.object(generator.os, "getenv", side_effect=env.get), \
             patch.object(generator.requests, "get", side_effect=fake_get):
            return generator.fetch_download_stats()

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


if __name__ == "__main__":
    unittest.main()
