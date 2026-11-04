import importlib.util
import json
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


if __name__ == "__main__":
    unittest.main()
