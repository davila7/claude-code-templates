"""Tests for scripts/generate_certifications.py (no network).

python -m unittest scripts/test_generate_certifications.py -v
"""

import copy
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_certifications as g  # noqa: E402

VOCAB = g.read_vocabularies()
SOURCE = {"id": "src", "label": "Src", "provider": "Acme", "categories": ["AI & Agents"], "price": None}


def manual(id_, url):
    return {
        "id": id_, "kind": "certification", "title": id_, "provider": "Anthropic", "categories": ["AI & Agents"],
        "description": "d", "url": url, "eligibility": "partners", "topics": [], "source": "manual",
        "addedAt": "2026-01-01", "verifiedAt": "2026-01-01",
    }


def fetched(id_, url, **extra):
    item = g.base_item(SOURCE, id=id_, kind="course", title=id_, description="d", url=url)
    item.update(extra)
    return item


def data(*items):
    return {"schemaVersion": 1, "lastUpdated": "", "sources": [], "providers": {}, "items": list(items)}


class MergeTest(unittest.TestCase):
    def run_merge(self, d, items, ok=("src",)):
        return g.merge(copy.deepcopy(d), {"src": items}, list(ok), VOCAB, {"src": "Src"}, {"Acme": {}})

    def test_keeps_manual_entries_and_skips_duplicates_of_them(self):
        d = data(manual("m", "https://x.test/cert"))
        out = self.run_merge(d, [fetched("acme-dup", "https://x.test/cert/"), fetched("acme-new", "https://x.test/new")])
        self.assertEqual([i["id"] for i in out["items"]], ["m", "acme-new"])
        self.assertEqual(out["items"][0], d["items"][0])

    def test_failed_source_keeps_previous_entries(self):
        old = fetched("acme-old", "https://x.test/old", addedAt="2026-01-01", verifiedAt="2026-01-01")
        out = self.run_merge(data(old), [], ok=())
        self.assertEqual([i["id"] for i in out["items"]], ["acme-old"])

    def test_answering_source_replaces_its_entries_and_keeps_added_at(self):
        old = fetched("acme-a", "https://x.test/a", addedAt="2026-01-01", verifiedAt="2026-01-01")
        gone = fetched("acme-gone", "https://x.test/gone", addedAt="2026-01-01", verifiedAt="2026-01-01")
        out = self.run_merge(data(old, gone), [fetched("acme-a", "https://x.test/a")])
        self.assertEqual([i["id"] for i in out["items"]], ["acme-a"])
        self.assertEqual(out["items"][0]["addedAt"], "2026-01-01")
        self.assertEqual(out["items"][0]["verifiedAt"], g.today())

    def test_drops_entries_outside_the_vocabularies(self):
        out = self.run_merge(data(), [fetched("acme-bad", "https://x.test/b", categories=["CI/CD"]), fetched("acme-http", "http://x.test")])
        self.assertEqual(out["items"], [])

    def test_unpublished_price_stays_absent(self):
        src = {k: v for k, v in SOURCE.items() if k != "price"}
        self.assertNotIn("price", g.base_item(src, id="a"))
        self.assertIsNone(g.base_item(SOURCE, id="a")["price"])


