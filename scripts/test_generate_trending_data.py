import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).with_name("generate_trending_data.py")
SPEC = importlib.util.spec_from_file_location("generate_trending_data", MODULE_PATH)
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)


def download(component_type, name, days_ago=0, category="general", country="CL"):
    ts = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=1)
    return {
        "component_type": component_type,
        "component_name": name,
        "category": category,
        "country": country,
        "download_timestamp": ts.isoformat().replace("+00:00", "Z"),
    }


class CanonicalTypeTest(unittest.TestCase):
    def test_plural_spelling_collapses_to_the_singular(self):
        self.assertEqual(generator.canonical_type("mods"), "mod")
        self.assertEqual(generator.canonical_type("mcps"), "mcp")

    def test_singular_spelling_is_unchanged(self):
        self.assertEqual(generator.canonical_type("mod"), "mod")
        self.assertEqual(generator.canonical_type("sandbox"), "sandbox")

    def test_unknown_type_is_left_alone(self):
        self.assertEqual(generator.canonical_type("widget"), "widget")


class LegacyTypeAliasTest(unittest.TestCase):
    def test_function_hook_is_folded_into_mod(self):
        self.assertEqual(generator.canonical_type("function-hook"), "mod")
        self.assertEqual(generator.canonical_type("function-hooks"), "mod")
        self.assertEqual(generator.plural_type("function-hook"), "mods")

    def test_legacy_and_current_rows_are_one_component(self):
        # Pre-#910 CLI versions still write component_type 'function-hook'.
        downloads = [download("function-hook", "secret-redactor", days_ago=2),
                     download("function-hook", "secret-redactor", days_ago=1),
                     download("mod", "secret-redactor")]

        data = generator.process_downloads_data(downloads)

        self.assertNotIn("function-hooks", data["trending"])
        mods = data["trending"]["mods"]
        self.assertEqual(len(mods), 1)
        self.assertEqual(mods[0]["id"], "mod-secret-redactor")
        self.assertEqual(mods[0]["downloadsTotal"], 3)
        self.assertEqual(data["globalStats"]["totalComponents"], 1)

    def test_legacy_rows_land_in_the_mods_chart_series(self):
        data = generator.process_downloads_data([download("function-hook", "pacman")])

        self.assertNotIn("function-hooks", data["chartData"]["series"])
        self.assertEqual(data["chartData"]["series"]["mods"][-1], 1)


class PluralTypeTest(unittest.TestCase):
    def test_known_types_map_to_their_bucket(self):
        self.assertEqual(generator.plural_type("mod"), "mods")
        self.assertEqual(generator.plural_type("loop"), "loops")
        self.assertEqual(generator.plural_type("mcp"), "mcps")
        self.assertEqual(generator.plural_type("sandbox"), "sandbox")

    def test_already_plural_types_are_not_pluralized_twice(self):
        self.assertEqual(generator.plural_type("mods"), "mods")
        self.assertEqual(generator.plural_type("mcps"), "mcps")

    def test_unknown_type_still_gets_a_bucket(self):
        self.assertEqual(generator.plural_type("widget"), "widgets")


class ProcessDownloadsDataTest(unittest.TestCase):
    def test_mod_downloads_get_their_own_trending_bucket(self):
        downloads = [download("mod", "jev-model-router", days_ago=d) for d in range(3)]
        downloads += [download("agent", "frontend-developer")]

        data = generator.process_downloads_data(downloads)

        self.assertIn("mods", data["trending"])
        mods = data["trending"]["mods"]
        self.assertEqual([m["name"] for m in mods], ["jev-model-router"])
        self.assertEqual(mods[0]["downloadsTotal"], 3)
        self.assertEqual(mods[0]["downloadsWeek"], 3)

    def test_mods_appear_in_the_chart_series(self):
        data = generator.process_downloads_data([download("mod", "secret-redactor")])

        series = data["chartData"]["series"]
        self.assertIn("mods", series)
        self.assertEqual(len(series["mods"]), len(data["chartData"]["dates"]))
        self.assertEqual(series["mods"][-1], 1)

    def test_singular_and_plural_component_types_merge_into_one_bucket(self):
        downloads = [download("mod", "a"), download("mods", "b")]

        data = generator.process_downloads_data(downloads)

        names = sorted(m["name"] for m in data["trending"]["mods"])
        self.assertEqual(names, ["a", "b"])

    def test_mixed_spellings_of_one_component_are_a_single_row(self):
        downloads = [download("mods", "jev-model-router", days_ago=1),
                     download("mod", "jev-model-router")]

        data = generator.process_downloads_data(downloads)

        mods = data["trending"]["mods"]
        self.assertEqual(len(mods), 1)
        self.assertEqual(mods[0]["downloadsTotal"], 2)
        self.assertEqual(data["globalStats"]["totalComponents"], 1)

    def test_trending_ids_keep_the_singular_type_prefix(self):
        # TrendingView derives the row icon from id.split('-')[0] + 's'.
        data = generator.process_downloads_data([download("mods", "secret-redactor")])

        self.assertEqual(data["trending"]["mods"][0]["id"], "mod-secret-redactor")

    def test_core_types_still_fall_back_when_absent(self):
        data = generator.process_downloads_data([download("mod", "a")])

        for bucket in generator.FALLBACK_TYPES:
            self.assertIn(bucket, data["trending"])

    def test_mods_are_included_in_the_all_bucket(self):
        data = generator.process_downloads_data([download("mod", "a")])

        self.assertEqual([i["name"] for i in data["trending"]["all"]], ["a"])


