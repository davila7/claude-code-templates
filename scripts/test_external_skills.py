import importlib.util
import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("external_skills.py")
SPEC = importlib.util.spec_from_file_location("external_skills", MODULE_PATH)
ext = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ext)

COMMIT = "7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd"
BASE = {"repo": "owner/name", "path": "skills/demo", "commit": COMMIT, "license": "MIT"}


def git(*args, cwd):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


class ValidateManifestTest(unittest.TestCase):

    def test_pinned_commit_required(self):
        self.assertEqual(ext.validate_manifest(BASE)["include"], None)
        with self.assertRaises(ext.ManifestError):
            ext.validate_manifest({**BASE, "commit": "main"})

    def test_include_rules(self):
        self.assertEqual(ext.validate_manifest({**BASE, "include": ["SKILL.md", "scripts/"]})["include"],
                         ["SKILL.md", "scripts"])
        for bad in ([], ["scripts"], ["SKILL.md", "../x"], ["SKILL.md", 3], "SKILL.md"):
            with self.subTest(include=bad), self.assertRaises(ext.ManifestError):
                ext.validate_manifest({**BASE, "include": bad})

    def test_plugin_manifest_rules(self):
        # Claude Code installs a plugin's whole folder: no file filter, no catalog dependencies.
        self.assertEqual(ext.validate_manifest(BASE, "plugin")["path"], "skills/demo")
        for extra in ({"include": ["SKILL.md"]}, {"requires": ["git/x"]}):
            with self.subTest(extra=extra), self.assertRaises(ext.ManifestError):
                ext.validate_manifest({**BASE, **extra}, "plugin")

    def test_is_plugin_and_scan_staging(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            plug = root / "kit"
            (plug / ".claude-plugin").mkdir(parents=True)
            (plug / ".claude-plugin/plugin.json").write_text('{"name": "kit", "description": "A kit"}')
            (plug / "skills/a").mkdir(parents=True)
            (plug / "skills/a/SKILL.md").write_text("---\nname: a\n---\n")
            self.assertTrue(ext.is_plugin(plug))
            staged = ext.stage_plugin_for_scan(plug, root / "stage", "kit")
            self.assertIn('description: "A kit"', (staged / "SKILL.md").read_text())
            self.assertTrue((staged / "skills/a/SKILL.md").is_file())
            self.assertFalse((plug / "SKILL.md").exists())
            # A plugin whose skill is a SKILL.md at its root keeps that file.
            (plug / "SKILL.md").write_text("---\nname: kit\ndescription: root skill\n---\n")
            staged = ext.stage_plugin_for_scan(plug, root / "stage2", "kit")
            self.assertIn("root skill", (staged / "SKILL.md").read_text())

    def test_pr_scan_reports_a_plugin_it_cannot_stage(self):
        import sys
        sys.path.insert(0, str(MODULE_PATH.parent))
        try:
            import skillspector_scan
        finally:
            sys.path.pop(0)
        with tempfile.TemporaryDirectory() as tmp:
            plug = Path(tmp) / "kit"
            (plug / ".claude-plugin").mkdir(parents=True)
            (plug / ".claude-plugin/plugin.json").write_text('{"name": ')
            result = skillspector_scan.scan_skill(plug)  # returns before running skillspector
        self.assertEqual(result["status"], "error")
        self.assertIn("plugin.json", result["error"])

    def test_unreadable_plugin_json_is_a_manifest_error(self):
        # Upstream content: bad JSON or another encoding is reported per plugin, never a crash.
        with tempfile.TemporaryDirectory() as tmp:
            plug = Path(tmp)
            (plug / ".claude-plugin").mkdir()
            for raw in (b'{"name": ', '{"name": "kit"}'.encode("utf-16"), b"[1]"):
                (plug / ".claude-plugin/plugin.json").write_bytes(raw)
                with self.subTest(raw=raw[:12]), self.assertRaises(ext.ManifestError):
                    ext.plugin_manifest(plug)

    def test_plugin_inventory(self):
        with tempfile.TemporaryDirectory() as tmp:
            plug = Path(tmp) / "kit"
            def write(rel, text=""):
                (plug / rel).parent.mkdir(parents=True, exist_ok=True)
                (plug / rel).write_text(text)
            write(".claude-plugin/plugin.json", json.dumps({"name": "kit", "skills": ["./extra/"],
                                                            "mcpServers": {"inline": {"command": "x"}}}))
            write("skills/a/SKILL.md"); write("skills/b/SKILL.md"); write("skills/not-a-skill/notes.md")
            write("extra/c/SKILL.md")
            write("agents/scout.md"); write("agents/review/security.md")
            write("commands/deploy.md")
            write("hooks/hooks.json", json.dumps({"hooks": {"PostToolUse": [], "SessionStart": []}}))
            write(".mcp.json", json.dumps({"mcpServers": {"db": {"command": "db"}}}))
            write("bin/kit-tool", "#!/bin/sh\n")
            inv = ext.plugin_inventory(plug)
            self.assertEqual(inv["skills"], ["a", "b", "c"])
            self.assertEqual(inv["agents"], ["review:security", "scout"])
            self.assertEqual(inv["commands"], ["deploy"])
            self.assertEqual(inv["hooks"], ["PostToolUse", "SessionStart"])
            self.assertEqual(inv["mcpServers"], ["db", "inline"])
            self.assertEqual(inv["bin"], ["kit-tool"])
            self.assertNotIn("themes", inv)  # kinds with nothing are left out
            # "commands" in plugin.json replaces the commands/ folder.
            write(".claude-plugin/plugin.json", json.dumps({"name": "kit", "commands": ["./more/x.md"]}))
            write("more/x.md")
            self.assertEqual(ext.plugin_inventory(plug)["commands"], ["x"])

    def test_inventory_uses_frontmatter_names_for_skills_and_agents(self):
        # Claude Code names skills and agents by their frontmatter `name`
        # (google/elephant-goldfish-model: skills/egm_draft is /egm:egm-draft).
        with tempfile.TemporaryDirectory() as tmp:
            plug = Path(tmp) / "kit"
            def write(rel, text=""):
                (plug / rel).parent.mkdir(parents=True, exist_ok=True)
                (plug / rel).write_text(text)
            write(".claude-plugin/plugin.json", json.dumps({"name": "kit"}))
            write("skills/my_draft/SKILL.md", "---\nname: my-draft\ndescription: d\n---\nbody\n")
            write("skills/plain/SKILL.md", "no frontmatter\n")
            write("agents/design_critic.md", "---\ndescription: x\nname: \"kit-design\"\n---\n")
            write("agents/scout.md", "body only\n")
            write("commands/go.md", "---\nname: ignored\n---\n")
            inv = ext.plugin_inventory(plug)
            self.assertEqual(inv["skills"], ["my-draft", "plain"])
            self.assertEqual(inv["agents"], ["kit-design", "scout"])
            self.assertEqual(inv["commands"], ["go"])

    def test_the_site_lists_every_kind_the_inventory_writes(self):
        # dashboard/src/lib/component-page.ts PLUGIN_KINDS renders `contains`; a kind
        # missing there would vanish from the plugin page and its summary.
        page = (ext.ROOT / "dashboard" / "src" / "lib" / "component-page.ts").read_text(encoding="utf-8")
        site = re.findall(r"\{ key: '(\w+)'", page[page.index("export const PLUGIN_KINDS"):])
        with tempfile.TemporaryDirectory() as tmp:
            plug = Path(tmp) / "kit"
            def write(rel, text=""):
                (plug / rel).parent.mkdir(parents=True, exist_ok=True)
                (plug / rel).write_text(text)
            write(".claude-plugin/plugin.json", json.dumps({"name": "kit"}))
            write("skills/a/SKILL.md"); write("commands/c.md"); write("agents/g.md"); write("output-styles/o.md")
            write("hooks/hooks.json", json.dumps({"hooks": {"Stop": []}}))
            write(".mcp.json", json.dumps({"mcpServers": {"m": {"command": "m"}}}))
            write(".lsp.json", json.dumps({"ts": {"command": "ts"}}))
            write("themes/t.json", "{}"); write("bin/b", "#!/bin/sh\n")
            write("monitors/monitors.json", json.dumps([{"name": "w"}]))
            kinds = set(ext.plugin_inventory(plug))
        self.assertEqual(len(site), len(set(site)), "a kind listed twice")
        self.assertEqual(set(site), kinds)

    def test_is_included(self):
        inc = ["SKILL.md", "scripts", "docs/contract.md"]
        self.assertTrue(ext.is_included("scripts/run.sh", inc))
        self.assertTrue(ext.is_included("docs/contract.md", inc))
        self.assertFalse(ext.is_included("scripts-old/run.sh", inc))
        self.assertFalse(ext.is_included("docs/other.md", inc))
        self.assertTrue(ext.is_included("anything", None))


class LocalDirIncludeTest(unittest.TestCase):
    """local_dir() against a local repo placed where the cache expects it (no network)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        work = root / "work"
        (work / "skills/demo/scripts").mkdir(parents=True)
        (work / "skills/demo/demo").mkdir()
        (work / "skills/demo/SKILL.md").write_text("---\nname: demo\n---\n")
        (work / "skills/demo/scripts/run.sh").write_text("#!/bin/sh\n")
        (work / "skills/demo/scripts/run.sh").chmod(0o755)
        (work / "skills/demo/demo/big.gif").write_bytes(b"GIF89a")
        git("init", "-q", cwd=work)
        git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A", cwd=work)
        git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "x", cwd=work)
        self.commit = git("rev-parse", "HEAD", cwd=work)
        self.old_cache = ext.CACHE_ROOT
        ext.CACHE_ROOT = root / "cache"
        bare = ext.CACHE_ROOT / "git" / "owner__name"
        bare.parent.mkdir(parents=True)
        git("clone", "-q", "--bare", str(work), str(bare), cwd=root)
        self.catalog = root / "catalog"

    def tearDown(self):
        ext.CACHE_ROOT = self.old_cache
        self.tmp.cleanup()

    def manifest_dir(self, name, **extra):
        d = self.catalog / name
        d.mkdir(parents=True)
        (d / "source.json").write_text(json.dumps({**BASE, "commit": self.commit, **extra}))
        return d

    def files(self, d):
        return sorted(p.relative_to(d).as_posix() for p in d.rglob("*") if p.is_file())

    def test_without_include_everything_is_kept(self):
        out = ext.local_dir(self.manifest_dir("all"))
        self.assertEqual(self.files(out), ["SKILL.md", "demo/big.gif", "scripts/run.sh"])

    def test_include_filters_and_gets_its_own_cache(self):
        full = ext.local_dir(self.manifest_dir("all"))
        out = ext.local_dir(self.manifest_dir("some", include=["SKILL.md", "scripts"]))
        self.assertNotEqual(out, full)
        self.assertEqual(self.files(out), ["SKILL.md", "scripts/run.sh"])
        self.assertTrue((out / "scripts/run.sh").stat().st_mode & 0o100)
        # The unfiltered checkout is untouched.
        self.assertEqual(self.files(full), ["SKILL.md", "demo/big.gif", "scripts/run.sh"])


class MarketplaceTest(unittest.TestCase):
    """Catalog plugins -> the aitmpl marketplace, against a local repo (no network)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        work = root / "work"
        (work / "plugins/kit/.claude-plugin").mkdir(parents=True)
        (work / "plugins/kit/.claude-plugin/plugin.json").write_text(json.dumps({
            "name": "kit", "version": "1.2.0", "description": "A kit",
            "author": {"name": "Upstream", "email": "u@example.com"}, "keywords": ["a", "b"],
            "license": "GPL-3.0"}))
        (work / "plugins/kit/skills/a").mkdir(parents=True)
        (work / "plugins/kit/skills/a/SKILL.md").write_text("---\nname: a\n---\n")
        (work / "plugins/bare/.claude-plugin").mkdir(parents=True)
        (work / "plugins/bare/.claude-plugin/plugin.json").write_text('{"name": "bare"}')
        (work / "plugins/linked/.claude-plugin").mkdir(parents=True)
        (work / "plugins/linked/.claude-plugin/plugin.json").write_text('{"name": "linked"}')
        (work / "plugins/linked/escape").symlink_to("../../../etc")
        git("init", "-q", cwd=work)
        git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A", cwd=work)
        git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "x", cwd=work)
        self.commit = git("rev-parse", "HEAD", cwd=work)
        self.saved = (ext.CACHE_ROOT, ext.PLUGINS_ROOT)
        ext.CACHE_ROOT = root / "cache"
        ext.PLUGINS_ROOT = root / "catalog" / "plugins"
        bare = ext.CACHE_ROOT / "git" / "owner__name"
        bare.parent.mkdir(parents=True)
        git("clone", "-q", "--bare", str(work), str(bare), cwd=root)

    def tearDown(self):
        ext.CACHE_ROOT, ext.PLUGINS_ROOT = self.saved
        self.tmp.cleanup()

    def plugin(self, category, name, **extra):
        d = ext.PLUGINS_ROOT / category / name
        d.mkdir(parents=True)
        m = {"repo": "owner/name", "path": f"plugins/{name}", "commit": self.commit, "license": "MIT", **extra}
        (d / "source.json").write_text(json.dumps(m))
        return d

    def test_entry_is_pinned_and_carries_display_fields(self):
        e = ext.marketplace_entry(self.plugin("productivity", "kit"))
        self.assertEqual(e["name"], "kit")
        self.assertEqual(e["source"], {"source": "git-subdir", "url": "https://github.com/owner/name.git",
                                       "path": "plugins/kit", "sha": self.commit})
        self.assertEqual(e["description"], "A kit")
        self.assertEqual(e["author"], {"name": "Upstream", "email": "u@example.com"})
        self.assertEqual(e["keywords"], ["a", "b"])
        # The license checked against the repo wins over plugin.json; no version on the entry.
        self.assertEqual(e["license"], "MIT")
        self.assertNotIn("version", e)
        self.assertEqual(e["category"], "productivity")
        self.assertEqual(e["homepage"], "https://www.aitmpl.com/component/plugins/productivity/kit")
        self.assertEqual(e["repository"], "https://github.com/owner/name")

    def test_entry_falls_back_to_source_json_author(self):
        e = ext.marketplace_entry(self.plugin("dev", "bare", author="Someone"))
        self.assertEqual(e["author"], {"name": "Someone"})
        self.assertNotIn("description", e)

    def test_a_plugin_at_the_repo_root_gets_a_url_source(self):
        # git-subdir needs a subfolder; `url` is older than git-subdir, so every Claude Code
        # that reads this marketplace reads both. No other source type may appear.
        root = Path(self.tmp.name)
        work = root / "work-solo"
        (work / ".claude-plugin").mkdir(parents=True)
        (work / ".claude-plugin/plugin.json").write_text('{"name": "solo", "description": "Solo"}')
        git("init", "-q", cwd=work)
        git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A", cwd=work)
        git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "x", cwd=work)
        commit = git("rev-parse", "HEAD", cwd=work)
        git("clone", "-q", "--bare", str(work), str(ext.CACHE_ROOT / "git" / "owner__solo"), cwd=root)
        solo = ext.PLUGINS_ROOT / "dev" / "solo"
        solo.mkdir(parents=True)
        (solo / "source.json").write_text(json.dumps({"repo": "owner/solo", "path": "", "commit": commit, "license": "MIT"}))
        e = ext.marketplace_entry(solo)
        self.assertEqual(e["source"], {"source": "url", "url": "https://github.com/owner/solo.git", "sha": commit})
        self.assertEqual(e["description"], "Solo")
        m = ext.build_marketplace([solo, self.plugin("dev", "kit")])
        self.assertEqual(sorted(p["source"]["source"] for p in m["plugins"]), ["git-subdir", "url"])

    def test_build_marketplace_sorted_by_name(self):
        dirs = [self.plugin("z", "kit"), self.plugin("a", "bare")]
        m = ext.build_marketplace(dirs)
        self.assertEqual(m["name"], "aitmpl")
        self.assertEqual(m["owner"]["name"], "aitmpl.com")
        self.assertEqual([p["name"] for p in m["plugins"]], ["bare", "kit"])
        self.assertTrue(ext.marketplace_json(m).endswith("}\n"))

    def test_plugin_with_a_symlink_is_refused(self):
        with self.assertRaises(ext.ManifestError):
            ext.local_dir(self.plugin("dev", "linked"))

    def test_plugin_needs_plugin_json(self):
        d = self.plugin("dev", "nothing")
        with self.assertRaises(ext.ManifestError):
            ext.local_dir(d)

    def test_a_copy_outside_the_checkout_is_still_a_plugin(self):
        # skillspector_scan --compare-base extracts the base-ref folder under a
        # temp dir (git archive keeps the repo-relative path); it was read as a
        # skill there and failed for want of a SKILL.md.
        src = self.plugin("dev", "kit")
        with tempfile.TemporaryDirectory() as other:
            copy = Path(other) / "cli-tool" / "components" / "plugins" / "dev" / "kit"
            copy.mkdir(parents=True)
            (copy / "source.json").write_text((src / "source.json").read_text())
            self.assertEqual(ext.kind_of(copy), "plugin")
            out = ext.local_dir(copy)
            self.assertTrue((out / ".claude-plugin" / "plugin.json").is_file())
            skill = Path(other) / "cli-tool" / "components" / "skills" / "plugins" / "kit"
            self.assertEqual(ext.kind_of(skill), "skill", "a skill category named plugins is still a skill")


if __name__ == "__main__":
    unittest.main()