class HelpersTest(unittest.TestCase):
    def test_item_id_does_not_repeat_the_provider(self):
        self.assertEqual(g.item_id("GitHub", "github-copilot"), "github-copilot")
        self.assertEqual(g.item_id("GitHub", "agentic-ai-developer"), "github-agentic-ai-developer")

    def test_title_rules_first_match_per_field(self):
        src = {"rules": [
            {"match": "agent", "categories": ["AI & Agents"]},
            {"match": "next\\.js", "categories": ["Frontend"]},
            {"match": "professional", "level": "Advanced"},
        ]}
        self.assertEqual(g.title_rules(src, "Agents with Next.js Professional"), {"categories": ["AI & Agents"], "level": "Advanced"})
        self.assertEqual(g.title_rules(src, "Build with Next.js"), {"categories": ["Frontend"]})
        self.assertEqual(g.title_rules(src, "Other"), {})

    def test_url_slug_keeps_ids_stable_across_renames(self):
        self.assertEqual(g.url_slug("https://vercel.com/academy/ai-sdk", "https://vercel.com/academy"), "ai-sdk")
        self.assertIsNone(g.url_slug("https://cursor.com/learn", "https://cursor.com/learn/"))

    def test_invalid_fetched_items_do_not_count(self):
        self.assertTrue(g.is_valid_fetched(fetched("acme-ok", "https://x.test/ok"), VOCAB))
        self.assertFalse(g.is_valid_fetched(fetched("acme-bad", "https://x.test/b", categories=["CI/CD"]), VOCAB))

    def test_clean_url_drops_tracking(self):
        self.assertEqual(g.clean_url("https://learn.microsoft.com/a/?WT.mc_id=api_CatalogApi"), "https://learn.microsoft.com/a/")

    def test_vocabularies_come_from_the_dashboard_contract(self):
        self.assertIn("AI & Agents", VOCAB["CATEGORIES"])
        self.assertEqual(VOCAB["LEVELS"], ["Entry", "Intermediate", "Advanced"])

    def test_current_data_passes_the_python_contract(self):
        d = g.read_json(g.DATA_PATH)
        for item in d["items"]:
            self.assertEqual(g.validate_item(item, VOCAB), [], item["id"])


class MainRetentionTest(unittest.TestCase):
    """main() keeps a source's previous entries when a fetch shrinks, fails or is skipped."""

    def setUp(self):
        import tempfile
        self.dir = tempfile.mkdtemp()
        self.sources = os.path.join(self.dir, "sources.json")
        self.data = os.path.join(self.dir, "data.json")
        self.cache = os.path.join(self.dir, "cache.json")
        src = dict(SOURCE, type="fake", url="https://acme.test/")
        fc = dict(SOURCE, id="fc", label="Fc", type="firecrawl", url="https://acme.test/")
        with open(self.sources, "w") as f:
            json.dump({"providers": {"Acme": {}}, "sources": [src, fc]}, f)
        prev = [fetched(f"acme-{n}", f"https://acme.test/{n}") for n in range(10)]
        prev_fc = [dict(fetched("acme-fc", "https://acme.test/fc"), source="fc")]
        with open(self.data, "w") as f:
            json.dump(data(*prev, *prev_fc), f)
        self.fetchers = dict(g.FETCHERS)
        self.env = os.environ.pop("FIRECRAWL_API_KEY", None)

    def tearDown(self):
        g.FETCHERS.clear()
        g.FETCHERS.update(self.fetchers)
        if self.env is not None:
            os.environ["FIRECRAWL_API_KEY"] = self.env

    @staticmethod
    def read(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)

    def run_main(self, fetcher):
        g.FETCHERS["fake"] = fetcher
        g.main([], self.sources, self.data, self.cache)
        items = self.read(self.data)["items"]
        return {i["id"] for i in items if i["source"] == "src"}, {i["id"] for i in items if i["source"] == "fc"}

    def test_shrunk_fetch_keeps_previous_entries(self):
        src_ids, fc_ids = self.run_main(lambda s, k: [fetched("acme-0", "https://acme.test/0")])
        self.assertEqual(len(src_ids), 10)
        self.assertEqual(fc_ids, {"acme-fc"})  # firecrawl skipped without a key
        self.assertEqual(self.read(self.cache)["ok"], [])

    def test_raising_fetcher_keeps_previous_entries(self):
        def boom(s, k):
            raise RuntimeError("HTTP 402")
        src_ids, _ = self.run_main(boom)
        self.assertEqual(len(src_ids), 10)

    def test_full_fetch_replaces_entries(self):
        new = [fetched(f"acme-new-{n}", f"https://acme.test/new-{n}") for n in range(8)]
        src_ids, _ = self.run_main(lambda s, k: new)
        self.assertEqual(src_ids, {i["id"] for i in new})


if __name__ == "__main__":
    unittest.main()
