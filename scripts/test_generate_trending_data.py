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


if __name__ == "__main__":
    unittest.main()