class ClientSplitTest(unittest.TestCase):
    def row(self, agent=None, entrypoint=None, is_tty=None, days_ago=0):
        r = download("agent", "frontend-developer", days_ago=days_ago)
        r.update(client_agent=agent, client_entrypoint=entrypoint, client_is_tty=is_tty)
        return r

    def test_rows_are_split_by_who_ran_the_cli(self):
        rows = [self.row("claude", "cli", False), self.row("claude", "sdk-ts", False),
                self.row("cursor", None, False), self.row(None, None, True),
                self.row(None, None, False), download("agent", "frontend-developer")]

        split = generator.process_downloads_data(rows)["clientSplit"]

        self.assertEqual(split["totals"], {"agent": 3, "human": 1, "nonInteractive": 1, "unknown": 1})
        self.assertEqual(split["agents"], [{"name": "claude", "downloads": 2}, {"name": "cursor", "downloads": 1}])
        self.assertEqual({e["name"] for e in split["entrypoints"]}, {"cli", "sdk-ts"})
        self.assertEqual(sum(split["daily"]["agent"]), 3)
        self.assertEqual(len(split["daily"]["dates"]), 30)

    def test_old_cli_rows_only_count_as_unknown(self):
        split = generator.process_downloads_data([download("agent", "a", days_ago=3)])["clientSplit"]

        self.assertIsNone(split["since"])
        self.assertEqual(split["totals"]["unknown"], 1)
        self.assertEqual(split["agents"], [])

    def test_since_is_the_first_reported_day(self):
        rows = [self.row(None, None, True, days_ago=2), self.row("claude", None, False), download("agent", "a", days_ago=5)]

        split = generator.process_downloads_data(rows)["clientSplit"]

        expected = (datetime.now(timezone.utc) - timedelta(days=2, hours=1)).strftime("%Y-%m-%d")
        self.assertEqual(split["since"], expected)


SUMMARY = {
    "asOf": "2026-11-20",
    "computedAt": "2026-11-20T02:30:00+00:00",
    "totalInstallers": 1000,
    "monthly": [{"month": "2026-10", "new": 600, "cumulative": 600},
                {"month": "2026-11", "new": 400, "cumulative": 1000}],
    "window": {"current": 300, "previous": 250, "returning": 40},
    "components": [
        {"type": "agent", "name": "database/database-architect", "current": 120, "previous": 20},
        {"type": "agent", "name": "development/steady", "current": 200, "previous": 190},
        {"type": "skill", "name": "x/not-in-catalog", "current": 90, "previous": 1},
        {"type": "function-hook", "name": "security/secret-redactor", "current": 30, "previous": 2},
    ],
}

CATALOG = {
    ("agent", "database-architect"): [{"path": "database/database-architect", "category": "database"}],
    ("agent", "steady"): [{"path": "development/steady", "category": "development"}],
    ("mod", "secret-redactor"): [{"path": "security/secret-redactor", "category": "security"}],
}


class InstallerSummaryTest(unittest.TestCase):
    def rows(self):
        return ([download("agent", "database/database-architect")] * 3
                + [download("agent", "development/steady")] * 9
                + [download("skill", "x/not-in-catalog")] * 5
                + [download("function-hook", "security/secret-redactor")])

    def test_lists_rank_by_installers_when_the_summary_exists(self):
        data = generator.process_downloads_data(self.rows(), installer_summary=SUMMARY, catalog=CATALOG)
        agents = data["trending"]["agents"]
        self.assertEqual([a["name"] for a in agents], ["steady", "database-architect"])
        self.assertEqual(agents[1]["installersWeek"], 120)
        self.assertEqual(agents[1]["path"], "database/database-architect")

    def test_rising_keeps_catalog_components_with_a_real_gain(self):
        data = generator.process_downloads_data(self.rows(), installer_summary=SUMMARY, catalog=CATALOG)
        names = [r["name"] for r in data["rising"]]
        # not-in-catalog has no path; steady gained only 5%; the mod's legacy
        # type folds into mods.
        self.assertEqual(names, ["database-architect", "secret-redactor"])
        self.assertEqual(data["rising"][1]["type"], "mods")

    def test_installers_block(self):
        data = generator.process_downloads_data(self.rows(), installer_summary=SUMMARY, catalog=CATALOG,
                                                added_this_month=7)
        block = data["installers"]
        self.assertEqual(block["total"], 1000)
        self.assertEqual(block["activeWeek"], 300)
        self.assertEqual(block["returningWeek"], 40)
        self.assertEqual(block["addedThisMonth"], 7)
        self.assertEqual(block["monthly"][-1]["cumulative"], 1000)

    def test_without_summary_lists_rank_by_downloads_and_nothing_is_added(self):
        data = generator.process_downloads_data(self.rows(), catalog=CATALOG)
        self.assertIsNone(data["installers"])
        self.assertEqual(data["rising"], [])
        self.assertNotIn("installersWeek", data["trending"]["agents"][0])
        self.assertEqual(data["trending"]["agents"][0]["name"], "steady")

    def test_rising_needs_the_minimum(self):
        small = dict(SUMMARY, components=[{"type": "agent", "name": "database/database-architect",
                                            "current": 24, "previous": 0}])
        data = generator.process_downloads_data(self.rows(), installer_summary=small, catalog=CATALOG)
        self.assertEqual(data["rising"], [])

    def test_catalog_match_prefers_the_category(self):
        catalog = {("agent", "dup"): [{"path": "a/dup", "category": "a"}, {"path": "b/dup", "category": "b"}]}
        self.assertEqual(generator.catalog_match(catalog, "agent", "dup", "b")["path"], "b/dup")
        self.assertIsNone(generator.catalog_match(catalog, "agent", "dup", "c"))


if __name__ == "__main__":
    unittest.main()
